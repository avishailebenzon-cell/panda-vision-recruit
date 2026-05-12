# Panda-Vision Recruit - Setup & Deployment Guide

## Project Overview

**Panda-Vision Recruit** is an AI-powered recruitment management system consisting of:
- **Backend**: FastAPI + PostgreSQL on Render
- **Frontend**: React + Vite on Vercel
- **Database**: Supabase PostgreSQL

No Base44 dependency - fully independent system.

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/avishailebenzon-cell/panda-vision-recruit.git
cd panda-vision-recruit

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example in root if it exists)
# Make sure to set: DATABASE_URL, SUPABASE_*, PIPEDRIVE_*, AZURE_*, ANTHROPIC_API_KEY

# Run the server
python3 -m app.main

# Server runs on http://localhost:8000
# Health check: curl http://localhost:8000/health
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file with:
# VITE_API_URL=http://localhost:8000

# Run development server
npm run dev

# Frontend runs on http://localhost:5173
```

---

## Production Deployment

### Status
- ✅ **Backend**: Deployed on Render (panda-vision-recruit.onrender.com)
- ✅ **Frontend**: Deployed on Vercel (panda-vision-recruit-882u.vercel.app)

### Required Configuration

#### 1. Render Backend - Environment Variables

Go to https://dashboard.render.com and set these in the service environment:

```
DATABASE_URL=postgresql://...  [Supabase connection string]
SUPABASE_URL=https://...       [Your Supabase URL]
SUPABASE_KEY=...               [Supabase anon key]
SUPABASE_SERVICE_KEY=...       [Supabase service role key]
SUPABASE_STORAGE_BUCKET=cv-files

PIPEDRIVE_API_KEY=...          [Your Pipedrive API key]
PIPEDRIVE_BASE_URL=https://api.pipedrive.com/v1

AZURE_TENANT_ID=...            [Your Azure tenant ID]
AZURE_CLIENT_ID=...            [Your Azure client ID]
AZURE_CLIENT_SECRET=...        [Your Azure client secret]
EMAIL_ADDRESS=jobs@pandatech.co.il

EMAIL_SCAN_INTERVAL_MINUTES=30
EMAIL_SCAN_LIMIT=50

ANTHROPIC_API_KEY=...          [Your Anthropic API key]
CLAUDE_MODEL=claude-opus-4-7

DEBUG=false
LOG_LEVEL=INFO
```

**After setting variables:**
1. Click "Save" / "Deploy"
2. Wait 2-3 minutes for restart
3. Verify health: `curl https://panda-vision-recruit.onrender.com/health`

#### 2. Vercel Frontend - Environment Variables

Go to https://vercel.com/dashboard → Settings → Environment Variables

Add:
```
VITE_API_URL=https://panda-vision-recruit.onrender.com
```

**After adding:**
1. Vercel will automatically trigger a new build
2. Frontend will be updated in ~1-2 minutes

---

## API Endpoints

### Health
- `GET /health` - Service status

### Candidates
- `GET /candidates/` - List candidates
- `GET /candidates/{id}` - Get candidate details
- `POST /candidates/` - Create candidate
- `PATCH /candidates/{id}` - Update candidate

### Jobs
- `GET /jobs/` - List jobs
- `GET /jobs/{id}` - Get job details
- `POST /jobs/sync-from-pipedrive` - Sync from Pipedrive

### Matches
- `GET /matches/` - List candidate-job matches
- `PATCH /matches/{id}` - Update match status

### Email Scanning
- `POST /email/scan` - Trigger email scan
- `GET /email/scan-logs` - Get scan logs
- `GET /email/scan-status` - Get current scan status

### Agents
- `GET /agents/tasks` - Get agent tasks
- `GET /agents/logs` - Get agent logs

---

## Project Structure

```
panda-vision-recruit/
├── app/                          # Backend FastAPI application
│   ├── models/                   # SQLAlchemy models
│   ├── api/                      # API route handlers
│   ├── services/                 # Business logic
│   ├── tasks/                    # Background tasks
│   ├── main.py                   # FastAPI app
│   ├── config.py                 # Configuration
│   └── database.py               # Database setup
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/                # Page components
│   │   ├── services/             # API client
│   │   ├── hooks/                # Custom hooks
│   │   └── App.jsx               # Main app
│   ├── vite.config.js
│   ├── package.json
│   └── tailwind.config.js
│
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Docker config for Render
├── render.yaml                   # Render deployment config
├── DEPLOYMENT_CHECKLIST.md       # Deployment steps
└── SETUP_GUIDE.md               # This file
```

---

## Database Schema

### Candidates Table
```sql
id, email, name, phone, security_level, status, created_at, updated_at, ...
```

### Jobs Table
```sql
id, title, description, pipedrive_deal_id, status, created_at, updated_at, ...
```

### Matches Table
```sql
id, candidate_id, job_id, score, status, approved_by, created_at, updated_at, ...
```

---

## Troubleshooting

### Backend Not Responding (502 Error)

1. **Check Render logs**: Dashboard → Service → Logs
2. **Verify environment variables are set** - All must be configured
3. **Check database connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
4. **Restart service**: Click "Restart" in Render dashboard

### Frontend Not Loading

1. **Check Vercel logs**: Deployments tab
2. **Verify VITE_API_URL is set** in Vercel environment variables
3. **Browser console errors**: Open DevTools → Console tab
4. **Test API connectivity**: Open DevTools → Network tab, check API requests

### API Calls Failing from Frontend

1. **Check CORS configuration** in backend (currently allows all origins)
2. **Verify API URL** is correct: `https://panda-vision-recruit.onrender.com`
3. **Check backend health**: `curl https://panda-vision-recruit.onrender.com/health`

---

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | FastAPI | Modern Python web framework |
| Database ORM | SQLAlchemy 2.0 | Type-safe database operations |
| Database | PostgreSQL (Supabase) | Relational database |
| Frontend | React 19 | UI framework |
| Build Tool | Vite | Fast frontend build tool |
| Styling | Tailwind CSS | Utility-first CSS |
| Charts | Recharts | React charting library |
| Icons | Lucide React | Icon library |
| Async HTTP | httpx | Python async HTTP client |
| Background Tasks | APScheduler | Job scheduling |
| AI Integration | Anthropic SDK | Claude API integration |

---

## Important Notes

1. **No Base44**: This system is completely independent and doesn't use Base44.

2. **Environment Variables**: Always use environment variables for sensitive data (API keys, credentials).

3. **Security**:
   - Never commit `.env` files
   - Use long, random API keys
   - Rotate credentials regularly

4. **Database**:
   - Supabase PostgreSQL is used
   - Connection pooling is enabled
   - NullPool for serverless compatibility

5. **CI/CD**:
   - Render auto-deploys from `master` branch
   - Vercel auto-deploys from `master` branch
   - Both watch GitHub for changes

---

## Support

For issues or questions:
1. Check the logs (Render / Vercel dashboards)
2. Review this setup guide
3. Check the DEPLOYMENT_CHECKLIST.md
4. Examine error messages in browser console and server logs
