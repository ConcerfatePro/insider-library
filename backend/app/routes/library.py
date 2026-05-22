from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user
from ..serializers import listing_to_out

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/me", response_model=List[schemas.LibraryItemOut])
def my_library(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    downloads = (
        db.query(models.Download)
        .filter(models.Download.user_id == current_user.id)
        .order_by(models.Download.downloaded_at.desc())
        .all()
    )
    purchases = (
        db.query(models.Purchase)
        .filter(models.Purchase.user_id == current_user.id)
        .order_by(models.Purchase.purchased_at.desc())
        .all()
    )

    seen = {}
    term = q.strip().lower()

    for d in downloads:
        listing = db.query(models.Listing).filter(models.Listing.id == d.listing_id).first()
        if not listing:
            continue
        if term and term not in (listing.title or "").lower() and term not in (listing.short_description or "").lower():
            continue
        rev = (
            db.query(models.Review)
            .filter(
                models.Review.listing_id == listing.id,
                models.Review.author_id == current_user.id,
            )
            .first()
        )
        seen[listing.id] = schemas.LibraryItemOut(
            listing=listing_to_out(db, listing, current_user=current_user),
            downloaded_at=d.downloaded_at,
            has_reviewed=rev is not None,
        )

    for p in purchases:
        if p.listing_id in seen:
            item = seen[p.listing_id]
            item.purchased_at = p.purchased_at
            continue
        listing = db.query(models.Listing).filter(models.Listing.id == p.listing_id).first()
        if not listing:
            continue
        if term and term not in (listing.title or "").lower():
            continue
        rev = (
            db.query(models.Review)
            .filter(
                models.Review.listing_id == listing.id,
                models.Review.author_id == current_user.id,
            )
            .first()
        )
        seen[listing.id] = schemas.LibraryItemOut(
            listing=listing_to_out(db, listing, current_user=current_user),
            purchased_at=p.purchased_at,
            has_reviewed=rev is not None,
        )

    return list(seen.values())
