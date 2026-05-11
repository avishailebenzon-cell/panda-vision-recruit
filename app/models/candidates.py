from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class SecurityLevel(str, enum.Enum):
    NO_SECURITY = "no_security"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"
    TOP_SECRET = "top_secret"


class CandidateStatus(str, enum.Enum):
    ACTIVE = "active"
    DELETED = "deleted"  # Logical delete


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)

    # Personal details
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    location = Column(String(255), nullable=True)

    # Security classification
    security_level = Column(String(50), default=SecurityLevel.NO_SECURITY.value, nullable=False)

    # Tracking dates
    email_received_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    scanned_date = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)

    # Status
    status = Column(String(50), default=CandidateStatus.ACTIVE.value, nullable=False, index=True)

    # Additional info
    resume_url = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    matches = relationship("Match", back_populates="candidate", cascade="all, delete-orphan")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Candidate(id={self.id}, email={self.email}, status={self.status})>"
