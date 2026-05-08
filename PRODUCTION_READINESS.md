# Production Readiness Checklist

This document ensures the Panda-Vision Recruit application is ready for production deployment. All items must be completed before going live.

## Pre-Deployment Phase

### 1. Code & Git Management
- [x] All code committed to git repository
- [x] Sensitive data removed from codebase (no secrets in source)
- [x] .gitignore properly configured
- [ ] GitHub repository created and accessible
- [ ] Code pushed to GitHub main/master branch
- [ ] Branch protection rules configured (require PR reviews)
- [ ] Commit history clean and well-documented

### 2. Environment Variables
- [x] .env.production.example created with all required variables
- [ ] All environment variables documented with descriptions
- [ ] SECRET_KEY generated and stored securely
- [ ] Database credentials configured for production DB
- [ ] API keys obtained:
  - [ ] PIPEDRIVE_API_KEY from Pipedrive
  - [ ] CLAUDE_API_KEY from Anthropic
  - [ ] AZURE credentials for email scanning
- [ ] CORS_ORIGINS set to production frontend domain
- [ ] Email configuration verified (jobs@ mailbox)

### 3. Backend Configuration
- [x] requirements.txt includes all production dependencies
- [x] Dockerfile created and tested locally
- [x] docker-compose.prod.yml configured with PostgreSQL
- [ ] Health check endpoint verified (/health)
- [ ] Logging configured for production
- [ ] Error handling verified (no 500 errors in happy path)
- [ ] Database migrations tested and verified to work

### 4. Frontend Configuration
- [ ] Build process tested and verified
- [ ] Environment variables (.env.production) configured
- [ ] VITE_API_URL points to production backend URL
- [ ] Static assets optimized and minified
- [ ] Error boundaries implemented
- [ ] Loading states properly implemented
- [ ] Network error handling in place

### 5. Database
- [ ] PostgreSQL version compatible (15+ recommended)
- [ ] Backup strategy defined and tested
- [ ] Database user created with minimal required permissions
- [ ] Initial database schema migrated
- [ ] Performance indexes configured
- [ ] Connection pooling configured (for production load)
- [ ] Backup retention policy set (30 days minimum)

### 6. Security Review
- [ ] JWT tokens configured with secure SECRET_KEY
- [ ] Password hashing using argon2 (verified in code)
- [ ] HTTPS enforced (automatic with cloud providers)
- [ ] CORS properly configured (no overly permissive origins)
- [ ] Rate limiting considered for API endpoints
- [ ] SQL injection prevention verified (using SQLAlchemy ORM)
- [ ] No hardcoded secrets in codebase
- [ ] API authentication required for sensitive endpoints
- [ ] Input validation implemented on all endpoints

### 7. Testing
- [x] Unit tests passing locally
- [x] API integration tests passing
- [x] End-to-end tests passing
- [ ] Load testing performed (optional but recommended)
- [ ] Security scanning performed (OWASP top 10 check)
- [ ] Error scenarios tested (invalid inputs, edge cases)

## Deployment Phase - Backend

### Option 1: Render (Recommended)

#### Account & Project Setup
- [ ] Render account created (https://render.com)
- [ ] GitHub repository connected to Render
- [ ] New Web Service created pointing to main/master branch

#### PostgreSQL Database Setup
- [ ] PostgreSQL 15 database created on Render
- [ ] Database connection string noted
- [ ] Default postgres user password changed
- [ ] New database user created (optional, for security)

#### Web Service Configuration
- [ ] Service name: `panda-vision-recruit-api`
- [ ] Docker image build method selected
- [ ] Build command: `pip install -r requirements.txt`
- [ ] Start command: `gunicorn -w 4 -b 0.0.0.0:8000 -k uvicorn.workers.UvicornWorker app.main:app`
- [ ] Port: 8000
- [ ] Region: Closest to your users or EU (for GDPR compliance)

#### Environment Variables (Render Dashboard)
- [ ] `DATABASE_URL`: Postgres connection string from database
- [ ] `SECRET_KEY`: Securely generated random string
- [ ] `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- [ ] `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- [ ] `EMAIL_ADDRESS`: jobs@pandatech.co.il
- [ ] `PIPEDRIVE_API_KEY`
- [ ] `CLAUDE_API_KEY`
- [ ] `DEBUG`: false
- [ ] `APP_VERSION`: Current version (e.g., 1.0.0)

#### Deployment
- [ ] Deploy button clicked in Render dashboard
- [ ] Build completes successfully (check logs)
- [ ] Service shows "Live" status
- [ ] Health check passes: `curl https://[service-url]/health`
- [ ] API responds to requests

### Option 2: Railway (Alternative)

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] PostgreSQL plugin added
- [ ] Environment variables configured
- [ ] Backend service deployed
- [ ] Health endpoint verified

### Option 3: Local Docker Deployment

