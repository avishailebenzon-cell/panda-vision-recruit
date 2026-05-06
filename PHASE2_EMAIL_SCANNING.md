# Phase 2: Email Scanning & CV Processing Implementation

## Overview

This phase implements automated email monitoring and CV parsing. The system scans the `jobs@pandatech.co.il` mailbox, extracts documents, parses candidate information, and stores it in the database with automatic duplicate detection and security classification.

## Architecture

### Services

#### 1. **AzureEmailService** (`app/services/azure_email.py`)
Connects to Microsoft 365 via Microsoft Graph API.

**Methods:**
- `get_access_token()` - Obtains OAuth2 token from Azure
- `fetch_unread_messages()` - Fetches unread emails with attachments
- `get_message_attachments()` - Lists attachments for a message
- `download_attachment()` - Downloads attachment binary content
- `mark_as_read()` - Marks email as read after processing

**Configuration:**
```
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_app_id
AZURE_CLIENT_SECRET=your_secret
EMAIL_ADDRESS=jobs@pandatech.co.il
```

#### 2. **DocumentParser** (`app/services/document_parser.py`)
Extracts text from various document formats.

**Supported Formats:**
- PDF - Uses PyMuPDF (fitz)
- DOCX - Uses python-docx
- DOC - Uses textract with python-docx fallback

**Methods:**
- `parse_pdf(content)` - Extract text from PDF
- `parse_docx(content)` - Extract text from DOCX
- `parse_doc(content)` - Extract text from DOC
- `parse_document(content, filename)` - Auto-detect format
- `is_supported_format(filename)` - Check if format is supported

#### 3. **CandidateProcessor** (`app/services/candidate_processor.py`)
Processes extracted candidate data.

**Key Features:**
- **Information Extraction**: Parses name, email, phone, location from document text
- **Duplicate Detection**: Email match (primary) + name fuzzy match (secondary)
- **Security Classification**: Regex-based keyword matching
- **Save/Update Logic**: Idempotent with timestamp-based updates

**Methods:**
- `extract_candidate_info()` - Parse basic info from text
- `classify_security_level()` - Determine security clearance level
- `find_duplicate_candidate()` - Check for existing candidates
- `save_or_update_candidate()` - Insert or update in database

#### 4. **EmailScanner** (`app/services/email_scanner.py`)
Orchestrator that runs the full pipeline.

**Workflow:**
1. Fetch unread messages from mailbox
2. For each message:
   - Download attachments
   - Parse documents
   - Extract candidate info
   - Classify security level
   - Save/update candidate
   - Mark email as read
3. Log scan results

#### 5. **TaskScheduler** (`app/tasks/scheduler.py`)
Background task scheduling using APScheduler.

**Features:**
- Configurable interval (default: 30 minutes)
- Single-instance constraint (no concurrent scans)
- Graceful startup/shutdown
- Automatic retry on failure

## Database Schema

### New Table: email_scan_logs
Tracks every scan cycle for monitoring and debugging.

```sql
CREATE TABLE email_scan_logs (
    id SERIAL PRIMARY KEY,
    scan_start_time TIMESTAMP NOT NULL,
    scan_end_time TIMESTAMP,
    total_emails_scanned INTEGER DEFAULT 0,
    attachments_found INTEGER DEFAULT 0,
    candidates_created INTEGER DEFAULT 0,
    candidates_updated INTEGER DEFAULT 0,
    candidates_skipped INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing',  -- processing, completed, failed
    error_message TEXT,
    details JSONB,  -- Detailed error/success info
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Email Scanning
All endpoints in `/email` prefix.

#### POST /email/scan
Trigger manual email scan.

**Response:**
```json
{
  "status": "success",
  "message": "Scan completed: 5 created, 3 updated",
  "details": {
    "total_emails_scanned": 10,
    "attachments_processed": 8,
    "candidates_created": 5,
    "candidates_updated": 3,
    "errors_count": 0,
    "scan_log_id": 42
  }
}
```

#### GET /email/scan-logs
List scan logs with pagination.

**Query Parameters:**
- `status`: "processing", "completed", "failed"
- `skip`: Offset (default: 0)
- `limit`: Page size (default: 10)

**Response:**
```json
{
  "total": 100,
  "skip": 0,
  "limit": 10,
  "logs": [
    {
      "id": 42,
      "status": "completed",
      "scan_start_time": "2024-05-06T10:30:00",
      "scan_end_time": "2024-05-06T10:35:23",
      "total_emails_scanned": 10,
      "attachments_found": 8,
      "candidates_created": 5,
      "candidates_updated": 3,
      "candidates_skipped": 2,
      "error_message": null
    }
  ]
}
```

#### GET /email/scan-logs/{log_id}
Get detailed information about a specific scan.

## Setup Guide

### 1. Azure/Microsoft 365 Configuration

You need to register an application in Azure AD and create credentials.

**Steps:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "App registrations"
3. Click "New registration"
4. Fill in Name: "Panda-Vision Recruit"
5. Click "Register"
6. Copy **Application (client) ID**
7. Go to "Certificates & secrets"
8. Click "New client secret"
9. Copy the secret value (shown only once!)
10. Go to "API permissions"
11. Click "Add a permission"
12. Select "Microsoft Graph"
13. Choose "Application permissions"
14. Search and add:
    - `Mail.Read` - Read emails
    - `Mail.ReadWrite` - Mark as read
15. Click "Grant admin consent"

**Result:**
```
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-secret
```

### 2. Update .env

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
AZURE_TENANT_ID=1234...
AZURE_CLIENT_ID=5678...
AZURE_CLIENT_SECRET=your-secret-key
EMAIL_ADDRESS=jobs@pandatech.co.il
EMAIL_SCAN_INTERVAL_MINUTES=30
EMAIL_SCAN_LIMIT=50
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Create Database Tables

```bash
python3 -c "
import sys
sys.path.insert(0, '.')
from app.database import init_db
import asyncio
asyncio.run(init_db())
"
```

### 5. Start the Application

```bash
python3 -m app.main
```

The API will be available at `http://localhost:8000`

