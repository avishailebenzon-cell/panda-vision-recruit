from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import logging

from app.database import get_db_sync
from app.models.email_logs import EmailScanLog
from app.services.email_scanner import EmailScanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email"])


@router.post("/scan")
async def trigger_email_scan(db: Session = Depends(get_db_sync)):
    """
    Manually trigger email scanning and candidate processing.

    This will:
    1. Fetch unread emails from jobs@pandatech.co.il
    2. Extract and parse attachments (PDF, DOCX, DOC)
    3. Create or update candidates in the database
    4. Classify security levels
    5. Mark emails as read
    """
    try:
        scanner = EmailScanner(db)
        result = await scanner.scan_and_process_emails()

        return {
            "status": "success",
            "message": f"Scan completed: {result.get('candidates_created', 0)} created, {result.get('candidates_updated', 0)} updated",
            "details": {
                "total_emails_scanned": result.get("total_emails", 0),
                "attachments_processed": result.get("attachments_processed", 0),
                "candidates_created": result.get("candidates_created", 0),
                "candidates_updated": result.get("candidates_updated", 0),
                "errors_count": len(result.get("errors", [])),
                "scan_log_id": result.get("log_id"),
            }
        }

    except Exception as e:
        logger.error(f"Error triggering email scan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan emails: {str(e)}")


@router.get("/scan-logs")
async def get_scan_logs(
    db: Session = Depends(get_db_sync),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
):
    """
    Get email scan logs.

    Query parameters:
    - status: Filter by 'processing', 'completed', or 'failed'
    - skip: Pagination offset
    - limit: Number of results
    """
    try:
        query = db.query(EmailScanLog)

        if status and status in ["processing", "completed", "failed"]:
            query = query.filter(EmailScanLog.status == status)

        total = query.count()
        logs = query.order_by(EmailScanLog.scan_start_time.desc()).offset(skip).limit(limit).all()

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "logs": [
                {
                    "id": log.id,
                    "status": log.status,
                    "scan_start_time": log.scan_start_time.isoformat(),
                    "scan_end_time": log.scan_end_time.isoformat() if log.scan_end_time else None,
                    "total_emails_scanned": log.total_emails_scanned,
                    "attachments_found": log.attachments_found,
                    "candidates_created": log.candidates_created,
                    "candidates_updated": log.candidates_updated,
                    "candidates_skipped": log.candidates_skipped,
                    "error_message": log.error_message,
                }
                for log in logs
            ]
        }

    except Exception as e:
        logger.error(f"Error fetching scan logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch scan logs")


@router.get("/scan-logs/{log_id}")
async def get_scan_log_details(log_id: int, db: Session = Depends(get_db_sync)):
    """Get detailed information about a specific scan log."""
    try:
        log = db.query(EmailScanLog).filter(EmailScanLog.id == log_id).first()

        if not log:
            raise HTTPException(status_code=404, detail="Scan log not found")

        return {
            "id": log.id,
            "status": log.status,
            "scan_start_time": log.scan_start_time.isoformat(),
            "scan_end_time": log.scan_end_time.isoformat() if log.scan_end_time else None,
            "total_emails_scanned": log.total_emails_scanned,
            "attachments_found": log.attachments_found,
            "candidates_created": log.candidates_created,
            "candidates_updated": log.candidates_updated,
            "candidates_skipped": log.candidates_skipped,
            "error_message": log.error_message,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching scan log {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch scan log")
