from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.database import get_db_sync
from app.models.agent_tasks import AgentTask, AgentLog, FeedbackLog, AgentType, TaskStatus
from app.models.matches import Match
from app.agents.orchestrator_engine import OrchestratorEngine
from app.agents.watchdog import AgentWatchdog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/jobs/{job_id}/match")
async def start_matching_for_job(
    job_id: int,
    max_candidates: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_sync),
):
    """
    Start the full matching workflow for a job.

    This will:
    1. Classify the job
    2. Find all active candidates
    3. Run specialized agent for matching
    4. Create Match records for qualified candidates
    """
    try:
        engine = OrchestratorEngine(db)
        result = await engine.process_job_and_find_matches(
            job_id=job_id,
            max_candidates=max_candidates,
        )

        return {
            "status": "success",
            "data": result,
        }

    except Exception as e:
        logger.error(f"Error starting matching for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start matching: {str(e)}")


@router.get("/tasks")
async def get_agent_tasks(
    db: Session = Depends(get_db_sync),
    status: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """Get agent tasks with optional filtering."""
    try:
        query = db.query(AgentTask)

        if status and status in [s.value for s in TaskStatus]:
            query = query.filter(AgentTask.status == status)

        if agent_type:
            try:
                agent_enum = AgentType[agent_type.upper()]
                query = query.filter(AgentTask.assigned_agent == agent_enum)
            except KeyError:
                pass

        total = query.count()
        tasks = query.order_by(AgentTask.created_at.desc()).offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "tasks": [
                {
                    "id": t.id,
                    "task_type": t.task_type,
                    "status": t.status.value,
                    "agent": t.assigned_agent.value if t.assigned_agent else None,
                    "job_id": t.job_id,
                    "candidate_id": t.candidate_id,
                    "retry_count": t.retry_count,
                    "created_at": t.created_at.isoformat(),
                    "started_at": t.started_at.isoformat() if t.started_at else None,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                    "error_message": t.error_message,
                }
                for t in tasks
            ],
        }

    except Exception as e:
        logger.error(f"Error fetching agent tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tasks")


@router.get("/tasks/{task_id}")
async def get_agent_task_details(task_id: int, db: Session = Depends(get_db_sync)):
    """Get detailed information about a specific task."""
    try:
        task = db.query(AgentTask).filter(AgentTask.id == task_id).first()

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Get logs for this task
        logs = db.query(AgentLog).filter(AgentLog.task_id == task_id).all()

        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status.value,
            "agent": task.assigned_agent.value if task.assigned_agent else None,
            "job_id": task.job_id,
            "candidate_id": task.candidate_id,
            "input_data": task.input_data,
            "output_data": task.output_data,
            "retry_count": task.retry_count,
            "max_retries": task.max_retries,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "error_message": task.error_message,
            "logs": [
                {
                    "id": log.id,
                    "message_type": log.message_type,
                    "sender": log.sender,
                    "content": log.content[:500],  # Truncate for brevity
                    "tokens_used": log.tokens_used,
                    "model_used": log.model_used,
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch task")


@router.post("/feedback/match/{match_id}")
async def submit_match_feedback(
    match_id: int,
    was_correct: bool,
    feedback_text: Optional[str] = None,
    db: Session = Depends(get_db_sync),
):
    """
    Submit feedback on a match for agent learning.

    This feedback helps agents improve their matching in the future.
    """
    try:
        match = db.query(Match).filter(Match.id == match_id).first()

        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        # Create feedback record
        feedback = FeedbackLog(
            match_id=match_id,
            was_correct=was_correct,
            feedback_text=feedback_text,
            agent_type=AgentType[match.agent_name.upper()],
            used_for_learning=False,  # Will be used by agent later
        )

        db.add(feedback)
        db.commit()

        logger.info(f"Feedback recorded for match {match_id}: correct={was_correct}")

        return {
            "status": "success",
            "feedback_id": feedback.id,
            "match_id": match_id,
            "message": "Feedback recorded for agent learning",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to record feedback")


@router.get("/status")
async def get_system_status(db: Session = Depends(get_db_sync)):
    """Get overall system status and agent statistics."""
    try:
        watchdog = AgentWatchdog(db)
        status = {
            "status": "operational",
            "statistics": watchdog.get_task_stats(),
            "stuck_tasks": [],
        }

        # Get stuck tasks
        stuck = watchdog.get_stuck_tasks(timeout_minutes=5)
        if stuck:
            status["stuck_tasks"] = [
                {
                    "id": t.id,
                    "task_type": t.task_type,
                    "agent": t.assigned_agent.value if t.assigned_agent else None,
                    "started_at": t.started_at.isoformat(),
                }
                for t in stuck
            ]

        return status

    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system status")


@router.post("/watchdog/restart-stuck")
async def restart_stuck_tasks(db: Session = Depends(get_db_sync)):
    """
    Manually trigger watchdog to check and restart stuck tasks.
    """
    try:
        watchdog = AgentWatchdog(db)
        restarted = watchdog.check_and_restart_stuck_tasks()

        return {
            "status": "success",
            "restarted_count": restarted,
            "message": f"Restarted {restarted} stuck task(s)",
        }

    except Exception as e:
        logger.error(f"Error restarting stuck tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to restart tasks")
