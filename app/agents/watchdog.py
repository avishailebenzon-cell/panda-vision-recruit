import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.agent_tasks import AgentTask, TaskStatus

logger = logging.getLogger(__name__)


class AgentWatchdog:
    """Monitors agent tasks for timeouts and restarts stuck processes."""

    def __init__(self, db: Session):
        self.db = db

    def check_and_restart_stuck_tasks(self) -> int:
        """
        Check for stuck tasks and restart them.
        Returns the number of restarted tasks.
        """
        try:
            # Find in-progress tasks that have exceeded timeout
            stuck_tasks = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.IN_PROGRESS,
                AgentTask.started_at.isnot(None),
            ).all()

            restarted_count = 0
            now = datetime.utcnow()

            for task in stuck_tasks:
                elapsed_seconds = (now - task.started_at).total_seconds()

                if elapsed_seconds > task.timeout_seconds:
                    logger.warning(
                        f"Stuck task detected: {task.id} "
                        f"({task.task_type} - {task.assigned_agent}) "
                        f"has been in progress for {elapsed_seconds:.0f} seconds"
                    )

                    # Check if we can retry
                    if task.retry_count < task.max_retries:
                        task.status = TaskStatus.PENDING
                        task.retry_count += 1
                        task.error_message = (
                            f"Watchdog restart #{task.retry_count}: "
                            f"Task exceeded {task.timeout_seconds}s timeout"
                        )
                        logger.info(f"Restarted task {task.id} (retry {task.retry_count})")
                        restarted_count += 1
                    else:
                        task.status = TaskStatus.TIMEOUT
                        task.error_message = f"Task exceeded max retries after {elapsed_seconds:.0f}s"
                        logger.error(f"Task {task.id} marked as timeout - max retries exceeded")

            self.db.commit()
            return restarted_count

        except Exception as e:
            logger.error(f"Error in watchdog: {e}")
            return 0

    def get_stuck_tasks(self, timeout_minutes: int = 5) -> list:
        """Get list of currently stuck tasks."""
        try:
            threshold = datetime.utcnow() - timedelta(minutes=timeout_minutes)

            stuck = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.IN_PROGRESS,
                AgentTask.started_at.isnot(None),
                AgentTask.started_at < threshold,
            ).all()

            return stuck

        except Exception as e:
            logger.error(f"Error getting stuck tasks: {e}")
            return []

    def get_task_stats(self) -> dict:
        """Get statistics about all agent tasks."""
        try:
            total = self.db.query(AgentTask).count()
            pending = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.PENDING
            ).count()
            in_progress = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.IN_PROGRESS
            ).count()
            completed = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.COMPLETED
            ).count()
            failed = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.FAILED
            ).count()
            timeout = self.db.query(AgentTask).filter(
                AgentTask.status == TaskStatus.TIMEOUT
            ).count()

            return {
                "total": total,
                "pending": pending,
                "in_progress": in_progress,
                "completed": completed,
                "failed": failed,
                "timeout": timeout,
            }

        except Exception as e:
            logger.error(f"Error getting task stats: {e}")
            return {}
