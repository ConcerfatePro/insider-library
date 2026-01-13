# backend/app/auth.py
import os
import random
import smtplib
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from threading import Lock
from typing import Callable, Deque, Dict, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db

# ---------------- CONFIG ----------------

ENV = os.getenv("ENV", "development")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if ENV == "development":
        SECRET_KEY = "dev-only-secret-change-me"
    else:
        raise RuntimeError("SECRET_KEY env var is required in production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

VERIFICATION_CODE_TTL_MINUTES = int(os.getenv("VERIFICATION_CODE_TTL_MINUTES", "15"))
VERIFICATION_RESEND_COOLDOWN_SECONDS = int(
    os.getenv("VERIFICATION_RESEND_COOLDOWN_SECONDS", "30")
)

# Password reset (stateless JWT token)
PASSWORD_RESET_TOKEN_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_TTL_MINUTES", "15"))
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------- RATE LIMITER ----------------
# Simple in-memory fixed-window limiter.
# Good for single-process deployments. For multi-worker / multi-instance, use Redis.

def _parse_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default

# Defaults are intentionally conservative; tune as needed.
RL_LOGIN_IP_LIMIT = _parse_int_env("RL_LOGIN_IP_LIMIT", 30)               # 30 login attempts / 5 min / IP
RL_LOGIN_IP_WINDOW = _parse_int_env("RL_LOGIN_IP_WINDOW", 300)

RL_LOGIN_IP_EMAIL_LIMIT = _parse_int_env("RL_LOGIN_IP_EMAIL_LIMIT", 10)   # 10 attempts / 5 min / IP+email
RL_LOGIN_IP_EMAIL_WINDOW = _parse_int_env("RL_LOGIN_IP_EMAIL_WINDOW", 300)

RL_SIGNUP_IP_LIMIT = _parse_int_env("RL_SIGNUP_IP_LIMIT", 10)             # 10 signups / 10 min / IP
RL_SIGNUP_IP_WINDOW = _parse_int_env("RL_SIGNUP_IP_WINDOW", 600)

RL_VERIFY_IP_EMAIL_LIMIT = _parse_int_env("RL_VERIFY_IP_EMAIL_LIMIT", 15) # 15 verify attempts / 10 min / IP+email
RL_VERIFY_IP_EMAIL_WINDOW = _parse_int_env("RL_VERIFY_IP_EMAIL_WINDOW", 600)

RL_PWD_RESET_REQ_IP_LIMIT = _parse_int_env("RL_PWD_RESET_REQ_IP_LIMIT", 8)      # 8 requests / 15 min / IP
RL_PWD_RESET_REQ_IP_WINDOW = _parse_int_env("RL_PWD_RESET_REQ_IP_WINDOW", 900)

RL_PWD_RESET_REQ_IP_EMAIL_LIMIT = _parse_int_env("RL_PWD_RESET_REQ_IP_EMAIL_LIMIT", 4)  # 4 / 15 min / IP+email
RL_PWD_RESET_REQ_IP_EMAIL_WINDOW = _parse_int_env("RL_PWD_RESET_REQ_IP_EMAIL_WINDOW", 900)

RL_PWD_RESET_IP_LIMIT = _parse_int_env("RL_PWD_RESET_IP_LIMIT", 10)       # 10 reset attempts / 15 min / IP
RL_PWD_RESET_IP_WINDOW = _parse_int_env("RL_PWD_RESET_IP_WINDOW", 900)


def get_client_ip(request: Request) -> str:
    """
    Best-effort client IP.

    If you're behind Cloudflare, CF-Connecting-IP is reliable.
    If you're behind another proxy, you may need to adjust what you trust.
    """
    # Cloudflare
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.split(",")[0].strip()

    # Common proxy headers (be careful: can be spoofed if not behind a trusted proxy)
    x_real = request.headers.get("x-real-ip")
    if x_real:
        return x_real.split(",")[0].strip()

    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Returns (allowed, retry_after_seconds).
        Fixed window using timestamp queue + pruning.
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            q = self._events[key]

            # prune old
            while q and q[0] <= cutoff:
                q.popleft()

            if len(q) >= limit:
                # earliest still-in-window timestamp determines retry-after
                oldest = q[0]
                retry_after = int(max(1, (oldest + window_seconds) - now))
                return False, retry_after

            q.append(now)

            # small cleanup to prevent memory growth
            if not q:
                self._events.pop(key, None)

            return True, 0


_rate_limiter = InMemoryRateLimiter()


def enforce_rate_limit(scope: str, request: Request, key: str, limit: int, window_seconds: int) -> None:
    allowed, retry_after = _rate_limiter.hit(f"{scope}:{key}", limit, window_seconds)
    if not allowed:
        # Retry-After helps clients behave nicely
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


# ---------------- EMAIL ----------------

def send_email(to_email: str, subject: str, body: str) -> None:
    """
    Sends a plaintext email using SMTP.
    Reads env vars at call-time so dotenv/import ordering can't break it.
    """
    email_host = os.getenv("EMAIL_HOST")
    email_port = int(os.getenv("EMAIL_PORT", "587"))
    email_user = os.getenv("EMAIL_USER")
    email_password = os.getenv("EMAIL_PASSWORD")
    email_from = os.getenv("EMAIL_FROM") or email_user

    if not email_host or not email_user or not email_password:
        print("[EMAIL NOT CONFIGURED]")
        print("To:", to_email)
        print("Subject:", subject)
        print(body)
        return

    msg = EmailMessage()
    msg["From"] = email_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(email_host, email_port, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(email_user, email_password)
        server.send_message(msg)

    print(f"[Email] Sent email to {to_email}")


def send_verification_code_email(to_email: str, name: str, code: str, ttl_minutes: int) -> None:
    subject = "Verify your Insider Library account"
    body = f"""Hi {name},

Welcome to Insider Library!

Your verification code is:
{code}

This code expires in {ttl_minutes} minutes.

If you did not create this account, ignore this email.

— Insider Library
"""
    send_email(to_email=to_email, subject=subject, body=body)


def send_password_reset_email(to_email: str, name: str, token: str, ttl_minutes: int) -> None:
    subject = "Reset your Insider Library password"
    reset_link = f"{FRONTEND_BASE_URL}/account?resetToken={token}"

    body = f"""Hi {name},

We received a request to reset your Insider Library password.

Reset link (expires in {ttl_minutes} minutes):
{reset_link}

If the link doesn't work, you can paste this reset token into the site:
{token}

If you didn't request this, you can ignore this email.

— Insider Library
"""
    send_email(to_email=to_email, subject=subject, body=body)


# ---------------- HELPERS ----------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

def ensure_user_can_auth(user: models.User):
    if not user.is_active or user.is_blacklisted:
        raise HTTPException(status_code=403, detail="User is inactive or blacklisted")

def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    ensure_user_can_auth(user)
    if not verify_password(password, user.hashed_password):
        return None
    return user

def _normalize_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

def _sent_at_from_expires(expires_at: Optional[datetime]) -> Optional[datetime]:
    expires_at = _normalize_naive(expires_at)
    if not expires_at:
        return None
    return expires_at - timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES)

def issue_verification_code(user: models.User, *, enforce_cooldown: bool = True) -> str:
    now = datetime.utcnow()

    if enforce_cooldown:
        sent_at = _sent_at_from_expires(user.verification_expires_at)
        if sent_at:
            elapsed = (now - sent_at).total_seconds()
            if elapsed < VERIFICATION_RESEND_COOLDOWN_SECONDS:
                remaining = int(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed)
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {max(1, remaining)} seconds before requesting a new code.",
                )

    code = f"{random.randint(0, 999999):06d}"
    user.verification_code = code
    user.verification_expires_at = now + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES)

    if ENV == "development":
        print(f"[InsiderLibrary] Verification code for {user.email}: {code}")

    return code

