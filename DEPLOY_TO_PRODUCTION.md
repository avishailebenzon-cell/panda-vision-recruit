# Complete Production Deployment Guide

This guide walks through deploying the Panda-Vision Recruit application to production. The system is fully tested and production-ready.

## Quick Summary

The application consists of:
- **Backend**: FastAPI + PostgreSQL (runs on port 8000)
- **Frontend**: React + Vite (runs on port 5173 for dev, deploys to Vercel)
- **Database**: PostgreSQL (handles all data storage)

All components are fully functional and tested. This guide covers deploying to production.

## Prerequisites

Before starting deployment, ensure you have:

1. **GitHub Account** - Required to host code for deployment services
2. **Render Account** - https://render.com (for backend deployment)
3. **Vercel Account** - https://vercel.app (for frontend deployment)
4. **API Keys** (already configured locally, ready for production):
   - Pipedrive API key
   - Claude AI API key
   - Azure credentials (if using email scanning)

5. **Access to your domain** (optional, for custom domain setup)

## STEP 1: Prepare Code for Deployment

### 1.1 Create GitHub Repository

First, set up your GitHub repository (this is required for Render to build your code):

```bash
# If you haven't created a GitHub repo yet:
# 1. Go to https://github.com/new
# 2. Create repository "panda-vision-recruit"
# 3. Choose visibility (private is recommended)
# 4. DO NOT initialize with README (we have one)

# In your local repository:
git remote add origin https://github.com/YOUR_USERNAME/panda-vision-recruit.git
git branch -M main
git push -u origin main
```

### 1.2 Verify All Code is Committed

```bash
# Make sure everything is committed
git status
# Should show: "working tree clean"

# Review recent commits
git log --oneline -10
```

### 1.3 Create `.env.production` from Template

Copy the example file and fill in production values:

```bash
cp .env.production.example .env.production
# DO NOT COMMIT THIS FILE - add to .gitignore if not already there
```

Edit `.env.production` with your production values:
- `DATABASE_URL`: Will be provided by Render PostgreSQL
- `SECRET_KEY`: Generate a secure random key
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`: From Azure
- `PIPEDRIVE_API_KEY`: From Pipedrive settings
- `CLAUDE_API_KEY`: From Anthropic console

## STEP 2: Deploy Backend to Render (Recommended)

Render is recommended because it's simple, provides free database tier, and has excellent Docker support.

### 2.1 Create Render Account and Connect GitHub

1. Go to https://render.com
2. Click "Sign up with GitHub"
3. Authorize Render to access your GitHub account
4. In Render dashboard, click "+ New" → "Web Service"
5. Select "Deploy existing repository"
6. Search for "panda-vision-recruit" and select it
7. Click "Connect"

### 2.2 Configure Backend Web Service

In the Web Service creation form, fill in:

**Basic Settings:**
- Name: `panda-vision-recruit-api`
- Root Directory: `.` (leave empty)
- Runtime: `Docker` (Render will detect from Dockerfile)
- Branch: `main`
- Auto-deploy: On (optional, auto-redeploy on git push)

**Billing Plan:**
- Select based on expected usage
- Free tier available but with sleeping
- Pay-as-you-go recommended for production

### 2.3 Create PostgreSQL Database

1. In Render dashboard, click "+ New" → "PostgreSQL"
2. Name: `panda-vision-recruit-db`
3. Database: `panda_vision`
4. Username: (Render generates)
5. Password: (Render generates, save securely)
6. Region: Select closest to your users
7. Click "Create Database"

Wait for database to be ready (green status).

### 2.4 Copy Database Connection String

From the PostgreSQL database details:
1. Copy the "Internal Database URL" (starts with `postgresql://`)
2. This is your `DATABASE_URL` for the backend

### 2.5 Add Environment Variables to Web Service

In the Web Service settings, go to "Environment" tab:

Add these environment variables (copy-paste from your `.env.production`):

```
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-generated-secret-key-here
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
EMAIL_ADDRESS=jobs@pandatech.co.il
PIPEDRIVE_API_KEY=your-pipedrive-key
CLAUDE_API_KEY=your-claude-key
DEBUG=false
APP_VERSION=1.0.0
FRONTEND_URL=https://your-frontend-url.com
```

