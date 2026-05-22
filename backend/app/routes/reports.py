from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_admin_user

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_REASONS = {
    "copyright",
    "illegal",
    "private_info",
    "malware",
    "spam",
    "other",
}


@router.post("/listing/{listing_id}", response_model=schemas.ReportOut, status_code=201)
def report_listing(
    listing_id: int,
    payload: schemas.ReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    reason = (payload.reason or "").strip().lower()
    if reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="Invalid report reason")

    report = models.Report(
        listing_id=listing_id,
        reporter_id=current_user.id,
        reason=reason,
        details=(payload.details or "").strip()[:2000],
        status="open",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return schemas.ReportOut(
        id=report.id,
        listing_id=report.listing_id,
        listing_title=listing.title,
        reporter_id=report.reporter_id,
        reporter_email=current_user.email,
        reason=report.reason,
        details=report.details,
        status=report.status,
        created_at=report.created_at,
    )


@router.get("/", response_model=List[schemas.ReportOut])
def list_reports(
    status: str = "open",
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    q = db.query(models.Report).order_by(models.Report.created_at.desc())
    if status:
        q = q.filter(models.Report.status == status)
    rows = q.limit(200).all()
    out = []
    for r in rows:
        listing = db.query(models.Listing).filter(models.Listing.id == r.listing_id).first()
        reporter = db.query(models.User).filter(models.User.id == r.reporter_id).first()
        out.append(
            schemas.ReportOut(
                id=r.id,
                listing_id=r.listing_id,
                listing_title=listing.title if listing else None,
                reporter_id=r.reporter_id,
                reporter_email=reporter.email if reporter else None,
                reason=r.reason,
                details=r.details,
                status=r.status,
                admin_notes=r.admin_notes,
                created_at=r.created_at,
            )
        )
    return out


@router.post("/{report_id}/resolve", response_model=schemas.ReportOut)
def resolve_report(
    report_id: int,
    payload: schemas.ReportResolveIn,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if payload.status not in ("dismissed", "resolved"):
        raise HTTPException(status_code=400, detail="Status must be dismissed or resolved")

    report.status = payload.status
    report.admin_notes = (payload.admin_notes or "").strip()[:2000]
    report.resolved_at = datetime.utcnow()

    listing = db.query(models.Listing).filter(models.Listing.id == report.listing_id).first()
    if payload.archive_listing and listing:
        listing.status = "rejected"
        listing.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    reporter = db.query(models.User).filter(models.User.id == report.reporter_id).first()
    return schemas.ReportOut(
        id=report.id,
        listing_id=report.listing_id,
        listing_title=listing.title if listing else None,
        reporter_id=report.reporter_id,
        reporter_email=reporter.email if reporter else None,
        reason=report.reason,
        details=report.details,
        status=report.status,
        admin_notes=report.admin_notes,
        created_at=report.created_at,
    )
