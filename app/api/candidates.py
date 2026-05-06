from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.candidates import Candidate, CandidateStatus, SecurityLevel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/candidates", tags=["candidates"])


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
    db: Session = Depends(get_db),
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


@router.get("/{candidate_id}")
async def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
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
