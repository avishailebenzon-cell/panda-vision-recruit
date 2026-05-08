from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.database import get_db_sync
from app.models.agent_tasks import AgentTask, TaskStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    task_type: str
    input_data: Optional[dict] = None
    job_id: Optional[int] = None
    candidate_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    task_type: str
    status: str
    job_id: Optional[int] = None
    candidate_id: Optional[int] = None


@router.get("/")
async def get_tasks(
    db: Session = Depends(get_db_sync),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
):
    """Get list of tasks."""
    try:
        query = db.query(AgentTask)

        if status:
            try:
                status_enum = TaskStatus[status.upper()]
                query = query.filter(AgentTask.status == status_enum)
            except KeyError:
                pass

        total = query.count()
        tasks = query.offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "tasks": [
                {
                    "id": t.id,
                    "task_type": t.task_type,
                    "status": t.status.value if hasattr(t.status, 'value') else str(t.status),
                    "job_id": t.job_id,
                    "candidate_id": t.candidate_id,
                    "created_at": t.created_at.isoformat(),
                }
                for t in tasks
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tasks")


@router.post("/")
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db_sync),
):
    """Create a new task."""
    try:
        task = AgentTask(
            task_type=task_data.task_type,
            input_data=task_data.input_data,
            job_id=task_data.job_id,
            candidate_id=task_data.candidate_id,
            status=TaskStatus.PENDING,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status.value if hasattr(task.status, 'value') else str(task.status),
        }
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create task")


@router.get("/{task_id}")
async def get_task(task_id: int, db: Session = Depends(get_db_sync)):
    """Get a specific task by ID."""
    try:
        task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        return {
            "id": task.id,
            "task_type": task.task_type,
            "status": task.status.value if hasattr(task.status, 'value') else str(task.status),
            "job_id": task.job_id,
            "candidate_id": task.candidate_id,
            "created_at": task.created_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch task")
