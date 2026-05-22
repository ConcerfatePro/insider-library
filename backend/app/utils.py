import re
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from . import models

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify(title: str, listing_id: Optional[int] = None) -> str:
    base = (title or "pack").lower().strip()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:60]
    if not base:
        base = "pack"
    if listing_id is not None:
        return f"{base}-{listing_id}"
    return base


def ensure_unique_slug(db: Session, base_slug: str, listing_id: Optional[int] = None) -> str:
    slug = base_slug
    n = 0
    while True:
        q = db.query(models.Listing).filter(models.Listing.slug == slug)
        if listing_id:
            q = q.filter(models.Listing.id != listing_id)
        if not q.first():
            return slug
        n += 1
        slug = f"{base_slug}-{n}"


def safe_upload_name() -> str:
    return f"{uuid.uuid4().hex}.pdf"


def resolve_upload_path(upload_dir: Path, stored_name: str) -> Path:
    """Prevent path traversal — only allow files directly under upload_dir."""
    base = upload_dir.resolve()
    candidate = (upload_dir / stored_name).resolve()
    if candidate.parent != base:
        raise ValueError("Invalid file path")
    return candidate


def listing_is_free(listing: models.Listing) -> bool:
    if listing.price_cents is not None:
        return int(listing.price_cents) == 0
    return float(listing.price or 0) == 0


def listing_price_cents(listing: models.Listing) -> int:
    if listing.price_cents is not None:
        return int(listing.price_cents)
    return int(round(float(listing.price or 0) * 100))


def user_has_access(db: Session, user_id: int, listing_id: int) -> bool:
    dl = (
        db.query(models.Download)
        .filter(
            models.Download.user_id == user_id,
            models.Download.listing_id == listing_id,
        )
        .first()
    )
    if dl:
        return True
    pr = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.user_id == user_id,
            models.Purchase.listing_id == listing_id,
        )
        .first()
    )
    return pr is not None


def record_download(db: Session, user_id: int, listing_id: int) -> None:
    existing = (
        db.query(models.Download)
        .filter(
            models.Download.user_id == user_id,
            models.Download.listing_id == listing_id,
        )
        .first()
    )
    if not existing:
        db.add(models.Download(user_id=user_id, listing_id=listing_id))
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if listing:
        listing.download_count = (listing.download_count or 0) + 1
    db.commit()


def log_activity(db: Session, user_id: Optional[int], action: str, listing_id: Optional[int] = None, meta: str = "") -> None:
    db.add(
        models.ActivityLog(
            user_id=user_id,
            action=action,
            listing_id=listing_id,
            meta=meta or None,
        )
    )
    db.commit()
