from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, get_optional_user
from ..utils import user_has_access

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _review_out(db: Session, review: models.Review) -> schemas.ReviewOut:
    author = db.query(models.User).filter(models.User.id == review.author_id).first()
    return schemas.ReviewOut(
        id=review.id,
        listing_id=review.listing_id,
        rating=review.rating,
        text=review.text or "",
        created_at=review.created_at,
        updated_at=review.updated_at,
        author_id=review.author_id,
        author_name=author.name if author else None,
        verified=bool(review.verified),
    )


@router.get("/{listing_id}", response_model=List[schemas.ReviewOut])
def get_reviews(
    listing_id: int,
    db: Session = Depends(get_db),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    reviews = (
        db.query(models.Review)
        .filter(models.Review.listing_id == listing_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )
    return [_review_out(db, r) for r in reviews]


@router.post("/{listing_id}", response_model=schemas.ReviewOut)
def create_review(
    listing_id: int,
    review_in: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot review your own listing")

    if listing.status != "published":
        raise HTTPException(status_code=400, detail="Cannot review unpublished listings")

    if not user_has_access(db, current_user.id, listing_id):
        raise HTTPException(
            status_code=403,
            detail="Verified reviews require downloading or purchasing this pack first",
        )

    existing = (
        db.query(models.Review)
        .filter(
            models.Review.listing_id == listing_id,
            models.Review.author_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already reviewed this listing. Use PUT to update your review.",
        )

    if review_in.rating < 1 or review_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    db_review = models.Review(
        listing_id=listing_id,
        rating=review_in.rating,
        text=(review_in.text or "").strip(),
        author_id=current_user.id,
        verified=True,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return _review_out(db, db_review)


@router.put("/{listing_id}/mine", response_model=schemas.ReviewOut)
def update_my_review(
    listing_id: int,
    review_in: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    review = (
        db.query(models.Review)
        .filter(
            models.Review.listing_id == listing_id,
            models.Review.author_id == current_user.id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review_in.rating < 1 or review_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    from datetime import datetime

    review.rating = review_in.rating
    review.text = (review_in.text or "").strip()
    review.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(review)
    return _review_out(db, review)


@router.delete("/item/{review_id}", status_code=204)
def admin_delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return None
