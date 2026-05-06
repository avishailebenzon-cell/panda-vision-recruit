from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
from app.config import get_settings
from app.database import init_db
from app.api import health, candidates, jobs, email_scanner, agents
from app.tasks.scheduler import task_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle: startup and shutdown."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    await init_db()
    logger.info("Database initialized successfully")

    # Start background task scheduler
    try:
        task_scheduler.start()
    except Exception as e:
        logger.warning(f"Could not start background scheduler: {e}")
        logger.info("Email scanning will need to be triggered manually via API")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.app_name}")
    task_scheduler.stop()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend infrastructure for AI-driven candidate recruitment",
    lifespan=lifespan,
)

# Include routers
app.include_router(health.router)
app.include_router(candidates.router)
app.include_router(jobs.router)
app.include_router(email_scanner.router)
app.include_router(agents.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
