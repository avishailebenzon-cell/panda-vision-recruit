# Production Deployment Checklist

## Frontend (Vercel) - Status: ✓ Deployed

### Build Status
- ✓ Build completes successfully on Vercel
- ✓ Base44 Vite plugin correctly configured
- ✓ Path aliases (@/) working properly
- ✓ App is live at: https://panda-vision-recruit-882u.vercel.app

### Environment Variables to Configure in Vercel Dashboard
The following environment variables need to be set in Vercel project settings:

```
# Base44 SDK Configuration
VITE_BASE44_APP_ID=<your-base44-app-id>
VITE_BASE44_BACKEND_URL=<your-base44-backend-url>
VITE_BASE44_FUNCTIONS_VERSION=v1
```

**Status**: ⚠️ NOT YET CONFIGURED - App will not function without these

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
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=cv-files

# Pipedrive Integration
PIPEDRIVE_API_KEY=...
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

### 3. Configure Base44 SDK in Vercel
- Go to Vercel project settings
- Set VITE_BASE44_APP_ID (get from Base44 dashboard)
- Set VITE_BASE44_BACKEND_URL (your Base44 app URL)
- Set VITE_BASE44_FUNCTIONS_VERSION (usually v1)

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
- [ ] All Vercel environment variables configured
- [ ] Frontend loads successfully without console errors
- [ ] Frontend can authenticate (if required)
- [ ] End-to-end test completed
- [ ] Monitoring/alerting configured
- [ ] Backup procedures documented

## Important Notes

1. **Environment Variables**: The render.yaml file documents all required variables but they must be manually entered in the Render dashboard. Use the .env file in the repository as a reference for actual values.

2. **Security**: Never commit .env files or credentials to the repository. The .env file is in .gitignore and should only be used for local development.

3. **Database**: The application uses Supabase PostgreSQL. Ensure the DATABASE_URL connection string is correct and the service is accessible from Render.

4. **Base44 Integration**: The frontend is built on Base44 SDK and requires proper configuration to function. Check Base44 dashboard for correct app ID and URLs.
