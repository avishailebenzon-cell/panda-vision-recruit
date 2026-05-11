from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.matches import Match, MatchStatus
from app.models.candidates import Candidate
from app.models.jobs import Job
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/")
async def get_matches(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None),
    agent_name: Optional[str] = Query(None),
    job_id: Optional[int] = Query(None),
    candidate_id: Optional[int] = Query(None),
):
    try:
        query = db.query(Match).join(Candidate, Match.candidate_id == Candidate.id).join(Job, Match.job_id == Job.id)

        if status:
            query = query.filter(Match.status == status)
        if agent_name:
            query = query.filter(Match.agent_name == agent_name)
        if job_id:
            query = query.filter(Match.job_id == job_id)
        if candidate_id:
            query = query.filter(Match.candidate_id == candidate_id)

        total = query.count()
        matches = query.order_by(Match.created_at.desc()).offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "matches": [
                {
                    "id": m.id,
                    "candidate_id": m.candidate_id,
                    "candidate_name": f"{m.candidate.first_name} {m.candidate.last_name}",
                    "candidate_email": m.candidate.email,
                    "job_id": m.job_id,
                    "job_title": m.job.title,
                    "agent_name": m.agent_name,
                    "match_score": m.match_score,
                    "summary": m.summary,
                    "agent_reasoning": m.summary,
                    "status": m.status,
                    "admin_approved": m.admin_approved,
                    "security_level": m.candidate.security_level,
                    "cv_age_warning": False,
                    "created_at": m.created_at.isoformat(),
                    "updated_at": m.updated_at.isoformat(),
                }
                for m in matches
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch matches")


@router.get("/{match_id}")
async def get_match(match_id: int, db: Session = Depends(get_db)):
    try:
        m = db.query(Match).filter(Match.id == match_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Match not found")
        return {
            "id": m.id,
            "candidate_id": m.candidate_id,
            "job_id": m.job_id,
            "agent_name": m.agent_name,
            "match_score": m.match_score,
            "summary": m.summary,
            "status": m.status,
            "admin_approved": m.admin_approved,
            "admin_notes": m.admin_notes,
            "created_at": m.created_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match {match_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch match")


@router.patch("/{match_id}")
async def update_match(match_id: int, data: dict, db: Session = Depends(get_db)):
    try:
        m = db.query(Match).filter(Match.id == match_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Match not found")
        allowed = {"status", "admin_approved", "admin_notes", "approved_by"}
        for key, val in data.items():
            if key in allowed:
                setattr(m, key, val)
        db.commit()
        return {"status": "updated", "id": match_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating match {match_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update match")
