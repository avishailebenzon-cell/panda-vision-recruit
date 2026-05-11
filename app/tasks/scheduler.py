import logging
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)
settings = get_settings()

# Settings DB keys
EMAIL_SCAN_ENABLED_KEY = "email_scan_enabled"

# ─────────────────────────────────────────────────────────────────────────────
# Job runner helpers
# ─────────────────────────────────────────────────────────────────────────────

def _run_async(coro):
    """Run an async coroutine from a synchronous APScheduler job."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(coro)


def run_email_scan():
    """Periodic email scan job — skips if disabled in Settings."""
    from app.services.email_scanner import EmailScanner
    from app.models.settings import Setting

    db = SessionLocal()
    try:
        # Respect the user's enabled/disabled toggle
        setting = db.query(Setting).filter(Setting.key == EMAIL_SCAN_ENABLED_KEY).first()
        if setting is not None and setting.value is False:
            logger.info("Email scan is disabled — skipping scheduled run")
            return

        async def _scan():
            scanner = EmailScanner(db)
            result = await scanner.scan_and_process_emails()
            logger.info(
                f"Scheduled email scan done — "
                f"created={result.get('candidates_created', 0)}, "
                f"updated={result.get('candidates_updated', 0)}"
            )

        _run_async(_scan())

    except Exception as e:
        logger.error(f"Error in scheduled email scan: {e}")
    finally:
        db.close()


def run_pipedrive_sync():
    """Daily Pipedrive sync job — runs at 12:00 Israel time."""
    from app.services.pipedrive import PipedriveService

    db = SessionLocal()
    try:
        async def _sync():
            svc = PipedriveService(db=db)
            result = await svc.sync_open_deals()
            await svc.close()
            logger.info(
                f"Scheduled Pipedrive sync done — "
                f"created={result.get('created', 0)}, "
                f"updated={result.get('updated', 0)}, "
                f"total={result.get('total', 0)}"
            )

        _run_async(_sync())

    except Exception as e:
        logger.error(f"Error in scheduled Pipedrive sync: {e}")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler class
# ─────────────────────────────────────────────────────────────────────────────

class TaskScheduler:
    """
    Background task scheduler.

    Jobs:
    - email_scan_job   : every EMAIL_SCAN_INTERVAL_MINUTES minutes (default 30)
                         can be paused/resumed at runtime; state persisted in DB.
    - pipedrive_sync_job: daily at 12:00 noon Israel time (Asia/Jerusalem).
    """

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone="Asia/Jerusalem")
        self.is_running = False

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        if self.is_running:
            logger.warning("Scheduler already running")
            return

        try:
            # ── Email scan: interval job ───────────────────────────────────
            self.scheduler.add_job(
                func=run_email_scan,
                trigger=IntervalTrigger(minutes=settings.email_scan_interval_minutes),
                id="email_scan_job",
                name="Email Scanning Task",
                replace_existing=True,
                max_instances=1,
            )

            # ── Pipedrive sync: daily cron at 12:00 Israel time ───────────
            self.scheduler.add_job(
                func=run_pipedrive_sync,
                trigger=CronTrigger(hour=12, minute=0, timezone="Asia/Jerusalem"),
                id="pipedrive_sync_job",
                name="Daily Pipedrive Sync",
                replace_existing=True,
                max_instances=1,
            )

            self.scheduler.start()
            self.is_running = True

            # Restore paused state from DB if applicable
            self._restore_email_scan_state()

            logger.info(
                f"Scheduler started — "
                f"email scan every {settings.email_scan_interval_minutes} min, "
                f"Pipedrive sync daily at 12:00 (Asia/Jerusalem)"
            )

        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")
            raise

    def stop(self):
        if not self.is_running:
            return
        try:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("Scheduler stopped")
        except Exception as e:
            logger.error(f"Error stopping scheduler: {e}")

    # ── Email scan control ────────────────────────────────────────────────────

    def pause_email_scan(self):
        """Pause email scanning and persist state to DB."""
        try:
            self.scheduler.pause_job("email_scan_job")
            self._set_email_scan_enabled(False)
            logger.info("Email scan paused")
        except Exception as e:
            logger.error(f"Could not pause email scan: {e}")
            raise

    def resume_email_scan(self):
        """Resume email scanning and persist state to DB."""
        try:
            self.scheduler.resume_job("email_scan_job")
            self._set_email_scan_enabled(True)
            logger.info("Email scan resumed")
        except Exception as e:
            logger.error(f"Could not resume email scan: {e}")
            raise

    def is_email_scan_active(self) -> bool:
        """Return True if the email scan job is currently scheduled and not paused."""
        try:
            job = self.scheduler.get_job("email_scan_job")
            return job is not None and job.next_run_time is not None
        except Exception:
            return False

    def trigger_email_scan_now(self):
        """Run email scan immediately (outside the normal interval)."""
        try:
            self.scheduler.modify_job("email_scan_job", next_run_time=__import__("datetime").datetime.now())
        except Exception as e:
            logger.warning(f"Could not trigger immediate scan: {e}")

    def trigger_pipedrive_sync_now(self):
        """Run Pipedrive sync immediately (outside the normal schedule)."""
        try:
            self.scheduler.modify_job("pipedrive_sync_job", next_run_time=__import__("datetime").datetime.now())
        except Exception as e:
            logger.warning(f"Could not trigger immediate Pipedrive sync: {e}")

    def get_job_status(self) -> dict:
        """Return human-readable status of all jobs."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "active": job.next_run_time is not None,
            })
        return {
            "scheduler_running": self.is_running,
            "jobs": jobs,
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _set_email_scan_enabled(self, enabled: bool):
        """Persist email scan enabled/disabled state to Settings DB."""
        from app.models.settings import Setting
        db = SessionLocal()
        try:
            setting = db.query(Setting).filter(Setting.key == EMAIL_SCAN_ENABLED_KEY).first()
            if setting:
                setting.value = enabled
            else:
                setting = Setting(
                    key=EMAIL_SCAN_ENABLED_KEY,
                    value=enabled,
                    description="Whether automatic email scanning is enabled",
                )
                db.add(setting)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to persist email scan state: {e}")
        finally:
            db.close()

    def _restore_email_scan_state(self):
        """On startup, restore paused state from DB (survives restarts)."""
        from app.models.settings import Setting
        db = SessionLocal()
        try:
            setting = db.query(Setting).filter(Setting.key == EMAIL_SCAN_ENABLED_KEY).first()
            if setting is not None and setting.value is False:
                self.scheduler.pause_job("email_scan_job")
                logger.info("Email scan restored as PAUSED (from DB setting)")
            else:
                logger.info("Email scan restored as ACTIVE")
        except Exception as e:
            logger.warning(f"Could not restore email scan state: {e}")
        finally:
            db.close()


# Global singleton
task_scheduler = TaskScheduler()
