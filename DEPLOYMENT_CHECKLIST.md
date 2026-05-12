# Production Deployment Checklist

## Frontend (Vercel) - Status: ✓ Deployed

### Build Status
- ✓ Build completes successfully on Vercel
- ✓ Panda-Vision Recruit original frontend (no Base44 dependency)
- ✓ React + Vite + Tailwind CSS configuration working properly
- ✓ App is live at: https://panda-vision-recruit-882u.vercel.app

### Environment Variables to Configure in Vercel Dashboard
No special environment variables required! The frontend connects directly to the backend API.

**Status**: ✓ READY - No configuration needed

## Backend (Render) - Status: ⚠️ Returning 502 Errors

### Current Issues
- Service is returning HTTP 502 Bad Gateway
- Likely cause: Environment variables not configured in Render dashboard

### Environment Variables to Configure in Render Dashboard
The following environment variables must be set in the Render service settings:

```
# Database - Supabase PostgreSQL
DATABASE_URL=postgresql://...

# Supabase Configuration
SUPABASE_URL=postgresql://postgres.xfxmjsyggbnreukauvhe:HGHgwc8Udd%21%21ZFy@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmeG1qc3lnZ2JucmV1a2F1dmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTkxMTQsImV4cCI6MjA5MzYzNTExNH0.d7JyOVV16AQOAf78sZkMWLUrhK6-fvocfJjmz38_PVQ
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmeG1qc3lnZ2JucmV1a2F1dmhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTExNCwiZXhwIjoyMDkzNjM1MTE0fQ.lx1Ld9lk9EDWoV9sPh4Rk_PgZbzQ77iLOWPdCvZJhHM
SUPABASE_STORAGE_BUCKET=cv-files

# Pipedrive Integration
PIPEDRIVE_API_KEY=b1dfbd1dced30682d9cc9759d1004f6dab190d7e
PIPEDRIVE_BASE_URL=https://api.pipedrive.com/v1

# Azure / Microsoft Graph Email Integration
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
EMAIL_ADDRESS=jobs@pandatech.co.il

# Email Scanning Configuration
EMAIL_SCAN_INTERVAL_MINUTES=30
EMAIL_SCAN_LIMIT=50

# Claude AI Configuration
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-opus-4-7

# Application Configuration
APP_NAME=Panda-Vision Recruit
APP_VERSION=0.1.0
DEBUG=false
LOG_LEVEL=INFO
```

**Status**: ⚠️ CRITICAL - Must be configured for service to start

### Deployment Configuration
- ✓ render.yaml created with deployment specifications
- ✓ Dockerfile configured for production
- ✓ Requirements.txt with all dependencies

## Next Steps

### 1. Configure Render Environment Variables
- Go to Render Dashboard
- Select panda-vision-recruit service
- Open Environment tab
- Add all required environment variables listed above
- Note: The render.yaml file documents required variables

### 2. Verify Backend Health
Once environment variables are set:
```bash
curl https://panda-vision-recruit.onrender.com/health
# Should return: {"status":"healthy","service":"Panda-Vision Recruit API","version":"0.1.0"}
```

### 3. Vercel Frontend Ready
- Frontend is already deployed and requires no additional configuration
- It will automatically connect to the Render backend

### 4. Test Frontend-Backend Integration
Once both services are configured:
- Access https://panda-vision-recruit-882u.vercel.app
- Verify app loads without errors
- Check browser console for any API errors
- Verify authentication flow works

### 5. Monitor Logs
- Render: Dashboard → Service → Logs
- Vercel: Deployment logs for any build/runtime errors

## Troubleshooting

### Backend 502 Errors
1. Check Render logs for Python errors
2. Verify all environment variables are set
3. Test DATABASE_URL connection string locally:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
4. Restart the Render service after setting env vars

### Frontend Build Failures
1. Check Vercel build logs
2. Ensure all required npm dependencies are installed
3. Verify vite.config.js and jsconfig.json path aliases are correct

### API Connectivity Issues
1. Verify CORS is configured correctly in backend (currently allows all origins)
2. Check browser Network tab for API request details
3. Verify Base44 SDK configuration in frontend

## Production Readiness

- [ ] All Render environment variables configured
- [ ] Backend health check endpoint responding (200 OK)
- [ ] Frontend loads successfully without console errors (no Base44 config needed)
- [ ] Frontend can fetch candidates/jobs from backend API
- [ ] End-to-end test completed
- [ ] Monitoring/alerting configured
- [ ] Backup procedures documented

## Important Notes

1. **Environment Variables**: The render.yaml file documents all required variables but they must be manually entered in the Render dashboard. Use the .env file in the repository as a reference for actual values.

2. **Security**: Never commit .env files or credentials to the repository. The .env file is in .gitignore and should only be used for local development.

3. **Database**: The application uses Supabase PostgreSQL. Ensure the DATABASE_URL connection string is correct and the service is accessible from Render.

4. **No Base44**: This deployment is completely independent of Base44. The frontend is a standard React application that connects directly to the Render backend via REST API.