## Manual Testing

### Test Email Scanning

```bash
# Trigger manual scan
curl -X POST http://localhost:8000/email/scan

# View scan logs
curl http://localhost:8000/email/scan-logs

# View scan details
curl http://localhost:8000/email/scan-logs/1
```

### View Candidates

```bash
# List all active candidates
curl http://localhost:8000/candidates/

# View specific candidate
curl http://localhost:8000/candidates/1
```

## Key Features Implemented

### ✅ Duplicate Detection
- **Email match**: Exact, case-insensitive
- **Name fuzzy match**: 80% similarity threshold
- **Update strategy**: Only updates if new email is more recent

### ✅ Security Classification
Automatic classification based on keywords:
- **Top Secret**: סוד עליון, top secret, סוד מדינה
- **Secret**: secret, סוד, סודי
- **Confidential**: confidential, חסוי, sensitive
- **No Security**: Default if no keywords match

### ✅ Background Tasks
- Runs on configurable interval (default: 30 min)
- Prevents concurrent scans
- Gracefully handles failures
- Logs all results

### ✅ Document Parsing
- Supports PDF, DOCX, DOC
- Page-aware parsing for PDFs
- Table extraction from DOCX
- Graceful fallbacks for old DOC formats

### ✅ Comprehensive Logging
- Every scan logged with metrics
- Detailed error tracking
- Attachment download history
- Candidate creation/update events

## Troubleshooting

### Azure Authentication Errors
- Check tenant ID is correct (Azure Portal > Directory Properties)
- Verify client ID and secret are current (not expired)
- Ensure API permissions are granted with admin consent

### Document Parsing Failures
- For PDF: Check file is valid PDF format
- For DOCX: Ensure file is truly DOCX (not renamed)
- For DOC: Try converting to DOCX first, or check textract is installed

### Email Not Found
- Verify EMAIL_ADDRESS is correct
- Check mailbox is not full
- Ensure attachments are supported formats (PDF, DOCX, DOC)
- Check email is still unread (system marks as read after processing)

### Duplicate Candidates
- Email match is primary detection
- Name fuzzy match only triggers if similar enough (80%+)
- Manual merging can be done in future admin UI

## Performance Considerations

- **Email Batch Size**: Limited to 50 per scan (configurable)
- **Scan Interval**: Default 30 minutes (avoid too frequent)
- **Database**: Uses connection pooling for efficiency
- **Async I/O**: All network operations are non-blocking

## Next Steps

1. **Test with real emails**: Send test CVs to jobs@pandatech.co.il
2. **Monitor logs**: Check EmailScanLog table for issues
3. **Configure keywords**: Add more security classification keywords
4. **Implement AI agents**: Use extracted data for candidate-job matching
5. **Admin UI**: Build interface for scan monitoring and candidate review

## Dependencies Added

- `azure-identity` - Azure authentication
- `msgraph-core` - Microsoft Graph SDK
- `python-docx` - DOCX parsing
- `PyMuPDF` - PDF parsing
- `pdfminer.six` - PDF fallback parsing
- `python-magic` - File type detection
- `APScheduler` - Background task scheduling
- `python-dateutil` - Date utilities
