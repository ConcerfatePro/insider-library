# backend/app/schemas.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

# ---------- users/auth ----------

class UserCreate(BaseModel):
  name: str
  email: EmailStr
  password: str


class UserOut(BaseModel):
  id: int
  name: str
  email: EmailStr
  is_active: bool
  is_admin: bool
  is_blacklisted: bool
  created_at: datetime

  class Config:
    from_attributes = True


class Token(BaseModel):
  access_token: str
  token_type: str = "bearer"


class VerifySignupIn(BaseModel):
  email: EmailStr
  code: str


# ---------- listings ----------

class ListingBase(BaseModel):
  title: str
  description: str
  category: str
  price: float = 0.0


class ListingCreate(ListingBase):
  pass


class ListingOut(ListingBase):
  id: int
  created_at: datetime
  file_path: Optional[str] = None
  owner_id: Optional[int] = None

  class Config:
    from_attributes = True


# Keep old name too if you used it elsewhere
Listing = ListingOut


# ---------- reviews ----------

class ReviewBase(BaseModel):
  rating: int
  text: str


class ReviewCreate(ReviewBase):
  pass


class ReviewOut(ReviewBase):
  id: int
  listing_id: int
  created_at: datetime
  author_id: Optional[int] = None

  class Config:
    from_attributes = True


Review = ReviewOut
