# backend/app/routes/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=List[schemas.UserOut])
def admin_get_users(
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  return db.query(models.User).order_by(models.User.id.asc()).all()


@router.post("/users/{user_id}/blacklist", response_model=schemas.UserOut)
def admin_blacklist_user(
  user_id: int,
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  if user.is_admin:
    raise HTTPException(status_code=400, detail="Cannot blacklist an admin user")

  user.is_blacklisted = True
  user.is_active = False
  db.commit()
  db.refresh(user)
  return user


@router.post("/users/{user_id}/unblacklist", response_model=schemas.UserOut)
def admin_unblacklist_user(
  user_id: int,
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  if user.is_admin:
    raise HTTPException(status_code=400, detail="Admins should not be blacklisted")

  user.is_blacklisted = False
  user.is_active = True
  db.commit()
  db.refresh(user)
  return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
  user_id: int,
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  user = db.query(models.User).filter(models.User.id == user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  if user.id == admin_user.id:
    raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
  if user.is_admin:
    raise HTTPException(status_code=400, detail="Cannot delete other admin accounts")

  db.delete(user)
  db.commit()
  return None


@router.get("/listings", response_model=List[schemas.ListingOut])
def admin_get_listings(
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  return db.query(models.Listing).order_by(models.Listing.created_at.desc()).all()


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_listing(
  listing_id: int,
  db: Session = Depends(get_db),
  admin_user: models.User = Depends(get_current_admin_user),
):
  listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
  if not listing:
    raise HTTPException(status_code=404, detail="Listing not found")

  db.delete(listing)
  db.commit()
  return None