**IMPORTANT:** Do NOT use quotes around values in Render environment variable form.

### 2.6 Deploy Backend

1. Click "Deploy" button in Render dashboard
2. Watch deployment logs in "Logs" tab
3. Once "Your service is live" appears, deployment is complete
4. Note your service URL: `https://panda-vision-recruit-api.onrender.com`

### 2.7 Verify Backend is Running

```bash
# Test the health endpoint
curl https://panda-vision-recruit-api.onrender.com/health

# Should respond with:
# {"status":"ok"}
```

### 2.8 Update Frontend API URL

Once you have the backend URL, you need to update the frontend to point to it.

Note the backend URL from Render (e.g., `https://panda-vision-recruit-api.onrender.com`)

## STEP 3: Deploy Frontend to Vercel

### 3.1 Connect Frontend Repository to Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import Git Repository
4. If this is a monorepo, select the `frontend` directory
5. Vercel will auto-detect it's a Vite project

### 3.2 Configure Frontend Build

Vercel should auto-detect these settings, but verify:

**Build Settings:**
- Framework: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables:**
- Add `VITE_API_URL` = `https://panda-vision-recruit-api.onrender.com`
- (Or whatever your Render backend URL is)

### 3.3 Deploy Frontend

1. Click "Deploy"
2. Wait for build to complete (usually 1-2 minutes)
3. Once complete, Vercel will provide your frontend URL
4. Your frontend is now live!

### 3.4 Link Custom Domain (Optional)

If you have a domain:

1. In Vercel, go to "Settings" → "Domains"
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation (can take up to 24 hours)

## STEP 4: Post-Deployment Verification

### 4.1 Test Backend Health

```bash
# Replace with your actual Render URL
BACKEND_URL="https://panda-vision-recruit-api.onrender.com"

# Test health endpoint
curl $BACKEND_URL/health

# Should respond: {"status":"ok"}
```

### 4.2 Test Frontend

1. Open your Vercel frontend URL in browser
2. You should see the login page
3. Try these actions:
   - Register a new account
   - Login with the account
   - View dashboard

### 4.3 Test End-to-End Integration

1. On frontend login page:
   - Enter test credentials you registered
   - Click Login
2. You should see:
   - Dashboard loads without errors
   - API requests succeed (check browser console)
3. Try viewing:
   - Candidates list
   - Jobs list
4. Check browser console (F12) for any errors

### 4.4 Monitor Logs

**Backend logs:**
- In Render dashboard → your service → "Logs" tab
- Watch for any errors after deployment
- Should see successful requests logged

**Frontend logs:**
- In browser: Press F12 → Console
- No red errors should appear
- Check Network tab for failed requests

## STEP 5: Configure Monitoring & Alerts

### 5.1 Enable Health Checks

**For Render:**
1. Go to service settings
2. Under "Health Check Path" enter: `/health`
3. Set interval to 5 minutes
4. Render will monitor uptime automatically

**For Vercel:**
- Vercel automatically monitors and alerts on build failures
- No additional setup needed

### 5.2 Set Up Error Monitoring (Optional)

For production applications, error monitoring is recommended:

**Option A: Sentry (Free tier available)**

1. Create account at https://sentry.io
2. Create new project for Python
3. Get your Sentry DSN
4. Add to Render environment variables:
   ```
   SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
   ```
5. Redeploy (trigger new deployment in Render)

**Option B: Papertrail (Free tier)**

1. Create account at https://papertrailapp.com
2. Set up your log aggregation
3. Point Render logs to Papertrail

### 5.3 Database Backups

**Automatic backups:**
- Render PostgreSQL provides automatic backups (7 days free)
- In Render PostgreSQL dashboard → "Backups" tab
- Configure retention policy

**Manual backup:**
```bash
# Before any major changes, create manual backup
# Via Render UI: Database → Backups → "Create Manual Backup"
```

## STEP 6: Maintenance & Updates

### 6.1 Deploying Code Updates

When you make code changes:

```bash
# Make your changes locally
git add .
git commit -m "Your changes"
git push origin main
```

