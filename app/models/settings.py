from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime
from app.database import Base


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)

    # Setting key (e.g., 'synonyms', 'log_retention_days')
    key = Column(String(255), unique=True, nullable=False, index=True)

    # Setting value (stored as JSON for flexibility)
    value = Column(JSON, nullable=False)

    # Description
    description = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Setting(key={self.key})>"
