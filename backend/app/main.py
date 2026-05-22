# backend/app/main.py
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import engine, Base
from .migrate import run_migrations
from .routes import listings, reviews, admin, library, reports
from . import auth

ENV = os.getenv("ENV", "development")

Base.metadata.create_all(bind=engine)
run_migrations(engine)

app = FastAPI(
    title="Insider Library",
    version="2.0.0",
    docs_url="/docs" if ENV == "development" else None,
    redoc_url=None,
)

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    allow_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    allow_origins = ["http://127.0.0.1:5173", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    res = await call_next(request)
    res.headers["X-Content-Type-Options"] = "nosniff"
    res.headers["X-Frame-Options"] = "DENY"
    res.headers["Referrer-Policy"] = "no-referrer"
    res.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if ENV != "development":
        res.headers["Content-Security-Policy"] = "default-src 'self'"
    return res


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    if ENV == "development":
        raise exc
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(reviews.router)
app.include_router(library.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