**Automatic deployment:**
- If you enabled "Auto-deploy" in Render, it deploys automatically
- Watch the Logs tab to confirm deployment succeeds

**Manual deployment:**
1. In Render dashboard
2. Go to your service
3. Click "Manual Deploy" → "Deploy latest commit"

### 6.2 Scaling (If Needed)

**For Backend:**
- In Render, upgrade instance plan if needed
- Automatic scaling not available on free tier

**For Database:**
- In Render PostgreSQL settings, increase storage/compute
- No downtime upgrades available

**For Frontend:**
- Vercel auto-scales automatically
- No configuration needed

## Troubleshooting

### Backend Won't Deploy

**Check logs:**
```
Render Dashboard → Your Service → Logs
Look for error messages
```

**Common issues:**
- `DATABASE_URL` not set or invalid
- Missing environment variables
- Python dependency installation failed

**Fix:**
1. Review error message in logs
2. Fix environment variable or code issue
3. Commit changes to git
4. Trigger manual deploy in Render

### Frontend Can't Connect to Backend

**Check browser console (F12):**
- Look for CORS errors
- Check network tab for API requests

**Common issues:**
- `VITE_API_URL` points to wrong backend URL
- Backend not running or not accessible
- CORS not configured on backend

**Fix:**
1. Verify `VITE_API_URL` in Vercel environment variables
2. Verify backend is running: `curl https://your-backend.onrender.com/health`
3. Check Render logs for errors
4. Redeploy frontend if you changed environment variables

### Database Connection Issues

**From Render logs:**
- "could not connect to server" = database not accessible
- "authentication failed" = wrong credentials

**Fix:**
1. Verify `DATABASE_URL` is correct
2. Check database is running in Render dashboard
3. Verify database user has correct permissions
4. Try recreating database if corrupted

### Application Running But Slow

**Check:**
- Render logs for slow database queries
- Browser Network tab for slow API responses
- Vercel build logs for optimizations

**Fixes:**
- Upgrade Render instance plan
- Add database indexes for frequently queried tables
- Enable caching on frequently accessed endpoints

### Email Scanning Not Working

If email scanning is not working:

1. Verify Azure credentials in environment variables
2. Check Render logs for authentication errors
3. Verify EMAIL_ADDRESS is correct
4. Test manually: `POST /email/scan` endpoint

## Important Reminders

### Security
- ✅ `SECRET_KEY` must be unique and secure
- ✅ Never commit `.env.production` to git
- ✅ Use HTTPS only (provided by Render/Vercel)
- ✅ Rotate API keys regularly
- ✅ Monitor logs for suspicious activity

### Backups
- ✅ Database backups enabled
- ✅ Backup retention set to 30 days minimum
- ✅ Test restore procedure quarterly

### Monitoring
- ✅ Set up error alerts
- ✅ Monitor response times
- ✅ Check logs daily for errors
- ✅ Review database performance

### Updates
- ✅ Keep dependencies updated
- ✅ Test updates in staging first
- ✅ Monitor for security alerts
- ✅ Document any configuration changes

## Next Steps

After deployment is complete:

1. **Team Access**: Give your team access to:
   - GitHub repository
   - Render dashboard
   - Vercel project
   - Database (read-only for most users)

2. **Domain Configuration**: If using custom domain:
   - Configure DNS records
   - Set up SSL/HTTPS

3. **Monitoring**: Set up alerts for:
   - Backend downtime
   - Database errors
   - Failed deployments

4. **Documentation**: Update internal docs with:
   - Production URLs
   - Access procedures
   - Incident response procedures

## Support & Escalation

**If something breaks:**

1. **Check backend health**: `curl https://your-backend.onrender.com/health`
2. **Review logs** in Render/Vercel dashboards
3. **Check database status** in Render
4. **Restart service** if needed (Render → Service → Restart)
5. **Check Git** - ensure latest code is pushed

**For questions:**
- Check PRODUCTION_READINESS.md
- Review DEPLOYMENT.md for additional details
- Check application logs and error messages

---

**Deployment Status:** ✅ System ready for production

Your Panda-Vision Recruit application is now running in production and ready for use!