def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES)
    payload = {"sub": email, "purpose": "pwd_reset", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_password_reset_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "pwd_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid reset token")
        return str(email)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")


# ---------------- DEPENDENCIES ----------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    ensure_user_can_auth(user)
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


# ---------------- ROUTES ----------------

@router.post("/signup", status_code=201)
def signup(
    user_in: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    - New email -> create user + send code.
    - Existing but unverified -> resend code (after cooldown) + update name/password.
    - Existing and verified -> block.
    """
    ip = get_client_ip(request)
    enforce_rate_limit("signup_ip", request, ip, RL_SIGNUP_IP_LIMIT, RL_SIGNUP_IP_WINDOW)

    existing = get_user_by_email(db, _norm_email(user_in.email))

    if existing:
        # Verified = no active verification code stored (we clear it after verify)
        if not existing.verification_code:
            raise HTTPException(status_code=400, detail="Email already registered")

        existing.name = user_in.name
        existing.hashed_password = get_password_hash(user_in.password)

        code = issue_verification_code(existing, enforce_cooldown=True)
        db.commit()
        db.refresh(existing)

        background_tasks.add_task(
            send_verification_code_email,
            existing.email,
            existing.name,
            code,
            VERIFICATION_CODE_TTL_MINUTES,
        )
        return {"detail": "Verification code re-sent. Please check your email."}

    user = models.User(
        name=user_in.name,
        email=_norm_email(user_in.email),
        hashed_password=get_password_hash(user_in.password),
        is_active=True,
        is_admin=False,
        is_blacklisted=False,
    )

    code = issue_verification_code(user, enforce_cooldown=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(
        send_verification_code_email,
        user.email,
        user.name,
        code,
        VERIFICATION_CODE_TTL_MINUTES,
    )

    return {"detail": "User created. Verification code sent to email."}


@router.post("/verify-signup", response_model=schemas.Token)
def verify_signup(payload: schemas.VerifySignupIn, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email = _norm_email(payload.email)
    enforce_rate_limit(
        "verify_ip_email",
        request,
        f"{ip}:{email}",
        RL_VERIFY_IP_EMAIL_LIMIT,
        RL_VERIFY_IP_EMAIL_WINDOW,
    )

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.verification_code or not user.verification_expires_at:
        raise HTTPException(status_code=400, detail="No active verification code. Please sign up again.")

    now = datetime.utcnow()
    expires_at = _normalize_naive(user.verification_expires_at)

    if expires_at and expires_at < now:
        user.verification_code = None
        user.verification_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired. Please sign up again.")

    if user.verification_code != payload.code.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")

    user.verification_code = None
    user.verification_expires_at = None
    db.commit()

    access_token = create_access_token(data={"sub": user.email})
    return schemas.Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    email = _norm_email(form_data.username)

    # Two layers: per-IP and per-IP+email
    enforce_rate_limit("login_ip", request, ip, RL_LOGIN_IP_LIMIT, RL_LOGIN_IP_WINDOW)
    enforce_rate_limit(
        "login_ip_email",
        request,
        f"{ip}:{email}",
        RL_LOGIN_IP_EMAIL_LIMIT,
        RL_LOGIN_IP_EMAIL_WINDOW,
    )

    user = authenticate_user(db, email, form_data.password)
    if not user:
        # Keep error generic to avoid enumeration
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return schemas.Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ---------------- PASSWORD RESET ----------------
# NOTE: Stateless reset tokens (JWT) -> no DB migrations needed.

@router.post("/request-password-reset")
def request_password_reset(
    payload: dict,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Always returns 200 to avoid user enumeration.
    If user exists + allowed, email a reset token.
    payload expects: { "email": "..." }
    """
    ip = get_client_ip(request)
    enforce_rate_limit("pwd_reset_req_ip", request, ip, RL_PWD_RESET_REQ_IP_LIMIT, RL_PWD_RESET_REQ_IP_WINDOW)

    email = _norm_email(payload.get("email") or "")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Also rate-limit by IP+email to reduce targeted bombing
    enforce_rate_limit(
        "pwd_reset_req_ip_email",
        request,
        f"{ip}:{email}",
        RL_PWD_RESET_REQ_IP_EMAIL_LIMIT,
        RL_PWD_RESET_REQ_IP_EMAIL_WINDOW,
    )

    user = get_user_by_email(db, email)
    if user:
        try:
            ensure_user_can_auth(user)
            token = create_password_reset_token(user.email)

            if ENV == "development":
                print(f"[InsiderLibrary] Password reset token for {user.email}: {token}")

            background_tasks.add_task(
                send_password_reset_email,
                user.email,
                user.name or "there",
                token,
                PASSWORD_RESET_TOKEN_TTL_MINUTES,
            )
        except HTTPException:
            # Don't leak status. Still return success message.
            pass

    return {"detail": "If an account exists for that email, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: dict, request: Request, db: Session = Depends(get_db)):
    """
    payload expects: { "token": "...", "new_password": "..." }
    """
    ip = get_client_ip(request)
    enforce_rate_limit("pwd_reset_ip", request, ip, RL_PWD_RESET_IP_LIMIT, RL_PWD_RESET_IP_WINDOW)

    token = (payload.get("token") or "").strip()
    new_password = (payload.get("new_password") or "").strip()

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new_password are required")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = decode_password_reset_token(token)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    ensure_user_can_auth(user)

    user.hashed_password = get_password_hash(new_password)
    db.commit()

    return {"detail": "Password updated successfully. You can now log in."}
