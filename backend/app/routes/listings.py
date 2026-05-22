# backend/app/routes/listings.py
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, get_optional_user
from ..serializers import listing_to_out
from ..utils import (
    ensure_unique_slug,
    listing_is_free,
    listing_price_cents,
    log_activity,
    record_download,
    resolve_upload_path,
    safe_upload_name,
    slugify,
    user_has_access,
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

router = APIRouter(prefix="/listings", tags=["listings"])


def _apply_listing_fields(db_listing: models.Listing, data: schemas.ListingCreate | schemas.ListingUpdate) -> None:
    short = (data.short_description or data.description or "").strip()
    if not short:
        raise HTTPException(status_code=400, detail="Short description is required")
    db_listing.title = data.title.strip()
    db_listing.description = short
    db_listing.short_description = short
    db_listing.long_description = (data.long_description or short).strip()
    db_listing.category = data.category.strip()
    db_listing.tags = (data.tags or "").strip()
    cents = data.price_cents
    if cents is None:
        cents = int(round(float(data.price or 0) * 100))
    db_listing.price_cents = max(0, int(cents))
    db_listing.price = db_listing.price_cents / 100.0
    db_listing.updated_at = datetime.utcnow()


def _safe_filename(title: str, listing_id: int) -> str:
    base = re.sub(r"[^a-zA-Z0-9 _-]+", "", (title or "").strip())
    base = re.sub(r"\s+", "_", base)[:80]
    return f"{base or f'listing_{listing_id}'}.pdf"


@router.get("/", response_model=List[schemas.ListingOut])
def list_listings(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    free_only: Optional[bool] = Query(None),
    paid_only: Optional[bool] = Query(None),
    sort: str = Query("newest"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    query = db.query(models.Listing).filter(models.Listing.status == "published")

    if category:
        query = query.filter(models.Listing.category == category)

    if q:
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                models.Listing.title.ilike(term),
                models.Listing.short_description.ilike(term),
                models.Listing.long_description.ilike(term),
                models.Listing.tags.ilike(term),
            )
        )

    rows = query.all()

    if free_only:
        rows = [r for r in rows if listing_is_free(r)]
    if paid_only:
        rows = [r for r in rows if not listing_is_free(r)]

    if sort == "downloads":
        rows.sort(key=lambda x: x.download_count or 0, reverse=True)
    elif sort == "oldest":
        rows.sort(key=lambda x: x.created_at)
    elif sort == "rating":
        out = [listing_to_out(db, r, current_user=current_user) for r in rows]
        out.sort(key=lambda x: x.average_rating or 0, reverse=True)
        return out
    else:
        rows.sort(key=lambda x: x.published_at or x.created_at, reverse=True)

    return [listing_to_out(db, r, current_user=current_user) for r in rows]


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Listing.category)
        .filter(models.Listing.status == "published")
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows if r[0]})


@router.get("/mine", response_model=List[schemas.ListingOut])
def list_my_listings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.Listing)
        .filter(models.Listing.owner_id == current_user.id)
        .order_by(models.Listing.updated_at.desc())
        .all()
    )
    return [listing_to_out(db, r, current_user=current_user) for r in rows]


