from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db_sync
from app.models.candidates import Candidate, CandidateStatus, SecurityLevel
import logging
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/candidates", tags=["candidates"])


class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class CandidateResponse:
    """Response schema for candidate."""
    def __init__(self, candidate: Candidate):
        self.id = candidate.id
        self.first_name = candidate.first_name
        self.last_name = candidate.last_name
        self.email = candidate.email
        self.phone = candidate.phone
        self.location = candidate.location
        self.security_level = candidate.security_level
        self.status = candidate.status
        self.email_received_date = candidate.email_received_date
        self.scanned_date = candidate.scanned_date


@router.get("/")
async def get_candidates(
    db: Session = Depends(get_db_sync),
    status: Optional[str] = Query(None, description="Filter by status: 'active' or 'deleted'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
):
    """
    Get list of candidates with optional filtering.
    Default returns only active candidates.
    """
    try:
        query = db.query(Candidate)

        # Default to active candidates if not specified
        if status is None:
            status = CandidateStatus.ACTIVE

        if status in [s.value for s in CandidateStatus]:
            query = query.filter(Candidate.status == status)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        total = query.count()
        candidates = query.offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "candidates": [
                {
                    "id": c.id,
                    "first_name": c.first_name,
                    "last_name": c.last_name,
                    "email": c.email,
                    "phone": c.phone,
                    "location": c.location,
                    "security_level": c.security_level.value,
                    "status": c.status.value,
                    "email_received_date": c.email_received_date.isoformat(),
                    "scanned_date": c.scanned_date.isoformat(),
                }
                for c in candidates
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching candidates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch candidates")


@router.post("/")
async def create_candidate(
    candidate_data: CandidateCreate,
    db: Session = Depends(get_db_sync),
):
    """Create a new candidate."""
    try:
        # Check if email already exists
        existing = db.query(Candidate).filter(Candidate.email == candidate_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

        candidate = Candidate(
            first_name=candidate_data.first_name,
            last_name=candidate_data.last_name,
            email=candidate_data.email,
            phone=candidate_data.phone,
            location=candidate_data.location,
            security_level=SecurityLevel.NO_SECURITY,
            status=CandidateStatus.ACTIVE,
            email_received_date=datetime.utcnow(),
            scanned_date=datetime.utcnow(),
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        return {
            "id": candidate.id,
            "first_name": candidate.first_name,
            "last_name": candidate.last_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,
            "security_level": candidate.security_level.value,
            "status": candidate.status.value,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating candidate: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create candidate")


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: int, db: Session = Depends(get_db_sync)):
    """Get a specific candidate by ID."""
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        return {
            "id": candidate.id,
            "first_name": candidate.first_name,
            "last_name": candidate.last_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,
            "security_level": candidate.security_level.value,
            "status": candidate.status.value,
            "resume_url": candidate.resume_url,
            "notes": candidate.notes,
            "email_received_date": candidate.email_received_date.isoformat(),
            "scanned_date": candidate.scanned_date.isoformat(),
            "created_at": candidate.created_at.isoformat(),
            "updated_at": candidate.updated_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching candidate {candidate_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch candidate")


@router.put("/{candidate_id}")
async def update_candidate(
    candidate_id: int,
    candidate_data: CandidateUpdate,
    db: Session = Depends(get_db_sync),
):
    """Update a candidate."""
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        if candidate_data.first_name:
            candidate.first_name = candidate_data.first_name
        if candidate_data.last_name:
            candidate.last_name = candidate_data.last_name
        if candidate_data.email:
            candidate.email = candidate_data.email
        if candidate_data.phone:
            candidate.phone = candidate_data.phone
        if candidate_data.location:
            candidate.location = candidate_data.location
        if candidate_data.notes:
            candidate.notes = candidate_data.notes

        candidate.scanned_date = datetime.utcnow()
        db.commit()
        db.refresh(candidate)

        return {
            "id": candidate.id,
            "first_name": candidate.first_name,
            "last_name": candidate.last_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "location": candidate.location,
            "security_level": candidate.security_level.value,
            "status": candidate.status.value,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating candidate {candidate_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update candidate")


@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db_sync),
):
    """Delete (soft delete) a candidate."""
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate.status = CandidateStatus.DELETED
        db.commit()

        return {"status": "success", "message": "Candidate deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting candidate {candidate_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete candidate")
