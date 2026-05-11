from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.agent_tasks import FeedbackLog
from app.models.matches import Match
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/")
async def submit_feedback(data: dict, db: Session = Depends(get_db)):
    try:
        match_id = data.get("match_id")
        if not match_id:
            raise HTTPException(status_code=400, detail="match_id required")

        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        feedback = FeedbackLog(
            match_id=match_id,
            was_correct=data.get("was_correct", False),
            feedback_text=data.get("feedback_text", ""),
            agent_type=match.agent_name,
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return {"status": "submitted", "id": feedback.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")
