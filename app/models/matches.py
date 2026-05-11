from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class MatchStatus(str, enum.Enum):
    PENDING = "pending"  # Awaiting admin approval
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Agent information
    agent_name = Column(String(255), nullable=False)

    # Match scoring and summary
    match_score = Column(Float, nullable=False)  # 0-100
    summary = Column(Text, nullable=False)  # Reasoning for the match

    # Status
    status = Column(String(50), default=MatchStatus.PENDING.value, nullable=False, index=True)

    # Admin approval
    admin_approved = Column(Boolean, default=False, nullable=False)
    admin_notes = Column(Text, nullable=True)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="matches")
    job = relationship("Job", back_populates="matches")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Match(id={self.id}, candidate_id={self.candidate_id}, job_id={self.job_id}, score={self.match_score})>"
