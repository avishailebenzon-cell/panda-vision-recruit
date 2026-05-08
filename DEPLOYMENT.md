# Panda-Vision Recruit - Production Deployment Guide

## System Status: FULLY OPERATIONAL ✅

The entire system has been developed and tested end-to-end. All components are working:
- Backend API (FastAPI) on port 8001 ✓
- Frontend (React/Vite) on port 5173 ✓
- Database (SQLite for dev, PostgreSQL ready for prod) ✓
- Authentication (JWT + argon2) ✓
- All CRUD endpoints operational ✓

## Deployment Steps

### Option 1: Deploy to Render (Recommended for Backend)

#### Backend Deployment (Render Web Service):

1. **Create Render Account & Project**
   - Go to https://render.com
   - Create new Web Service
   - Connect GitHub repository (Panda-Vision Recruit)

2. **Configure Service**
   - Name: `panda-vision-backend`
   - Environment: `Python 3.11`
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn -w 4 -b 0.0.0.0:8000 -k uvicorn.workers.UvicornWorker app.main:app`
   - Region: Choose closest to users

3. **Add PostgreSQL Database**
   - Create PostgreSQL instance on Render
   - Note the connection string

4. **Set Environment Variables**
   ```
   DATABASE_URL=postgresql://[user]:[password]@[host]/[db]
   SECRET_KEY=[generate-strong-secret-key]
   PIPEDRIVE_API_KEY=[your-pipedrive-api-key]
   DEBUG=false
   ```

5. **Deploy**
   - Render will auto-deploy on git push
   - Check deployment logs at https://dashboard.render.com

#### Backend Deployment (Railway Alternative):

1. **Create Railway Account**
   - Go to https://railway.app
   - Create new project
   - Connect GitHub

2. **Add PostgreSQL Plugin**
   - Railway → Plugins → Add PostgreSQL

3. **Configure Environment**
   - Copy DATABASE_URL from PostgreSQL
   - Add other env vars (SECRET_KEY, PIPEDRIVE_API_KEY)

4. **Deploy**
   - Railway will auto-deploy

### Option 2: Deploy Frontend to Vercel

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign in with GitHub
   - Import project from GitHub

2. **Configure Frontend**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `frontend`

3. **Set Environment Variables**
   ```
   VITE_API_URL=[your-backend-production-url]
   ```
   Example: `https://panda-vision-backend.onrender.com`

4. **Deploy**
   - Vercel will auto-deploy on git push
   - Frontend available at: `https://[project-name].vercel.app`

### Option 3: Deploy Everything Locally with Docker

```bash
# Create production .env file
cat > .env.prod << 'ENVEOF'
DATABASE_URL=postgresql://panda_user:secure_password@postgres:5432/panda_vision_db
SECRET_KEY=your-production-secret-key-here
PIPEDRIVE_API_KEY=your-pipedrive-api-key
DEBUG=false
ENVEOF

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker exec panda-vision-backend alembic upgrade head

# Access services
# Backend: http://localhost:8000
# PostgreSQL: localhost:5432
```

## Post-Deployment Checklist

- [ ] Backend API responding on production URL
- [ ] Frontend loading and connecting to backend API
- [ ] Authentication working (register/login)
- [ ] Candidates CRUD operations working
- [ ] Jobs endpoints accessible
- [ ] Tasks management functional
- [ ] Database migrations completed
- [ ] Error logging configured
- [ ] Health check endpoint returning 200

## Important URLs

### Development
- Backend: http://localhost:8001
- Frontend: http://localhost:5173
- Database: sqlite:///test.db

### Production (After Deployment)
- Backend: https://panda-vision-backend.onrender.com (example)
- Frontend: https://panda-vision-recruit.vercel.app (example)
- Database: PostgreSQL on Render/Railway

## Environment Variables Required

### Backend (.env)
```
DATABASE_URL=postgresql://[user]:[password]@[host]/[db]
SECRET_KEY=[strong-secret-key-at-least-32-chars]
PIPEDRIVE_API_KEY=[your-api-key]
AZURE_TENANT_ID=[optional-for-email-scanning]
AZURE_CLIENT_ID=[optional-for-email-scanning]
AZURE_CLIENT_SECRET=[optional-for-email-scanning]
DEBUG=false
```

### Frontend (.env)
```
VITE_API_URL=[production-backend-url]
```

## Troubleshooting

### Backend won't start
- Check DATABASE_URL is correct
- Verify PostgreSQL is running
- Check logs: `docker logs panda-vision-backend`

### Frontend can't reach backend
- Verify VITE_API_URL is set correctly
- Check CORS is enabled in FastAPI (already configured)
- Check network connectivity

### Database connection failing
- Verify credentials in DATABASE_URL
- Ensure PostgreSQL is running
- Check firewall rules

## Next Steps

1. **Monitoring**: Set up error logging (Sentry)
2. **CI/CD**: Configure auto-deploy on git push
3. **Email Scanning**: Configure Azure credentials for email integration
4. **AI Agents**: Configure Claude API key for matching agents
5. **Backup**: Set up automated database backups

## Support

For issues or questions:
1. Check logs in deployment platform
2. Review error messages in browser console (frontend)
3. Check API response status codes
4. Verify environment variables are set correctly
