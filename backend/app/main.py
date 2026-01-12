# backend/app/main.py
import os

from dotenv import load_dotenv
load_dotenv()  # ✅ must be before importing modules that read env vars

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .db import engine, Base
from .routes import listings, reviews, admin
from . import auth

Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS
cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
  allow_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
  # dev default
  allow_origins = ["http://127.0.0.1:5173", "http://localhost:5173"]

app.add_middleware(
  CORSMiddleware,
  allow_origins=allow_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Basic security headers middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
  res = await call_next(request)
  res.headers["X-Content-Type-Options"] = "nosniff"
  res.headers["X-Frame-Options"] = "DENY"
  res.headers["Referrer-Policy"] = "no-referrer"
  res.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
  return res

app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(reviews.router)
app.include_router(admin.router)
