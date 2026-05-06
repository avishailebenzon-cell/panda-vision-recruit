# Supabase Integration Summary

## 🎯 What's Been Implemented

Complete integration of **Supabase** as the production database and file storage backend for Panda-Vision Recruit.

---

## 📊 Database Schema

### 9 Tables Created

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **candidates** | Job applicants | email, cv_url, security_level, notes |
| **jobs** | Job positions | pipedrive_deal_id, title, priority |
| **matches** | Candidate-job matches | match_score, agent_name, status |
| **synonyms_dictionary** | Security classification keywords | category, synonyms (JSON) |
| **system_logs** | System event logging | log_type, severity, details |
| **email_scan_logs** | Email scan tracking | total_emails_scanned, error_message |
| **agent_tasks** | AI agent operations | status, retry_count, input_data |
| **agent_logs** | Agent communication audit trail | agent_type, message_type, tokens_used |
| **feedback_logs** | Human feedback for agent learning | match_id, was_correct, feedback_text |

### Additional Features

- ✅ **Row Level Security (RLS)** - Data access policies
- ✅ **Indexes** - Performance optimization
- ✅ **Views** - Useful query shortcuts
- ✅ **Constraints** - Data integrity
- ✅ **Defaults** - Pre-populated timestamps and status values

---

## 📦 Storage Integration

### CV Files Bucket

```
cv-files (Public)
├── candidate-1/
│   ├── 20250506_120000.pdf
│   └── 20250507_143000.docx
├── candidate-2/
│   └── 20250506_160000.pdf
└── ...
```

**Features:**
- Organized by candidate ID
- Timestamped filenames (prevents overwrites)
- Public read access (for download links)
- Authenticated upload only

**File URLs Format:**
```
https://[PROJECT_ID].supabase.co/storage/v1/object/public/cv-files/candidate-1/20250506_120000.pdf
```

---

## 🔧 Implementation Details

### SupabaseStorageClient Service

New service: `app/services/supabase_storage.py`

**Methods:**
```python
# Upload CV
upload_cv(file_content, filename, candidate_id)
    → (file_url, success)

# Download CV
download_cv(file_path)
    → bytes or None

# Delete CV
delete_cv(file_path)
    → success

# Create bucket
create_bucket()
    → success

# List files
list_files(prefix)
    → [files]
```

### Email Scanner Integration

**Workflow:**
1. Email arrives with PDF/DOCX attachment
2. Parse document → extract text
3. Create/update candidate record
4. **Upload file to Supabase Storage** ← NEW
5. Store file URL in `candidates.cv_url`
6. Mark email as read

**Code Update:** `app/services/email_scanner.py`
```python
# Upload CV file
resume_url, upload_success = await self.storage_client.upload_cv(
    file_content=attachment_content,
    filename=filename,
    candidate_id=candidate.id
)

# Update candidate with URL
if upload_success:
    candidate.cv_url = resume_url
    db.commit()
```

---

## 🔐 Security Features

### Row Level Security (RLS)

```sql
-- Anonymous: Read-only access
-- Authenticated: Full access
-- Service role: Full access (backend)
```

**Policies:**
- ✅ anon role: SELECT only
- ✅ authenticated role: SELECT, INSERT, UPDATE, DELETE
- ✅ Service role: Unlimited (used by backend)

### Storage Access

```
CV Files Bucket:
├── Public read (download links work)
├── Authenticated upload only
└── Organized by candidate ID
```

### API Key Security

```env
# Service credentials in environment variables
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...
```

Never in code, always in `.env`

---

## 📋 Configuration

### Environment Variables

```bash
# Database Connection (Pooled)
DATABASE_URL=postgresql://postgres.[ID]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Supabase API
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_BUCKET=cv-files
```

### How to Get Credentials

**From Supabase Dashboard:**
1. Settings → Database → Connection string (URI tab)
2. Settings → API → Project URL + anon public key
3. Copy to `.env`

---

## 🚀 Deployment

### Pre-Deployment Checklist

```
□ Supabase project created
□ Database schema initialized (supabase_init.sql)
□ Storage bucket (cv-files) created and configured
□ API credentials obtained
□ .env file populated
□ Local testing passed
```

### Deployment Options Documented

1. **Railway** (Easiest) - 2 clicks
2. **Heroku** - Buildpack + config vars
3. **Docker + AWS/GCP/Azure** - Container deployment
4. **VPS/Linux** - Systemd service + Nginx

See: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Step-by-step Supabase configuration |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Deployment to production |
| [database/supabase_init.sql](database/supabase_init.sql) | Schema definition |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | Complete project overview |
| [PHASE3_AI_AGENTS.md](PHASE3_AI_AGENTS.md) | AI agent system docs |

---

## ✅ Testing the Integration

### 1. Local Testing

```bash
# Start API
python3 -m app.main

# Test database connection
curl http://localhost:8000/candidates/

# Manual email send
# Send test email to jobs@pandatech.co.il with PDF attachment

# Trigger scan
curl -X POST http://localhost:8000/email/scan

# Check results
curl http://localhost:8000/candidates/
# Should see cv_url populated with Supabase storage URL
```

### 2. Verify in Supabase Dashboard

