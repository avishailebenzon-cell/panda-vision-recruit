from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db_sync
from app.models.jobs import Job, JobPriority, SecurityLevel
from app.services.pipedrive import PipedriveService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/")
async def get_jobs(
    db: Session = Depends(get_db_sync),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
):
    """Get list of jobs with optional filtering."""
    try:
        query = db.query(Job)

        if priority and priority in [p.value for p in JobPriority]:
            query = query.filter(Job.priority == priority)

        if is_active is not None:
            query = query.filter(Job.is_active == is_active)

        total = query.count()
        jobs = query.offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "jobs": [
                {
                    "id": j.id,
                    "title": j.title,
                    "location": j.location,
                    "priority": j.priority.value,
                    "security_level": j.security_level.value,
                    "is_active": j.is_active,
                    "pipedrive_deal_id": j.pipedrive_deal_id,
                    "created_at": j.created_at.isoformat(),
                }
                for j in jobs
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch jobs")


@router.get("/{job_id}")
async def get_job(job_id: int, db: Session = Depends(get_db_sync)):
    """Get a specific job by ID."""
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return {
            "id": job.id,
            "title": job.title,
            "qualifications": job.qualifications,
            "description": job.description,
            "location": job.location,
            "priority": job.priority.value,
            "security_level": job.security_level.value,
            "department": job.department,
            "salary_range": job.salary_range,
            "is_active": job.is_active,
            "pipedrive_deal_id": job.pipedrive_deal_id,
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch job")


@router.post("/sync-from-pipedrive")
async def sync_jobs_from_pipedrive(db: Session = Depends(get_db_sync)):
    """Trigger manual sync of jobs from Pipedrive."""
    try:
        service = PipedriveService(db=db)
        result = await service.sync_open_deals()

        return {
            "status": "success",
            "message": f"Synced {result['created']} new jobs and updated {result['updated']} existing jobs",
            "details": result
        }
    except Exception as e:
        logger.error(f"Error syncing jobs from Pipedrive: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync jobs: {str(e)}")
