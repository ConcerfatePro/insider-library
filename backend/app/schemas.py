# backend/app/schemas.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


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
    category: str
    short_description: str = ""
    long_description: str = ""
    description: str = ""  # legacy alias
    tags: str = ""
    price: float = 0.0
    price_cents: Optional[int] = None
    owner_confirmed: bool = False


class ListingCreate(ListingBase):
    status: str = "draft"


class ListingUpdate(ListingBase):
    status: Optional[str] = None


class OwnerBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ListingOut(BaseModel):
    id: int
    slug: Optional[str] = None
    title: str
    description: str
    short_description: Optional[str] = None
    long_description: Optional[str] = None
    category: str
    tags: str = ""
    price: float = 0.0
    price_cents: int = 0
    is_free: bool = True
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    status: str = "draft"
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    download_count: int = 0
    average_rating: Optional[float] = None
    review_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    has_access: bool = False
    user_review_id: Optional[int] = None

    class Config:
        from_attributes = True


Listing = ListingOut


class ListingSearchParams(BaseModel):
    q: Optional[str] = None
    category: Optional[str] = None
    free_only: Optional[bool] = None
    paid_only: Optional[bool] = None
    sort: str = "newest"


class ActivityOut(BaseModel):
    recent_listings: List[ListingOut] = []
    recent_reviews: List["ReviewOut"] = []
    recent_downloads: List[dict] = []
    recent_purchases: List[dict] = []
    stats: dict = {}


class DashboardStats(BaseModel):
    total_listings: int = 0
    published_listings: int = 0
    draft_listings: int = 0
    total_downloads: int = 0
    average_rating: Optional[float] = None


# ---------- reviews ----------

class ReviewBase(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = ""


class ReviewCreate(ReviewBase):
    pass


class ReviewOut(ReviewBase):
    id: int
    listing_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    verified: bool = False

    class Config:
        from_attributes = True


Review = ReviewOut
ActivityOut.model_rebuild()


# ---------- library / purchases ----------

class LibraryItemOut(BaseModel):
    listing: ListingOut
    downloaded_at: Optional[datetime] = None
    purchased_at: Optional[datetime] = None
    has_reviewed: bool = False


class PurchaseOut(BaseModel):
    detail: str
    listing_id: int


# ---------- reports ----------

class ReportCreate(BaseModel):
    reason: str
    details: str = ""


class ReportOut(BaseModel):
    id: int
    listing_id: int
    listing_title: Optional[str] = None
    reporter_id: Optional[int] = None
    reporter_email: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportResolveIn(BaseModel):
    status: str
    admin_notes: str = ""
    archive_listing: bool = False