@router.get("/activity/me", response_model=schemas.ActivityOut)
def my_activity(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listings = (
        db.query(models.Listing)
        .filter(models.Listing.owner_id == current_user.id)
        .order_by(models.Listing.updated_at.desc())
        .limit(8)
        .all()
    )

    reviews = (
        db.query(models.Review)
        .join(models.Listing, models.Review.listing_id == models.Listing.id)
        .filter(models.Listing.owner_id == current_user.id)
        .order_by(models.Review.created_at.desc())
        .limit(8)
        .all()
    )

    from ..serializers import listing_to_out as lto, rating_stats

    review_out = []
    for r in reviews:
        author = db.query(models.User).filter(models.User.id == r.author_id).first()
        review_out.append(
            schemas.ReviewOut(
                id=r.id,
                listing_id=r.listing_id,
                rating=r.rating,
                text=r.text or "",
                created_at=r.created_at,
                author_id=r.author_id,
                author_name=author.name if author else None,
                verified=bool(r.verified),
            )
        )

    downloads = (
        db.query(models.Download)
        .filter(models.Download.user_id == current_user.id)
        .order_by(models.Download.downloaded_at.desc())
        .limit(8)
        .all()
    )
    recent_downloads = []
    for d in downloads:
        listing = db.query(models.Listing).filter(models.Listing.id == d.listing_id).first()
        if listing:
            recent_downloads.append(
                {
                    "listing_id": listing.id,
                    "title": listing.title,
                    "downloaded_at": d.downloaded_at.isoformat() if d.downloaded_at else None,
                }
            )

    purchases = (
        db.query(models.Purchase)
        .filter(models.Purchase.user_id == current_user.id)
        .order_by(models.Purchase.purchased_at.desc())
        .limit(8)
        .all()
    )
    recent_purchases = []
    for p in purchases:
        listing = db.query(models.Listing).filter(models.Listing.id == p.listing_id).first()
        if listing:
            recent_purchases.append(
                {
                    "listing_id": listing.id,
                    "title": listing.title,
                    "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                }
            )

    published = [l for l in listings if l.status == "published"]
    drafts = [l for l in listings if l.status == "draft"]
    total_dl = sum(l.download_count or 0 for l in listings)

    ratings = []
    for l in listings:
        avg, _ = rating_stats(db, l.id)
        if avg:
            ratings.append(avg)

    stats = {
        "total_listings": len(listings),
        "published_listings": len(published),
        "draft_listings": len(drafts),
        "total_downloads": total_dl,
        "average_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
    }

    return schemas.ActivityOut(
        recent_listings=[lto(db, l, current_user=current_user) for l in listings[:6]],
        recent_reviews=review_out,
        recent_downloads=recent_downloads,
        recent_purchases=recent_purchases,
        stats=stats,
    )


@router.get("/by-slug/{slug}", response_model=schemas.ListingOut)
def get_listing_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    listing = db.query(models.Listing).filter(models.Listing.slug == slug).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != "published":
        if not current_user or (
            listing.owner_id != current_user.id and not current_user.is_admin
        ):
            raise HTTPException(status_code=404, detail="Listing not found")
    return listing_to_out(db, listing, current_user=current_user)


@router.get("/{listing_id}", response_model=schemas.ListingOut)
def get_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.status != "published":
        if not current_user or (
            listing.owner_id != current_user.id and not current_user.is_admin
        ):
            raise HTTPException(status_code=404, detail="Listing not found")
    return listing_to_out(db, listing, current_user=current_user)


@router.post("/", response_model=schemas.ListingOut, status_code=201)
def create_listing(
    listing: schemas.ListingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if listing.owner_confirmed is False and listing.status == "published":
        raise HTTPException(
            status_code=400,
            detail="You must confirm ownership and rights before publishing.",
        )

    db_listing = models.Listing(
        owner_id=current_user.id,
        status=listing.status or "draft",
        owner_confirmed=bool(listing.owner_confirmed),
    )
    _apply_listing_fields(db_listing, listing)
    db.add(db_listing)
    db.commit()
    db.refresh(db_listing)

    base_slug = slugify(db_listing.title, db_listing.id)
    db_listing.slug = ensure_unique_slug(db, base_slug, db_listing.id)
    db.commit()
    db.refresh(db_listing)

    log_activity(db, current_user.id, "listing_created", db_listing.id)
    return listing_to_out(db, db_listing, current_user=current_user)


@router.put("/{listing_id}", response_model=schemas.ListingOut)
def update_listing(
    listing_id: int,
    listing: schemas.ListingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not db_listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if db_listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    _apply_listing_fields(db_listing, listing)
    if listing.status:
        db_listing.status = listing.status
    if listing.owner_confirmed:
        db_listing.owner_confirmed = True

    base_slug = slugify(db_listing.title, db_listing.id)
    db_listing.slug = ensure_unique_slug(db, base_slug, db_listing.id)
    db.commit()
    db.refresh(db_listing)
    return listing_to_out(db, db_listing, current_user=current_user)


@router.post("/{listing_id}/publish", response_model=schemas.ListingOut)
def publish_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")
    if not listing.file_path:
        raise HTTPException(status_code=400, detail="Attach a PDF before publishing")
    if not listing.owner_confirmed:
        raise HTTPException(status_code=400, detail="Legal confirmation required before publishing")

    listing.status = "published"
    listing.published_at = datetime.utcnow()
    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)
    log_activity(db, current_user.id, "listing_published", listing.id)
    return listing_to_out(db, listing, current_user=current_user)


@router.post("/{listing_id}/unpublish", response_model=schemas.ListingOut)
def unpublish_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    listing.status = "draft"
    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)
    return listing_to_out(db, listing, current_user=current_user)


@router.post("/{listing_id}/archive", response_model=schemas.ListingOut)
def archive_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    listing.status = "archived"
    listing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(listing)
    return listing_to_out(db, listing, current_user=current_user)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not db_listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if db_listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    if db_listing.file_path:
        try:
            fp = resolve_upload_path(UPLOAD_DIR, Path(db_listing.file_path).name)
            if fp.exists():
                fp.unlink()
        except (ValueError, OSError):
            pass

    db.delete(db_listing)
    db.commit()
    return None


@router.post("/{listing_id}/upload", response_model=schemas.ListingOut)
async def upload_listing_file(
    listing_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to modify this listing")

    content_type = (file.content_type or "").lower()
    if content_type not in ("application/pdf", "application/x-pdf", "binary/octet-stream"):
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    data = await file.read()
    if len(data) < 4 or data[:4] != b"%PDF":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_MB} MB)")

    if listing.file_path:
        try:
            old = resolve_upload_path(UPLOAD_DIR, Path(listing.file_path).name)
            if old.exists():
                old.unlink()
        except (ValueError, OSError):
            pass

    stored = safe_upload_name()
    file_location = UPLOAD_DIR / stored
    with file_location.open("wb") as buffer:
        buffer.write(data)

    listing.file_path = stored
    listing.original_filename = file.filename or "document.pdf"
    listing.file_size = len(data)
    listing.mime_type = "application/pdf"
    listing.updated_at = datetime.utcnow()
    if listing.status == "draft" and listing.owner_confirmed:
        pass  # stays draft until explicit publish

    db.commit()
    db.refresh(listing)
    return listing_to_out(db, listing, current_user=current_user)


@router.post("/{listing_id}/purchase", response_model=schemas.PurchaseOut)
def purchase_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Record a purchase (payment gateway integration is a future TODO)."""
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing or listing.status != "published":
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing_is_free(listing):
        raise HTTPException(status_code=400, detail="This listing is free — use download instead")
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You already own this listing")

    existing = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.user_id == current_user.id,
            models.Purchase.listing_id == listing_id,
        )
        .first()
    )
    if not existing:
        db.add(
            models.Purchase(
                user_id=current_user.id,
                listing_id=listing_id,
                amount_cents=listing_price_cents(listing),
            )
        )
        db.commit()

    log_activity(db, current_user.id, "purchase", listing_id)
    return schemas.PurchaseOut(detail="Purchase recorded", listing_id=listing_id)


@router.get("/{listing_id}/download")
def download_listing_file(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing or not listing.file_path:
        raise HTTPException(status_code=404, detail="File not found")

    if listing.status not in ("published",) and listing.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Listing is not available for download")

    is_owner = listing.owner_id == current_user.id
    is_admin = current_user.is_admin
    is_free = listing_is_free(listing)
    has_purchase = user_has_access(db, current_user.id, listing_id)

    if not is_owner and not is_admin:
        if not is_free:
            pr = (
                db.query(models.Purchase)
                .filter(
                    models.Purchase.user_id == current_user.id,
                    models.Purchase.listing_id == listing_id,
                )
                .first()
            )
            if not pr:
                raise HTTPException(
                    status_code=403,
                    detail="Purchase required before downloading this pack",
                )

    try:
        file_path = resolve_upload_path(UPLOAD_DIR, Path(listing.file_path).name)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid file path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File missing on server")

    if not is_owner and not is_admin:
        record_download(db, current_user.id, listing_id)
        log_activity(db, current_user.id, "download", listing_id)

    download_name = _safe_filename(listing.title, listing.id)
    return FileResponse(
        path=file_path,
        filename=listing.original_filename or download_name,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )
