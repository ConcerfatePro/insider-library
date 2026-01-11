from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)


@router.get("/{listing_id}", response_model=List[schemas.Review])
def get_reviews(
    listing_id: int,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(models.Listing)
        .filter(models.Listing.id == listing_id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    reviews = (
        db.query(models.Review)
        .filter(models.Review.listing_id == listing_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )
    return reviews


@router.post("/{listing_id}", response_model=schemas.Review)
def create_review(
    listing_id: int,
    review_in: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = (
        db.query(models.Listing)
        .filter(models.Listing.id == listing_id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if review_in.rating < 1 or review_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    db_review = models.Review(
        listing_id=listing_id,
        rating=review_in.rating,
        text=review_in.text,
        author_id=current_user.id,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review
