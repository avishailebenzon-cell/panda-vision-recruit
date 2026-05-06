from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON
from datetime import datetime
from app.database import Base


class EmailScanLog(Base):
    __tablename__ = "email_scan_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Scan metadata
    scan_start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    scan_end_time = Column(DateTime, nullable=True)

    # Results
    total_emails_scanned = Column(Integer, default=0, nullable=False)
    attachments_found = Column(Integer, default=0, nullable=False)
    candidates_created = Column(Integer, default=0, nullable=False)
    candidates_updated = Column(Integer, default=0, nullable=False)
    candidates_skipped = Column(Integer, default=0, nullable=False)

    # Status
    status = Column(String(50), default="processing", nullable=False)  # processing, completed, failed
    error_message = Column(Text, nullable=True)

    # Detailed logs
    details = Column(JSON, nullable=True)  # Store detailed error/success info

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<EmailScanLog(id={self.id}, status={self.status}, created={self.candidates_created})>"
