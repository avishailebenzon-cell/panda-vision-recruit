import logging
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.services.azure_email import AzureEmailService
from app.services.document_parser import DocumentParser
from app.services.candidate_processor import CandidateProcessor
from app.models.email_logs import EmailScanLog

logger = logging.getLogger(__name__)


class EmailScanner:
    """Orchestrator service for scanning emails and processing candidates."""

    def __init__(self, db: Session):
        self.db = db
        self.azure_service = AzureEmailService()
        self.document_parser = DocumentParser()
        self.candidate_processor = CandidateProcessor(db)

    async def scan_and_process_emails(self) -> Dict[str, Any]:
        """
        Main scanning loop: fetch emails, extract attachments, parse documents, and save candidates.

        Returns: Scan result summary
        """
        scan_log = EmailScanLog(status="processing")
        self.db.add(scan_log)
        self.db.commit()

        try:
            logger.info("Starting email scan cycle")
            scan_log.scan_start_time = datetime.utcnow()

            result = {
                "total_emails": 0,
                "attachments_processed": 0,
                "candidates_created": 0,
                "candidates_updated": 0,
                "errors": [],
            }

            # Fetch unread messages with attachments
            try:
                messages = await self.azure_service.fetch_unread_messages(limit=50)
                result["total_emails"] = len(messages)
                scan_log.total_emails_scanned = len(messages)

            except Exception as e:
                error_msg = f"Failed to fetch messages: {str(e)}"
                logger.error(error_msg)
                result["errors"].append(error_msg)
                scan_log.status = "failed"
                scan_log.error_message = error_msg
                self.db.commit()
                await self.azure_service.close()
                return result

            # Process each message
            for message in messages:
                try:
                    await self._process_message(message, result)
                except Exception as e:
                    error_msg = f"Error processing message {message.get('id')}: {str(e)}"
                    logger.error(error_msg)
                    result["errors"].append(error_msg)
                    continue

            # Update scan log
            scan_log.scan_end_time = datetime.utcnow()
            scan_log.candidates_created = result["candidates_created"]
            scan_log.candidates_updated = result["candidates_updated"]
            scan_log.attachments_found = result["attachments_processed"]
            scan_log.candidates_skipped = result["total_emails"] - result["candidates_created"] - result["candidates_updated"]
            scan_log.status = "completed"
            scan_log.details = result

            self.db.commit()

            logger.info(
                f"Email scan completed: "
                f"created={result['candidates_created']}, "
                f"updated={result['candidates_updated']}, "
                f"errors={len(result['errors'])}"
            )

            result["log_id"] = scan_log.id

        except Exception as e:
            logger.error(f"Unexpected error during scan: {e}")
            scan_log.status = "failed"
            scan_log.error_message = str(e)
            self.db.commit()

        finally:
            await self.azure_service.close()

        return result

    async def _process_message(self, message: Dict[str, Any], result: Dict[str, Any]) -> None:
        """Process a single email message."""
        message_id = message.get("id")
        sender_name = message.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
        sender_email = message.get("from", {}).get("emailAddress", {}).get("address", "")
        received_date_str = message.get("receivedDateTime")

        # Parse received date
        try:
            received_date = datetime.fromisoformat(received_date_str.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning(f"Could not parse received date {received_date_str}: {e}")
            received_date = datetime.utcnow()

        logger.info(f"Processing message {message_id} from {sender_email}")

        # Fetch attachments
        try:
            attachments = await self.azure_service.get_message_attachments(message_id)
        except Exception as e:
            logger.error(f"Failed to fetch attachments for message {message_id}: {e}")
            return

        # Process each attachment
        for attachment in attachments:
            try:
                await self._process_attachment(
                    message_id,
                    attachment,
                    sender_email,
                    sender_name,
                    received_date,
                    result
                )
            except Exception as e:
                logger.error(f"Error processing attachment: {e}")
                continue

        # Mark message as read after processing
        try:
            await self.azure_service.mark_as_read(message_id)
        except Exception as e:
            logger.warning(f"Failed to mark message as read: {e}")

    async def _process_attachment(
        self,
        message_id: str,
        attachment: Dict[str, Any],
        sender_email: str,
        sender_name: str,
        received_date: datetime,
        result: Dict[str, Any],
    ) -> None:
        """Process a single attachment."""
        attachment_id = attachment.get("id")
        filename = attachment.get("name", "unknown")
        content_type = attachment.get("contentType", "")

        # Check if file format is supported
        if not DocumentParser.is_supported_format(filename):
            logger.info(f"Skipping unsupported file: {filename}")
            return

        logger.info(f"Processing attachment: {filename}")

        # Download attachment
        try:
            attachment_content = await self.azure_service.download_attachment(
                message_id,
                attachment_id
            )
        except Exception as e:
            logger.error(f"Failed to download attachment {filename}: {e}")
            raise

        # Parse document
        extracted_text, success = self.document_parser.parse_document(
            attachment_content,
            filename
        )

        if not success or not extracted_text:
            logger.warning(f"Failed to extract text from {filename}")
            return

        result["attachments_processed"] += 1

        # Extract candidate information
        candidate_info = self.candidate_processor.extract_candidate_info(
            extracted_text,
            sender_email,
            sender_name,
            received_date,
        )

        # Classify security level
        security_level = self.candidate_processor.classify_security_level(extracted_text)

        # Save or update candidate
        candidate, is_new = self.candidate_processor.save_or_update_candidate(
            email=candidate_info["email"],
            first_name=candidate_info["first_name"],
            last_name=candidate_info["last_name"],
            phone=candidate_info["phone"],
            location=candidate_info["location"],
            security_level=security_level,
            email_received_date=received_date,
            resume_text=extracted_text,
            resume_url=None,
        )

        if is_new:
            result["candidates_created"] += 1
        else:
            result["candidates_updated"] += 1
