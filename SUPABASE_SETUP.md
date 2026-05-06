# Supabase Integration Setup Guide

## Overview

This guide walks through connecting Panda-Vision Recruit to Supabase for database hosting and CV file storage.

## Prerequisites

- Supabase account (free tier available)
- Project created in Supabase
- Access to Supabase dashboard

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create account
3. Click "New Project"
4. Fill in:
   - **Project Name**: `panda-vision-recruit`
   - **Database Password**: Create strong password (save it!)
   - **Region**: Select closest to your users (e.g., eu-west-1)
5. Click "Create new project" and wait 2-3 minutes

---

## Step 2: Get Connection Credentials

### Database Connection String

1. Go to Project → Settings → Database
2. Copy **Connection string** (URI tab)
3. Format: `postgresql://[user]:[password]@[host]:[port]/[database]`
4. Copy full URL to `.env`:

```
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Important**: Use the **pooled connection** URL (port 6543) for FastAPI, not the direct connection.

### API Keys

1. Go to Project → Settings → API
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_KEY`

3. Update `.env`:

```
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Initialize Database Schema

### Option A: SQL Editor (Recommended for First Time)

1. Go to Project → SQL Editor
2. Click "New Query"
3. Copy entire contents of `database/supabase_init.sql`
4. Paste into SQL editor
5. Click "Run" (⌘+Enter or Ctrl+Enter)
6. Wait for confirmation message

### Option B: Via psql CLI

```bash
# Connect to Supabase database
psql "postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Run initialization script
\i database/supabase_init.sql

# Verify tables created
\dt
```

---

## Step 4: Create Storage Bucket

1. Go to Project → Storage
2. Click "New bucket"
3. Configure:
   - **Name**: `cv-files`
   - **Public bucket**: Toggle ON (allow public read access)
4. Click "Create bucket"

### Set Storage Policies

1. Click on `cv-files` bucket
2. Go to "Policies" tab
3. Click "New policy"

**Policy 1: Public Read**
```
Allow public read access
```
- Template: "Enable read access for everyone"
- Click "Review" → "Save"

**Policy 2: Authenticated Upload**
```
Allow authenticated users to upload
```
- Template: "Enable insert access for authenticated users only"
- Click "Review" → "Save"

---

## Step 5: Update Application Configuration

### 1. Environment Variables

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
# Database
DATABASE_URL=postgresql://postgres.[ID]:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Supabase
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_BUCKET=cv-files

# Other credentials...
ANTHROPIC_API_KEY=...
AZURE_TENANT_ID=...
# etc.
```

### 2. Test Connection

```python
# In Python shell
from app.config import get_settings
from app.database import SessionLocal

settings = get_settings()
print(f"Database URL: {settings.database_url[:50]}...")

# Try to create a session
db = SessionLocal()
db.execute("SELECT 1")
print("✓ Database connection successful!")
```

---

## Step 6: Verify Tables

### In Supabase Dashboard

1. Go to Project → Table editor
2. Should see all tables:
   - ✓ candidates
   - ✓ jobs
   - ✓ matches
   - ✓ synonyms_dictionary
   - ✓ system_logs
   - ✓ email_scan_logs
   - ✓ agent_tasks
   - ✓ agent_logs
   - ✓ feedback_logs

### Via SQL Query

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## Step 7: Configure Row Level Security (RLS)

### Enable RLS (Already Done in Init Script)

Tables have RLS enabled with basic policies. For production:

1. Go to each table in "Authentication" tab
2. Verify RLS is enabled (toggle ON)
3. Review policies under "Policies"

### Policy Overview

**Current Setup:**
- `anon` role: Read-only access
- `authenticated` role: Full access
- Backend service role: Full access via service key

**For Production:**
Consider adding user-specific policies if implementing multi-tenant features.

---

## Step 8: Test Email Scanning with Storage

### Manual Test

```bash
# 1. Start the API
python3 -m app.main

# 2. Send test email to jobs@pandatech.co.il
# (with PDF/DOCX attachment)

# 3. Trigger scan
curl -X POST http://localhost:8000/email/scan

# 4. Check results
curl http://localhost:8000/candidates/

# 5. Verify CV in Supabase Storage:
# Go to Storage → cv-files, should see:
# cv-files/candidate-1/20250506_120000.pdf
```

### Check Stored URLs

In Supabase:
```sql
SELECT id, email, cv_url, scanned_date
FROM candidates
WHERE cv_url IS NOT NULL
ORDER BY created_at DESC;
```

