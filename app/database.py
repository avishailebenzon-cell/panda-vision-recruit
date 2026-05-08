from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool, StaticPool
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

Base = declarative_base()

# Detect if using SQLite
is_sqlite = "sqlite" in settings.database_url

if is_sqlite:
    # For SQLite with async
    async_engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=StaticPool,
        future=True,
    )
    # For sync operations on SQLite
    sync_engine = create_engine(
        settings.database_url.replace("+aiosqlite", ""),
        echo=settings.debug,
        poolclass=StaticPool,
    )
else:
    # For PostgreSQL with async
    async_engine = create_async_engine(
        settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
        echo=settings.debug,
        poolclass=NullPool,
        future=True,
    )
    # For sync operations on PostgreSQL
    sync_engine = create_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=NullPool,
    )

AsyncSessionLocal = async_sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

SyncSessionLocal = sessionmaker(
    sync_engine, class_=Session, expire_on_commit=False
)


async def get_db() -> AsyncSession:
    """Dependency for FastAPI to get async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


def get_db_sync() -> Session:
    """Dependency for FastAPI to get sync DB session."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def init_db():
    """Initialize database tables."""
    try:
        # Use async engine to create tables
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