- [ ] Docker and Docker Compose installed
- [ ] .env.production file created with production values
- [ ] `docker-compose -f docker-compose.prod.yml up -d` executed
- [ ] PostgreSQL container started and healthy
- [ ] Backend container started and healthy
- [ ] Database migrations run
- [ ] Health check passes: `curl http://localhost:8000/health`

## Deployment Phase - Frontend

### Vercel Deployment (Recommended)

- [ ] Vercel account created (https://vercel.com)
- [ ] Frontend directory (./frontend) connected to Vercel
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variables set:
  - [ ] `VITE_API_URL`: Production backend API URL (e.g., https://api.yourdomain.com)
- [ ] Custom domain configured (optional)
- [ ] Deployment successful
- [ ] Frontend loads without errors
- [ ] Can reach backend API from frontend

### Alternative: Netlify Deployment

- [ ] Similar process to Vercel
- [ ] Deploy settings configured
- [ ] Environment variables set
- [ ] Health check passed

## Post-Deployment Verification

### API Verification
- [ ] `/health` endpoint responds with 200 OK
- [ ] `/` root endpoint returns app info
- [ ] Unauthenticated endpoints return 401 for protected routes
- [ ] User registration endpoint works (POST /auth/register)
- [ ] User login endpoint works (POST /auth/login)
- [ ] JWT tokens valid and can be used for subsequent requests
- [ ] Database connectivity verified (can query candidates, jobs, etc.)

### Frontend Verification
- [ ] Frontend loads without console errors
- [ ] Login page displays correctly
- [ ] Can register new user
- [ ] Can login with credentials
- [ ] Dashboard displays without errors
- [ ] Can view candidate list
- [ ] Can view job list
- [ ] API requests to backend succeed

### Integration Tests
- [ ] End-to-end user flow:
  1. Register new user
  2. Login
  3. View candidates
  4. View jobs
  5. Logout
- [ ] Email scanning trigger (if applicable)
- [ ] Background tasks running (if applicable)
- [ ] Database backups working

### Monitoring & Logging
- [ ] Application logs accessible and configured
- [ ] Error logging working (check for any 500 errors)
- [ ] Performance acceptable (response times < 500ms for most endpoints)
- [ ] No memory leaks observed (monitor container memory)
- [ ] Database connections healthy (no connection errors)

## Post-Deployment Operations

### Backup & Disaster Recovery
- [ ] Database backups configured to run daily
- [ ] Backups stored in separate location
- [ ] Restore procedure documented and tested
- [ ] Backup retention policy: 30 days minimum

### Monitoring & Alerts
- [ ] Monitoring tool set up (Sentry, DataDog, or cloud provider dashboard)
- [ ] Error alerts configured
- [ ] Performance alerts configured
- [ ] Database alerts configured
- [ ] Uptime monitoring configured (UptimeRobot or similar)

### Scaling & Performance
- [ ] Database connection pooling configured
- [ ] API response times monitored
- [ ] Database query performance monitored
- [ ] Caching strategy evaluated (Redis optional)
- [ ] CDN configured for static assets (optional)

### Security Maintenance
- [ ] Regular security updates scheduled
- [ ] Dependency updates monitored (Dependabot)
- [ ] API rate limiting configured (optional)
- [ ] CORS headers reviewed monthly
- [ ] Access logs reviewed for suspicious activity

## Critical Configuration Checklist

### Database
```
✓ PostgreSQL 15+ running
✓ Connection string works: postgresql://user:pass@host:port/db
✓ Initial schema created
✓ Migrations applied
✓ Backups enabled
```

### Backend
```
✓ Docker image builds successfully
✓ Health check endpoint responds
✓ All environment variables set
✓ API responds to requests
✓ Database queries work
✓ Logging configured
✓ Error handling working
```

### Frontend
```
✓ Build completes without errors
✓ Environment variables set
✓ API URL points to production backend
✓ Frontend loads and renders correctly
✓ Can authenticate with backend
✓ Network requests successful
```

## Troubleshooting Guide

### Backend Won't Start
1. Check logs: `docker logs container-name` or Render logs
2. Verify DATABASE_URL is valid
3. Verify all environment variables are set
4. Check port 8000 is not in use
5. Run migrations: `alembic upgrade head`

### Frontend Can't Connect to Backend
1. Verify VITE_API_URL in .env.production
2. Check CORS settings in backend (ALLOWED_ORIGINS)
3. Verify backend is running and responding to health check
4. Check browser console for CORS errors
5. Verify no firewall blocking requests

### Database Connection Issues
1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running
3. Verify credentials in connection string
4. Check network/firewall allows connection
5. Verify database user has appropriate permissions

### Performance Issues
1. Check database query performance (slow logs)
2. Monitor CPU/memory usage
3. Review API response times in logs
4. Consider increasing server resources
5. Implement caching if needed

## Sign-Off

- [ ] All checklist items completed
- [ ] System verified in production
- [ ] Team trained on maintenance procedures
- [ ] Incident response plan documented
- [ ] Ready for production use
