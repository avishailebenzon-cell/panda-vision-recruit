import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.services.azure_email import AzureEmailService
from app.services.document_parser import DocumentParser
from app.services.candidate_processor import CandidateProcessor
from app.services.supabase_storage import SupabaseStorageClient
from app.models.email_logs import EmailScanLog
from app.models.settings import Setting

logger = logging.getLogger(__name__)

# Settings key that stores the last successfully scanned email date
LAST_SCAN_DATE_KEY = "last_email_scan_date"


class EmailScanner:
    """
    Orchestrates email scanning with incremental processing.

    Strategy:
    - First run: scans ALL messages with attachments (oldest → newest)
    - Subsequent runs: only scans messages newer than the last processed date
    - After each scan, saves the most recent received date to Settings
    - This ensures no message is missed and no message is re-processed
    """

    def __init__(self, db: Session):
        self.db = db
        self.azure_service = AzureEmailService()
        self.document_parser = DocumentParser()
        self.candidate_processor = CandidateProcessor(db)
        self.storage_client = SupabaseStorageClient()

    # ─────────────────────────────────────────────────────────────────────────
    # Last-scan-date helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _get_last_scan_date(self) -> Optional[datetime]:
        """Load last processed email date from Settings (UTC). None = never scanned."""
        try:
            setting = self.db.query(Setting).filter(
                Setting.key == LAST_SCAN_DATE_KEY
            ).first()
            if setting and setting.value:
                raw = setting.value
                # value is JSON — could be a string like "2024-05-01T12:00:00+00:00"
                if isinstance(raw, str):
                    return datetime.fromisoformat(raw)
                if isinstance(raw, dict) and "date" in raw:
                    return datetime.fromisoformat(raw["date"])
            return None
        except Exception as e:
            logger.warning(f"Could not load last scan date: {e}")
            return None

    def _save_last_scan_date(self, dt: datetime) -> None:
        """Persist the last processed email date to Settings."""
        try:
            iso = dt.isoformat()
            setting = self.db.query(Setting).filter(
                Setting.key == LAST_SCAN_DATE_KEY
            ).first()
            if setting:
                setting.value = iso
            else:
                setting = Setting(
                    key=LAST_SCAN_DATE_KEY,
                    value=iso,
                    description="ISO timestamp of the last email successfully scanned",
                )
                self.db.add(setting)
            self.db.commit()
            logger.info(f"Saved last scan date: {iso}")
        except Exception as e:
            logger.error(f"Failed to save last scan date: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # Main entry point
    # ─────────────────────────────────────────────────────────────────────────

    async def scan_and_process_emails(self) -> Dict[str, Any]:
        """
        Incremental scan:
        1. Read last scanned date from DB.
        2. Fetch emails with attachments received AFTER that date (oldest-first).
        3. Process each email, oldest → newest.
        4. Save the date of the most recent processed email.

        First run fetches ALL historical emails.
        """
        scan_log = EmailScanLog(
            status="processing",
            scan_start_time=datetime.utcnow(),
        )
        self.db.add(scan_log)
        self.db.commit()

        result: Dict[str, Any] = {
            "total_emails": 0,
            "attachments_processed": 0,
            "candidates_created": 0,
            "candidates_updated": 0,
            "errors": [],
            "since_date": None,
            "latest_processed_date": None,
        }

        try:
            # Determine scan window
            since_date = self._get_last_scan_date()
            result["since_date"] = since_date.isoformat() if since_date else "beginning of time"

            if since_date:
                logger.info(f"Incremental scan — fetching emails since {since_date.isoformat()}")
            else:
                logger.info("First-time scan — fetching ALL emails with attachments (oldest first)")

            # Fetch messages (oldest first)
            try:
                messages = await self.azure_service.fetch_messages_since(
                    since_date=since_date,
                    limit=50,
                )
                result["total_emails"] = len(messages)
                scan_log.total_emails_scanned = len(messages)
                self.db.commit()
            except Exception as e:
                error_msg = f"Failed to fetch messages: {e}"
                logger.error(error_msg)
                result["errors"].append(error_msg)
                scan_log.status = "failed"
                scan_log.error_message = error_msg
                scan_log.scan_end_time = datetime.utcnow()
                self.db.commit()
                return result

            if not messages:
                logger.info("No new messages to process")
                scan_log.status = "completed"
                scan_log.scan_end_time = datetime.utcnow()
                self.db.commit()
                result["log_id"] = scan_log.id
                return result

            # Process each message oldest → newest
            latest_date: Optional[datetime] = None

            for message in messages:
                try:
                    received_str = message.get("receivedDateTime", "")
                    received_dt = (
                        datetime.fromisoformat(received_str.replace("Z", "+00:00"))
                        if received_str else datetime.now(timezone.utc)
                    )

                    await self._process_message(message, result)

                    # Track the latest successfully processed date
                    if latest_date is None or received_dt > latest_date:
                        latest_date = received_dt

                except Exception as e:
                    msg = f"Error on message {message.get('id', '?')}: {e}"
                    logger.error(msg)
                    result["errors"].append(msg)
                    continue  # keep going — don't let one bad email block the rest

            # Persist progress — next run starts from here
            if latest_date:
                self._save_last_scan_date(latest_date)
                result["latest_processed_date"] = latest_date.isoformat()

            # Finalise scan log
            scan_log.scan_end_time = datetime.utcnow()
            scan_log.candidates_created = result["candidates_created"]
            scan_log.candidates_updated = result["candidates_updated"]
            scan_log.attachments_found = result["attachments_processed"]
            scan_log.candidates_skipped = (
                result["total_emails"]
                - result["candidates_created"]
                - result["candidates_updated"]
            )
            scan_log.status = "completed"
            scan_log.details = {k: v for k, v in result.items() if k != "errors"}
            self.db.commit()

            logger.info(
                f"Scan done — emails={result['total_emails']}, "
                f"created={result['candidates_created']}, "
                f"updated={result['candidates_updated']}, "
                f"errors={len(result['errors'])}"
            )
            result["log_id"] = scan_log.id

        except Exception as e:
            logger.error(f"Unexpected scanner error: {e}")
            scan_log.status = "failed"
            scan_log.error_message = str(e)
            scan_log.scan_end_time = datetime.utcnow()
            self.db.commit()

        finally:
            await self.azure_service.close()
            await self.storage_client.close()

        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Message / attachment processing (unchanged logic, fixed cv_url bug)
    # ─────────────────────────────────────────────────────────────────────────

    async def _process_message(self, message: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Process a single email message."""
        message_id = message.get("id")
        sender_name  = message.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
        sender_email = message.get("from", {}).get("emailAddress", {}).get("address", "")
        received_str = message.get("receivedDateTime", "")

        try:
            received_date = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
        except Exception:
            received_date = datetime.now(timezone.utc)

        logger.info(f"Processing message {message_id} from {sender_email} ({received_str})")

        try:
            attachments = await self.azure_service.get_message_attachments(message_id)
        except Exception as e:
            logger.error(f"Failed to fetch attachments for {message_id}: {e}")
            return

        for attachment in attachments:
            try:
                await self._process_attachment(
                    message_id, attachment,
                    sender_email, sender_name, received_date, result,
                )
            except Exception as e:
                logger.error(f"Error processing attachment in {message_id}: {e}")
                continue

        # Mark as read so the mailbox stays clean (best-effort)
        try:
            await self.azure_service.mark_as_read(message_id)
        except Exception as e:
            logger.warning(f"Could not mark {message_id} as read: {e}")

    async def _process_attachment(
        self,
        message_id: str,
        attachment: Dict[str, Any],
        sender_email: str,
        sender_name: str,
        received_date: datetime,
        result: Dict[str, Any],
    ) -> None:
        """Download, parse, and save a single CV attachment."""
        attachment_id = attachment.get("id")
        filename = attachment.get("name", "unknown")

        if not DocumentParser.is_supported_format(filename):
            logger.info(f"Skipping unsupported file: {filename}")
            return

        logger.info(f"Processing attachment: {filename}")

        # Download
        try:
            file_bytes = await self.azure_service.download_attachment(message_id, attachment_id)
        except Exception as e:
            logger.error(f"Failed to download {filename}: {e}")
            raise

        # Parse text
        extracted_text, success = self.document_parser.parse_document(file_bytes, filename)
        if not success or not extracted_text:
            logger.warning(f"No text extracted from {filename}")
            return

        result["attachments_processed"] += 1

        # Extract candidate info from text + email metadata
        info = self.candidate_processor.extract_candidate_info(
            extracted_text, sender_email, sender_name, received_date,
        )
        security_level = self.candidate_processor.classify_security_level(extracted_text)

        # Save candidate (create or update)
        candidate, is_new = self.candidate_processor.save_or_update_candidate(
            email=info["email"],
            first_name=info["first_name"],
            last_name=info["last_name"],
            phone=info["phone"],
            location=info["location"],
            security_level=security_level,
            email_received_date=received_date,
            resume_text=extracted_text,
            resume_url=None,
        )

        # Upload original file to Supabase Storage
        try:
            resume_url, upload_ok = await self.storage_client.upload_cv(
                file_content=file_bytes,
                filename=filename,
                candidate_id=candidate.id,
            )
            if upload_ok and resume_url:
                candidate.resume_url = resume_url   # correct field name
                self.db.commit()
                logger.info(f"CV uploaded for candidate {candidate.id}: {resume_url}")
        except Exception as e:
            logger.warning(f"CV upload failed for {filename}: {e}")

        if is_new:
            result["candidates_created"] += 1
        else:
            result["candidates_updated"] += 1
