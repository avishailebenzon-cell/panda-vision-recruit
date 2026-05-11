from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.agent_tasks import AgentLog
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
@router.get("/")
async def get_system_logs(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    agent_type: Optional[str] = Query(None),
):
    try:
        query = db.query(AgentLog)
        if agent_type:
            query = query.filter(AgentLog.agent_type == agent_type)
        total = query.count()
        logs = query.order_by(AgentLog.created_at.desc()).offset(skip).limit(limit).all()
        return {
            "total": total,
            "logs": [
                {
                    "id": l.id,
                    "task_id": l.task_id,
                    "agent_type": l.agent_type,
                    "message_type": l.message_type,
                    "sender": l.sender,
                    "content": l.content[:500],
                    "tokens_used": l.tokens_used,
                    "model_used": l.model_used,
                    "created_at": l.created_at.isoformat(),
                }
                for l in logs
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch logs")
