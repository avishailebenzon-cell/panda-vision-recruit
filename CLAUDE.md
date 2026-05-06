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
├── models/            # SQLAlchemy ORM models
├── api/               # FastAPI route handlers (routers)
├── services/          # Business logic and external integrations
│   ├── pipedrive.py        # Pipedrive job sync
│   ├── azure_email.py      # Microsoft Graph API for email
│   ├── document_parser.py  # PDF/DOCX/DOC parsing
│   ├── candidate_processor.py  # Candidate extraction & deduplication
│   └── email_scanner.py    # Orchestrator for full pipeline
├── tasks/             # Background job scheduling
│   └── scheduler.py   # APScheduler setup
├── agents/            # AI agents (placeholder for future)
├── config.py          # Settings management (Pydantic)
├── database.py        # DB session and engine setup
└── main.py            # FastAPI app initialization
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

## Email Scanning System

### Architecture Overview
Pipeline for automated CV processing:
1. **AzureEmailService**: Fetches emails from jobs@ mailbox via Microsoft Graph
2. **DocumentParser**: Extracts text from PDF, DOCX, DOC files
3. **CandidateProcessor**: Parses info, detects duplicates, classifies security
4. **EmailScanner**: Orchestrates the full pipeline
5. **TaskScheduler**: APScheduler runs scans on configured interval

### Key Design Decisions
- **Async-first**: All email/document I/O is non-blocking
- **Idempotent**: Duplicate detection prevents re-imports
- **Extensible**: Security keywords stored in Settings table, not hardcoded
- **Logged**: Every scan cycle tracked in EmailScanLog with metrics

### Duplicate Detection Strategy
- **Primary**: Exact email match (case-insensitive)
- **Secondary**: Name fuzzy match with 80% similarity threshold
- **Update logic**: Only updates if new email is more recent
- Uses difflib.SequenceMatcher for name similarity

### Security Classification
- Regex-based keyword matching on document text
- Hierarchy: TOP_SECRET > SECRET > CONFIDENTIAL > NO_SECURITY
- Keywords configurable via Settings table (future: admin UI)
- Falls back to NO_SECURITY if no keywords match

### Background Tasks
- APScheduler with configurable interval (default: 30 min)
- Single-instance constraint: prevents concurrent scans
- Graceful error handling: logs and continues on attachment errors
- Stops cleanly on app shutdown

### Configuration
Environment variables:
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- `EMAIL_ADDRESS`: Mailbox to monitor
- `EMAIL_SCAN_INTERVAL_MINUTES`: Scan frequency (default: 30)
- `EMAIL_SCAN_LIMIT`: Max emails per scan (default: 50)

## Future Implementation

### AI Agents
- Implement in `app/agents/` as services
- Async-compatible for concurrent matching
- Consume: extracted CV text + job requirements
- Produce: match_score, summary for Match table
- Return structured results for storage

### Enhanced Document Processing
- Skill extraction and normalization
- Experience level classification
- Language detection
- OCR for image-based PDFs
- Table/structured data extraction

### Authentication
- JWT or OAuth2 via FastAPI Security
- User roles: recruiter, admin, agent

### Admin Workflow
- Approval endpoints for matches
- Audit trail in database
- Settings UI for security keywords

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
