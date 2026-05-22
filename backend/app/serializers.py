from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas
from .utils import listing_is_free, listing_price_cents, user_has_access


def _owner_name(db: Session, owner_id: Optional[int]) -> Optional[str]:
    if not owner_id:
        return None
    u = db.query(models.User).filter(models.User.id == owner_id).first()
    return u.name if u else None


def rating_stats(db: Session, listing_id: int) -> tuple[Optional[float], int]:
    row = (
        db.query(func.avg(models.Review.rating), func.count(models.Review.id))
        .filter(models.Review.listing_id == listing_id)
        .first()
    )
    avg, count = row[0], int(row[1] or 0)
    return (round(float(avg), 1) if avg is not None else None, count)


def listing_to_out(
    db: Session,
    listing: models.Listing,
    *,
    current_user: Optional[models.User] = None,
) -> schemas.ListingOut:
    avg, review_count = rating_stats(db, listing.id)
    short = listing.short_description or listing.description or ""
    long_desc = listing.long_description or listing.description or ""

    has_access = False
    user_review_id = None
    if current_user:
        if listing.owner_id == current_user.id or current_user.is_admin:
            has_access = True
        else:
            has_access = user_has_access(db, current_user.id, listing.id)
        rev = (
            db.query(models.Review)
            .filter(
                models.Review.listing_id == listing.id,
                models.Review.author_id == current_user.id,
            )
            .first()
        )
        if rev:
            user_review_id = rev.id

    return schemas.ListingOut(
        id=listing.id,
        slug=listing.slug,
        title=listing.title,
        description=short,
        short_description=short,
        long_description=long_desc,
        category=listing.category,
        tags=listing.tags or "",
        price=float(listing.price or 0),
        price_cents=listing_price_cents(listing),
        is_free=listing_is_free(listing),
        file_path=listing.file_path,
        original_filename=listing.original_filename,
        file_size=listing.file_size,
        mime_type=listing.mime_type,
        status=listing.status or "draft",
        owner_id=listing.owner_id,
        owner_name=_owner_name(db, listing.owner_id),
        download_count=listing.download_count or 0,
        average_rating=avg,
        review_count=review_count,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        published_at=listing.published_at,
        has_access=has_access,
        user_review_id=user_review_id,
    )
