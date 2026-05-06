from sqlalchemy import Column, String, DateTime, Integer, Text, Enum, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class JobPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class SecurityLevel(str, enum.Enum):
    NO_SECURITY = "no_security"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"
    TOP_SECRET = "top_secret"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)

    # Pipedrive data
    pipedrive_deal_id = Column(String(255), unique=True, nullable=False, index=True)

    # Job details
    title = Column(String(255), nullable=False, index=True)
    qualifications = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True)

    # Security and priority
    security_level = Column(Enum(SecurityLevel), default=SecurityLevel.NO_SECURITY, nullable=False)
    priority = Column(Enum(JobPriority), default=JobPriority.MEDIUM, nullable=False, index=True)

    # Additional fields
    department = Column(String(255), nullable=True)
    salary_range = Column(String(255), nullable=True)

    # Status tracking
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Relationships
    matches = relationship("Match", back_populates="job", cascade="all, delete-orphan")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Job(id={self.id}, title={self.title}, pipedrive_deal_id={self.pipedrive_deal_id})>"
