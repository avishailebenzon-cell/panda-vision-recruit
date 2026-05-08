import logging
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.email_scanner import EmailScanner

logger = logging.getLogger(__name__)

settings = get_settings()


async def run_email_scan_async():
    """Async email scan task."""
    async with AsyncSessionLocal() as db:
        try:
            scanner = EmailScanner(db)
            result = await scanner.scan_and_process_emails()
            logger.info(f"Email scan task completed: {result}")
        except Exception as e:
            logger.error(f"Error in email scan task: {e}")


def run_email_scan():
    """Wrapper function to run async email scan from sync scheduler context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(run_email_scan_async())
    except Exception as e:
        logger.error(f"Error running email scan: {e}")


class TaskScheduler:
    """Background task scheduler for periodic email scanning."""

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False

    def start(self):
        """Start the scheduler and add jobs."""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return

        try:
            # Add email scanning job
            self.scheduler.add_job(
                func=run_email_scan,
                trigger=IntervalTrigger(minutes=settings.email_scan_interval_minutes),
                id="email_scan_job",
                name="Email Scanning Task",
                replace_existing=True,
                max_instances=1,  # Prevent concurrent runs
            )

            self.scheduler.start()
            self.is_running = True

            logger.info(
                f"Task scheduler started. "
                f"Email scan will run every {settings.email_scan_interval_minutes} minutes"
            )

        except Exception as e:
            logger.error(f"Failed to start task scheduler: {e}")
            raise

    def stop(self):
        """Stop the scheduler."""
        if not self.is_running:
            return

        try:
            self.scheduler.shutdown(wait=True)
            self.is_running = False
            logger.info("Task scheduler stopped")
        except Exception as e:
            logger.error(f"Error stopping scheduler: {e}")

    def get_jobs(self):
        """Get list of scheduled jobs."""
        return self.scheduler.get_jobs()


# Global scheduler instance
task_scheduler = TaskScheduler()
