# Panda-Vision Recruit Backend - Development Guide

## Project Overview

FastAPI-based backend for AI-driven recruitment management system. Integrates with Pipedrive for job sourcing and manages candidate-job matching workflows.

## Architecture

### Technology Stack
- **Framework**: FastAPI (async web framework)
- **ORM**: SQLAlchemy 2.0 with Pydantic models
- **Database**: PostgreSQL
- **API Client**: httpx (async HTTP)

### Directory Structure
```
app/
├── models/        # SQLAlchemy ORM models
├── api/           # FastAPI route handlers (routers)
├── services/      # Business logic and external integrations
├── agents/        # AI agents (placeholder for future)
├── config.py      # Settings management (Pydantic)
├── database.py    # DB session and engine setup
└── main.py        # FastAPI app initialization
```

## Database Design

### Core Tables
1. **candidates**: Recruitment prospects with security classifications
2. **jobs**: Job positions synced from Pipedrive
3. **matches**: Candidate-Job relationships with scores and approvals
4. **settings**: Configuration KV store (JSON values)

### Key Features
- Logical deletion: `status` enum fields (never hard delete)
- Security levels: no_security, confidential, secret, top_secret
- Async-first ORM usage throughout
- Foreign key cascades for data integrity

## API Design

### Endpoint Structure
- `/health` - Service status
- `/candidates/` - List/filter candidates
- `/candidates/{id}` - Individual candidate details
- `/jobs/` - List/filter jobs
- `/jobs/{id}` - Individual job details
- `/jobs/sync-from-pipedrive` - Manual sync trigger

### Response Format
All endpoints return JSON with consistent structure:
```json
{
  "status": "success|error",
  "data": { },
  "error": "message if applicable"
}
```

## Pipedrive Integration

### Service Layer
- `PipedriveService` handles all API interactions
- Async/await for non-blocking I/O
- Automatic pagination handling
- Deal filtering: only status='open' with non-empty job_title

### Sync Logic
- Idempotent: creates or updates based on `pipedrive_deal_id`
- Enum validation with fallback defaults
- Transaction rollback on failure
- Detailed logging of sync results

## Configuration

Environment variables via `.env` file:
- `DATABASE_URL`: PostgreSQL connection string
- `PIPEDRIVE_API_KEY`: API key for Pipedrive
- `PIPEDRIVE_BASE_URL`: API endpoint
- `DEBUG`: Enable debug mode

Load via `get_settings()` singleton from `app/config.py`.

## Development Workflow

### Setup
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
# Configure .env with local DB and API keys
```

### Running
```bash
python -m app.main  # Development server with reload
```

### Testing
```bash
pytest  # Run test suite
pytest -v --cov  # With coverage
```

## Code Standards

### Async Patterns
- Use `async def` for route handlers and service methods
- FastAPI dependency injection for DB sessions
- `async with` context managers for resource cleanup

### Error Handling
- HTTPException for API errors (status codes)
- Try/except with logging for service errors
- Never let exceptions bubble without logging

### Logging
- `import logging; logger = logging.getLogger(__name__)`
- Log at INFO for important events, ERROR for failures
- Include relevant context (IDs, counts, etc.)

### Type Hints
- Use Python 3.10+ type annotations throughout
- SQLAlchemy models and Pydantic schemas separately
- Optional[T] for nullable fields

## Future Implementation

### AI Agents
- Implement in `app/agents/` as services
- Async-compatible for concurrent matching
- Return structured results for storage

### Authentication
- JWT or OAuth2 via FastAPI Security
- User roles: recruiter, admin, agent

### Admin Workflow
- Approval endpoints for matches
- Audit trail in database

## Testing Strategy

- Unit: Model definitions and business logic
- Integration: API endpoints with test database
- Database: Migration and schema validation

Use pytest with async support (`pytest-asyncio`).

## Deployment

- Docker image: `python:3.11-slim` base
- Environment-specific `.env` files
- Database migrations via Alembic (prepared)
- Health check at `/health` endpoint

## Important Notes

- **No hard deletes**: Use status enums for soft deletes
- **Idempotency**: Pipedrive sync uses deal_id as unique key
- **Async throughout**: All I/O is non-blocking
- **Logging**: Every external call and DB operation logged