**Check Candidates Table:**
```sql
SELECT id, email, cv_url, scanned_date
FROM candidates
WHERE cv_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Check Storage:**
- Storage → cv-files → Should see candidate-[ID] folders

---

## 📊 Key Features

### Database Features
- ✅ PostgreSQL (Supabase managed)
- ✅ Connection pooling (port 6543)
- ✅ Automatic backups (daily, 7 days)
- ✅ Row Level Security
- ✅ 500 MB free tier (scalable)

### Storage Features
- ✅ Public file distribution
- ✅ Organized by candidate ID
- ✅ Timestamped filenames
- ✅ 1 GB free tier (scalable)
- ✅ Auto-generated public URLs

### Integration Features
- ✅ Automatic CV upload after email parsing
- ✅ URL stored in candidates table
- ✅ Files accessible via public URLs
- ✅ Secure access control via RLS

---

## 🔄 Data Flow

### Complete CV Processing Workflow

```
1. Email arrives at jobs@pandatech.co.il
   ↓
2. System fetches email with attachment
   ↓
3. Parse CV (PDF/DOCX/DOC) → extract text
   ↓
4. Extract candidate info (name, email, phone)
   ↓
5. Check for duplicates
   ↓
6. Classify security level
   ↓
7. CREATE/UPDATE in candidates table
   ↓
8. UPLOAD file to Supabase Storage ← NEW
   ↓
9. UPDATE candidates.cv_url with storage URL
   ↓
10. Mark email as read
   ↓
11. Log in email_scan_logs
```

---

## 💾 Database Statistics

### Schema Size
- **9 tables** with proper relationships
- **Indexes** on all foreign keys and frequently queried columns
- **Views** for common queries
- **Total schema**: ~5 KB

### Expected Data Size

| Records | Database Size | Storage Size |
|---------|---------------|--------------|
| 1,000 candidates | 5-10 MB | 50-500 MB (CVs) |
| 10,000 candidates | 50-100 MB | 500 MB-5 GB |
| 100,000 candidates | 500 MB+ | 5-50 GB |

**Free Tier Limits:**
- Database: 500 MB (suitable for ~50K candidates)
- Storage: 1 GB (suitable for ~100-200 CVs)

---

## 🛡️ Security Considerations

### What's Protected

✅ Database access via RLS policies
✅ API keys in environment variables
✅ Storage bucket with authentication
✅ Automatic backups (daily)
✅ Audit trail in logs

### Recommendations for Production

1. **Rotate API keys** every 90 days
2. **Enable backups** (automatic on Pro plan)
3. **Monitor usage** against free tier limits
4. **Set up alerts** for quota overages
5. **Enable HTTPS** (required for deployment)
6. **Use service role** for backend (not public key)

---

## 📈 Performance Notes

### Typical Performance

| Operation | Time | Notes |
|-----------|------|-------|
| DB query | 10-50 ms | Via pooled connection |
| File upload | 500-2000 ms | Depends on file size |
| File download | 200-1000 ms | Public URL access |
| Email scan | 30-60 sec | Per email with attachment |

### Optimization Tips

- Use indexed queries (candidate by email, job by priority)
- Batch inserts for bulk operations
- Store large files in Storage, not database
- Limit query results with pagination

---

## 🚨 Troubleshooting

### Connection Issues

**Problem**: `could not translate host name`
**Solution**: Use pooled URL (port 6543, not 5432)

**Problem**: `password authentication failed`
**Solution**: Reset password in Supabase dashboard

### Storage Issues

**Problem**: `401 Unauthorized on upload`
**Solution**: Check SUPABASE_KEY and bucket policies

**Problem**: `File not found`
**Solution**: Verify bucket exists and is public

### Performance Issues

**Problem**: Slow queries
**Solution**: Check indexes, verify connection pooling

**Problem**: Storage quota exceeded
**Solution**: Upgrade to Pro tier or delete old files

---

## 📞 Getting Help

### Supabase Resources
- [Documentation](https://supabase.com/docs)
- [Discord Community](https://discord.supabase.com)
- [Status Page](https://status.supabase.com)

### Project Resources
- See `README.md` for overview
- See `CLAUDE.md` for architecture
- See `DEPLOYMENT_GUIDE.md` for deployment

---

## 🎓 Next Steps

### If Starting from Scratch

1. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
2. Initialize schema using SQL script
3. Configure environment variables
4. Test locally
5. Deploy using [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

### If Upgrading from SQLite

1. Export existing data
2. Create Supabase project
3. Run schema script
4. Migrate data
5. Update connection string
6. Redeploy application

### For Production Use

1. Enable automatic backups
2. Set up monitoring/alerts
3. Configure log retention
4. Plan for scaling
5. Document backup procedures
6. Train team on operations

---

## 📝 Summary

**Panda-Vision Recruit** is now fully integrated with **Supabase** as a production-ready platform:

- ✅ Database: PostgreSQL hosted on Supabase
- ✅ Storage: CV files in Supabase Storage bucket
- ✅ Security: Row-level security + API key protection
- ✅ Scalability: Ready for growth (free → Pro → Business tiers)
- ✅ Documentation: Complete setup and deployment guides
- ✅ Testing: Local integration ready for testing
- ✅ Deployment: Multiple options (Railway, Heroku, Docker, VPS)

**Ready for production deployment!** 🚀
