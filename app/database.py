from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

# Create engine with proper connection pooling
engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    poolclass=NullPool,  # Useful for serverless environments
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Session:
    """Dependency for FastAPI to get DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def init_db():
    """Initialize database tables and run lightweight migrations."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    # ── Schema migrations (idempotent) ────────────────────────────────────────
    from sqlalchemy import text
    migrations = [
        # New columns: org and contact name from Pipedrive
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS org_name     TEXT",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_name TEXT",
        # Remove enum check constraints so we can store raw Pipedrive labels
        "ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_priority_check",
        "ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_security_level_check",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                logger.info(f"Migration OK: {sql[:60]}")
            except Exception as e:
                logger.warning(f"Migration skipped ({sql[:60]}): {e}")
