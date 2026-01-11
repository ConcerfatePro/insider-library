# backend/app/auth.py
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db

# ---------------- config ----------------

ENV = os.getenv("ENV", "development")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
  if ENV == "development":
    # dev fallback only
    SECRET_KEY = "dev-only-secret-change-me"
  else:
    raise RuntimeError("SECRET_KEY env var is required in production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

VERIFICATION_CODE_TTL_MINUTES = int(os.getenv("VERIFICATION_CODE_TTL_MINUTES", "15"))

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------- helpers ----------------

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
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="User is inactive or blacklisted",
    )

def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
  user = get_user_by_email(db, email)
  if not user:
    return None
  ensure_user_can_auth(user)
  if not verify_password(password, user.hashed_password):
    return None
  return user

# ---------------- dependencies ----------------

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

# ---------------- routes ----------------

@router.post("/signup", status_code=201)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
  existing = get_user_by_email(db, user_in.email)
  if existing:
    raise HTTPException(status_code=400, detail="Email already registered")

  user = models.User(
    name=user_in.name,
    email=user_in.email,
    hashed_password=get_password_hash(user_in.password),
    is_active=True,
    is_admin=False,
    is_blacklisted=False,
  )

  # create verification code
  code = f"{random.randint(0, 999999):06d}"
  user.verification_code = code
  user.verification_expires_at = datetime.utcnow() + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES)

  db.add(user)
  db.commit()
  db.refresh(user)

  # dev-only "email"
  print(f"[InsiderLibrary] Verification code for {user.email}: {code}")

  return {"detail": "User created. Verification code sent to email."}


@router.post("/verify-signup", response_model=schemas.Token)
def verify_signup(payload: schemas.VerifySignupIn, db: Session = Depends(get_db)):
  user = get_user_by_email(db, payload.email)
  if not user:
    raise HTTPException(status_code=404, detail="User not found")

  if not user.verification_code or not user.verification_expires_at:
    raise HTTPException(status_code=400, detail="No active verification code. Please sign up again.")

  now = datetime.utcnow()

  expires_at = user.verification_expires_at
  # normalize just in case anything old had tzinfo set
  if expires_at is not None and expires_at.tzinfo is not None:
    expires_at = expires_at.replace(tzinfo=None)

  if expires_at and expires_at < now:
    user.verification_code = None
    user.verification_expires_at = None
    db.commit()
    raise HTTPException(status_code=400, detail="Verification code expired. Please sign up again.")

  if user.verification_code != payload.code.strip():
    raise HTTPException(status_code=400, detail="Invalid verification code")

  # verified — clear code
  user.verification_code = None
  user.verification_expires_at = None
  db.commit()

  access_token = create_access_token(data={"sub": user.email})
  return schemas.Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
  email = form_data.username
  user = authenticate_user(db, email, form_data.password)
  if not user:
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
