# backend/app/models.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .db import Base


class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, nullable=False)
  email = Column(String, unique=True, index=True, nullable=False)
  hashed_password = Column(String, nullable=False)

  # account status
  is_active = Column(Boolean, default=True)
  is_admin = Column(Boolean, default=False)
  is_blacklisted = Column(Boolean, default=False)

  # signup verification (persisted, not in-memory)
  verification_code = Column(String, nullable=True)
  verification_expires_at = Column(DateTime, nullable=True)

  created_at = Column(DateTime, default=datetime.utcnow)

  listings = relationship("Listing", back_populates="owner")
  reviews = relationship("Review", back_populates="author")


class Listing(Base):
  __tablename__ = "listings"

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String, nullable=False)
  description = Column(String, nullable=False)
  category = Column(String, nullable=False)
  price = Column(Float, default=0.0)
  file_path = Column(String, nullable=True)
  created_at = Column(DateTime, default=datetime.utcnow)

  owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
  owner = relationship("User", back_populates="listings")

  reviews = relationship("Review", back_populates="listing")


class Review(Base):
  __tablename__ = "reviews"

  id = Column(Integer, primary_key=True, index=True)
  listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
  rating = Column(Integer, nullable=False)
  text = Column(String, nullable=False)
  created_at = Column(DateTime, default=datetime.utcnow)

  author_id = Column(Integer, ForeignKey("users.id"), nullable=True)

  listing = relationship("Listing", back_populates="reviews")
  author = relationship("User", back_populates="reviews")
