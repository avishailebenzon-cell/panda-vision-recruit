# Panda-Vision Recruit 🤖

**AI-Powered Recruitment Management System** - Fully independent from Base44

## Overview

This project provides the backend infrastructure for an intelligent recruitment system that matches candidates with job positions using AI agents. The system integrates with Pipedrive for job sourcing and provides RESTful APIs for candidate and job management.

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Validation**: Pydantic
- **Async**: Python async/await patterns
- **API Client**: httpx for Pipedrive integration

## Project Structure

```
app/
├── models/              # SQLAlchemy database models
│   ├── candidates.py   # Candidate model
│   ├── jobs.py         # Job positions model
│   ├── matches.py      # Candidate-Job matches
│   └── settings.py     # Configuration settings
├── api/                # FastAPI endpoints
│   ├── health.py       # Health check
│   ├── candidates.py   # Candidate endpoints
│   └── jobs.py         # Job endpoints
├── services/           # Business logic
│   └── pipedrive.py    # Pipedrive integration
├── agents/             # AI agents (to be implemented)
├── config.py           # Configuration management
├── database.py         # Database setup
└── main.py             # FastAPI application
```

## Database Schema

### Candidates Table
- Personal information (name, email, phone, location)
- Security classification level
- Email receipt date and scan date
- Status (active/deleted - logical delete)
- Resume URL and notes

### Jobs Table
- Pipedrive deal ID (unique reference)
- Job details (title, qualifications, description)
- Location, department, salary range
- Security level and priority
- Active status tracking

### Matches Table
- Foreign keys to Candidate and Job
- Agent name (which AI agent made the match)
- Match score (0-100)
- Summary text (reasoning for the match)
- Admin approval status and notes
- Timestamps for tracking

### Settings Table
- Key-value storage for configuration
- Supports JSON values
- Used for synonyms dictionary and log settings

## Setup and Installation

### Prerequisites
- Python 3.10+
- PostgreSQL 12+
- pip

### Installation

1. Clone the repository and create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Create PostgreSQL database:
```bash
createdb panda_vision_recruit
```

5. Run the application:
```bash
python -m app.main
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Candidates
- `GET /candidates/` - List candidates (default: active only)
  - Query params: `status`, `skip`, `limit`
- `GET /candidates/{candidate_id}` - Get candidate details

### Jobs
- `GET /jobs/` - List jobs
  - Query params: `priority`, `is_active`, `skip`, `limit`
- `GET /jobs/{job_id}` - Get job details
- `POST /jobs/sync-from-pipedrive` - Manually sync jobs from Pipedrive

### Email Scanning
- `POST /email/scan` - Trigger manual email scan and candidate processing
- `GET /email/scan-logs` - List email scan logs
  - Query params: `status`, `skip`, `limit`
- `GET /email/scan-logs/{log_id}` - Get detailed scan log information

## Pipedrive Integration

The Pipedrive service automatically:
1. Fetches all open deals from Pipedrive
2. Filters deals with non-empty job_title field
3. Creates or updates Job records in the database
4. Maps Pipedrive fields to our Job model

### Configuration
Set the following environment variables:
- `PIPEDRIVE_API_KEY`: Your Pipedrive API key
- `PIPEDRIVE_BASE_URL`: Pipedrive API endpoint (default: https://api.pipedrive.com/v1)

## Email Scanning & CV Processing

The email scanner monitors the `jobs@pandatech.co.il` mailbox and automatically processes incoming CVs.

### Features
- **Automated Email Monitoring**: Fetches unread emails with attachments
- **Document Parsing**: Extracts text from PDF, DOCX, and DOC files
- **Duplicate Detection**: Prevents duplicate candidates using email and name matching
- **Security Classification**: Automatically classifies candidates based on keyword analysis
- **Background Tasks**: Periodic scanning runs automatically (configurable interval)
- **Detailed Logging**: Tracks all scan cycles with success/error metrics

### Supported File Formats
- **PDF** - Parsed using PyMuPDF (fitz)
- **DOCX** - Parsed using python-docx
- **DOC** - Parsed using textract or python-docx fallback

### Security Classification
The system identifies security clearance requirements using keyword matching:
- **Top Secret**: סוד עליון, top secret, סוד מדינה
- **Secret**: secret, סוד, סודי
- **Confidential**: confidential, חסוי, sensitive

### Configuration
Set the following environment variables:
- `AZURE_TENANT_ID`: Your Azure/Office 365 tenant ID
- `AZURE_CLIENT_ID`: Application (client) ID
- `AZURE_CLIENT_SECRET`: Client secret
- `EMAIL_ADDRESS`: Email address to monitor (default: jobs@pandatech.co.il)
- `EMAIL_SCAN_INTERVAL_MINUTES`: How often to scan (default: 30)
- `EMAIL_SCAN_LIMIT`: Max emails to process per scan (default: 50)

### Workflow
1. System scans for unread emails with attachments
2. Downloads and parses document attachments
3. Extracts candidate information (name, email, phone, location)
4. Performs duplicate check based on email and name similarity
5. Classifies security level based on document content
6. Creates new candidate or updates existing one
7. Marks email as read
8. Logs scan results (created, updated, errors)

## Database Migrations (Future)

Alembic is included for database migrations:
```bash
alembic init alembic
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

## Error Handling and Logging

- All endpoints include proper error handling
- Logging is configured at the application level
- Database operations are logged
- Pipedrive sync operations include detailed logging

## Next Steps

1. **AI Agents**: Implement matching algorithms in `app/agents/`
2. **Authentication**: Add user authentication and authorization
3. **Admin Dashboard**: Create web interface for approval workflow
4. **Email Integration**: Handle candidate email imports
5. **Advanced Matching**: Implement similarity scoring between candidates and jobs

## Development

### Running Tests
```bash
pytest
```

### Code Style
The project follows PEP 8 standards. Use:
```bash
flake8 app/
black app/
```

## License

Proprietary - PandaTech
