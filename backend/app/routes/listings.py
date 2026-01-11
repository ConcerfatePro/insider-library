# backend/app/routes/listings.py
import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("/", response_model=List[schemas.ListingOut])
def list_listings(db: Session = Depends(get_db)):
  # public marketplace: published only
  return (
    db.query(models.Listing)
    .filter(models.Listing.file_path.isnot(None))
    .order_by(models.Listing.created_at.desc())
    .all()
  )


@router.get("/mine", response_model=List[schemas.ListingOut])
def list_my_listings(
  db: Session = Depends(get_db),
  current_user: models.User = Depends(get_current_user),
):
  return (
    db.query(models.Listing)
    .filter(models.Listing.owner_id == current_user.id)
    .order_by(models.Listing.created_at.desc())
    .all()
  )


@router.post("/", response_model=schemas.ListingOut)
def create_listing(
  listing: schemas.ListingCreate,
  db: Session = Depends(get_db),
  current_user: models.User = Depends(get_current_user),
):
  db_listing = models.Listing(
    title=listing.title,
    description=listing.description,
    category=listing.category,
    price=listing.price,
    owner_id=current_user.id,
  )
  db.add(db_listing)
  db.commit()
  db.refresh(db_listing)
  return db_listing


@router.put("/{listing_id}", response_model=schemas.ListingOut)
def update_listing(
  listing_id: int,
  listing: schemas.ListingCreate,
  db: Session = Depends(get_db),
  current_user: models.User = Depends(get_current_user),
):
  db_listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
  if not db_listing:
    raise HTTPException(status_code=404, detail="Listing not found")

  if db_listing.owner_id != current_user.id and not current_user.is_admin:
    raise HTTPException(status_code=403, detail="Not allowed")

  db_listing.title = listing.title
  db_listing.description = listing.description
  db_listing.category = listing.category
  db_listing.price = listing.price

  db.commit()
  db.refresh(db_listing)
  return db_listing


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
    fp = Path(db_listing.file_path)
    if fp.exists():
      fp.unlink()

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

  if listing.file_path:
    raise HTTPException(status_code=400, detail="This listing already has a file attached.")

  if file.content_type != "application/pdf":
    raise HTTPException(status_code=400, detail="Only PDF files are allowed")

  data = await file.read()
  if len(data) > MAX_UPLOAD_BYTES:
    raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_MB} MB)")

  filename = f"listing_{listing_id}.pdf"
  file_location = UPLOAD_DIR / filename

  with file_location.open("wb") as buffer:
    buffer.write(data)

  listing.file_path = str(file_location)
  db.commit()
  db.refresh(listing)
  return listing


# 🔒 REQUIRE LOGIN TO DOWNLOAD
@router.get("/{listing_id}/download")
def download_listing_file(
  listing_id: int,
  db: Session = Depends(get_db),
  current_user: models.User = Depends(get_current_user),
):
  listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
  if not listing or not listing.file_path:
    raise HTTPException(status_code=404, detail="File not found")

  # If later you add purchases, enforce purchase check here.
  # For now: logged-in users can download published packs.
  if listing.file_path is None:
    raise HTTPException(status_code=404, detail="File not found")

  file_path = Path(listing.file_path)
  if not file_path.exists():
    raise HTTPException(status_code=404, detail="File missing on server")

  return FileResponse(
    path=file_path,
    filename=file_path.name,
    media_type="application/pdf",
    headers={"Cache-Control": "no-store"},
  )
