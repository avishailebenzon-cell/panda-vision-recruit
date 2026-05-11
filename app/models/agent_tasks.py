from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class AgentType(str, enum.Enum):
    ORCHESTRATOR = "orchestrator"
    SOFTWARE = "software"
    ELECTRONICS = "electronics"
    MECHANICAL = "mechanical"
    QA = "qa"
    IT = "it"
    CYBERSECURITY = "cybersecurity"
    SYSTEMS_ENGINEERING = "systems_engineering"
    GARBAGE_COLLECTOR = "garbage_collector"


class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id = Column(Integer, primary_key=True, index=True)

    # Task identification
    task_type = Column(String(50), nullable=False)  # "classify_job", "match_candidate", etc.
    status = Column(String(50), default=TaskStatus.PENDING.value, nullable=False, index=True)

    # Agent assignment
    assigned_agent = Column(String(50), nullable=True, index=True)

    # Related entities
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=True, index=True)

    # Task input and output
    input_data = Column(JSON, nullable=True)  # What the agent received
    output_data = Column(JSON, nullable=True)  # What the agent produced

    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)

    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    timeout_seconds = Column(Integer, default=300, nullable=False)  # 5 minutes default

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    job = relationship("Job", foreign_keys=[job_id])
    candidate = relationship("Candidate", foreign_keys=[candidate_id])

    def __repr__(self):
        return f"<AgentTask(id={self.id}, type={self.task_type}, status={self.status}, agent={self.assigned_agent})>"


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Message context
    task_id = Column(Integer, ForeignKey("agent_tasks.id", ondelete="CASCADE"), nullable=True)
    agent_type = Column(String(50), nullable=False, index=True)

    # Communication
    message_type = Column(String(50), nullable=False)  # "input", "output", "error", "feedback"
    sender = Column(String(50), nullable=False)  # "system", "orchestrator", agent name
    content = Column(Text, nullable=False)

    # Metadata
    tokens_used = Column(Integer, nullable=True)
    model_used = Column(String(100), nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AgentLog(id={self.id}, task={self.task_id}, type={self.message_type}, agent={self.agent_type})>"


class FeedbackLog(Base):
    __tablename__ = "feedback_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Match feedback
    match_id = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)

    # Feedback
    was_correct = Column(Boolean, nullable=False)  # True if match was good, False if wrong
    feedback_text = Column(Text, nullable=True)  # Optional human comment

    # Agent learning
    agent_type = Column(String(50), nullable=False, index=True)
    used_for_learning = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    match = relationship("Match")

    def __repr__(self):
        return f"<FeedbackLog(id={self.id}, match_id={self.match_id}, correct={self.was_correct})>"