Should show URLs like:
```
https://[PROJECT_ID].supabase.co/storage/v1/object/public/cv-files/candidate-1/20250506_120000.pdf
```

---

## Security Checklist

### Database Security

- ✅ Connection via pooled connection (port 6543)
- ✅ Password stored in environment variable
- ✅ RLS enabled on all tables
- ✅ Row policies configured
- ✅ anon role restricted to read-only

### Storage Security

- ✅ CV bucket is public for reads (needed for download links)
- ✅ Upload restricted to authenticated users
- ✅ Files organized by candidate ID
- ✅ Timestamps in filenames (prevent overwrites)

### API Keys

- ✅ Stored in `.env` (never in code)
- ✅ `.env` in `.gitignore`
- ✅ Service role key not exposed to frontend
- ✅ Public anon key has limited permissions

### Recommendations for Production

1. **Rotate API Keys Regularly**
   - Supabase → Settings → API → Regenerate
   - Update in environment variables

2. **Enable Backups**
   - Supabase → Backups → Enable
   - Daily backups (free tier has 7-day retention)

3. **Monitor Usage**
   - Supabase → Usage → Check database/storage limits
   - Free tier: 500MB database, 1GB storage

4. **Rate Limiting** (Future)
   - Add middleware for API rate limiting
   - Prevent abuse of storage upload

---

## Troubleshooting

### Connection Errors

**Error**: `could not translate host name "aws-0-eu-west-1.pooler.supabase.com" to address`

**Solution**:
- Check if you're using pooled URL (port 6543, not 5432)
- Verify DATABASE_URL in `.env`
- Restart application

**Error**: `FATAL: password authentication failed`

**Solution**:
- Verify database password is correct
- Check for special characters (escape if needed)
- Reset password in Supabase → Settings → Database → Reset Password

### Storage Upload Failures

**Error**: `401 Unauthorized`

**Solution**:
- Check SUPABASE_URL and SUPABASE_KEY in `.env`
- Verify bucket policies are set correctly
- Ensure cv-files bucket is public

**Error**: `cv-files bucket not found`

**Solution**:
- Create bucket in Supabase dashboard → Storage
- Verify bucket name is exactly "cv-files"
- Refresh page

### RLS/Permission Issues

**Error**: `new row violates row-level security policy for table`

**Solution**:
- Verify RLS policies allow write access
- Check role being used (authenticated vs anon)
- Backend uses service role (full access)

---

## Database Backups

### Automatic Backups

Supabase provides:
- **Daily**: 7 days retention (free tier)
- **Weekly**: 28 days retention (paid tier)

Enable in: Project → Backups → Enable Backups

### Manual Backup

```bash
# Dump database
pg_dump "postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" > backup.sql

# Restore from backup
psql "postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" < backup.sql
```

---

## Monitoring & Maintenance

### Check Database Health

```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for unused indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_%';

-- Monitor connection count
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;
```

### Check Storage Usage

```sql
-- Count files in storage
SELECT COUNT(*) as total_files
FROM storage.objects
WHERE bucket_id = 'cv-files';

-- Sum storage usage
SELECT pg_size_pretty(sum(metadata->>'size')::bigint)
FROM storage.objects
WHERE bucket_id = 'cv-files';
```

---

## Cost Estimation

### Free Tier Limits

- **Database**: 500 MB
- **Storage**: 1 GB
- **Bandwidth**: 2 GB/month
- **API requests**: Unlimited

### Scaling Estimates

| Users | Databases | Storage | Monthly Cost |
|-------|-----------|---------|--------------|
| 100 | <50MB | <100MB | $0 (free) |
| 1,000 | 100-200MB | 500MB-1GB | $25-50 |
| 10,000 | 500MB+ | 5GB+ | $100+ |

For details: [Supabase Pricing](https://supabase.com/pricing)

---

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Initialize database schema
3. ✅ Configure Storage bucket
4. ✅ Test email scanning with CV uploads
5. → Deploy to production environment
6. → Set up monitoring and alerts
7. → Configure automated backups

---

## Getting Help

- **Supabase Docs**: https://supabase.com/docs
- **API Reference**: https://supabase.com/docs/reference/javascript
- **Postgres Docs**: https://www.postgresql.org/docs/
- **Discord Community**: https://discord.supabase.com

---

## Schema Reference

All tables, views, and policies are defined in `database/supabase_init.sql`.

For modifications:
1. Make changes in SQL file
2. Run in Supabase SQL Editor
3. Or use migrations (future: Alembic setup)

**Important**: Always backup before schema changes!
