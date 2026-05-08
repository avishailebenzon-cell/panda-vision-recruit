# Quick Start: 5-Minute Production Deployment

Already familiar with deployments? This checklist gets you to production in 5 minutes.

## ✅ Pre-Flight Checklist (1 min)

```bash
# 1. Verify code is clean
git status
# → Should show "working tree clean"

# 2. Verify backend is healthy
curl http://localhost:8001/health
# → Should respond: {"status":"ok"}

# 3. Verify all tests pass
bash test_production.sh http://localhost:8001
# → Should show: "✅ ALL TESTS PASSED"
```

## 🚀 Deploy Backend to Render (2 min)

1. **Push code to GitHub** (if not already done):
   ```bash
   git remote add origin https://github.com/YOU/panda-vision-recruit.git
   git push -u origin main
   ```

2. **On Render.com:**
   - Sign in with GitHub
   - New → Web Service
   - Select repository: `panda-vision-recruit`
   - Auto-detect Docker Dockerfile
   - Create PostgreSQL database
   - Copy database URL to SERVICE_DATABASE_URL
   - Add environment variables:
     - `DATABASE_URL` = postgres connection string
     - `SECRET_KEY` = `openssl rand -hex 32`
     - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
     - `PIPEDRIVE_API_KEY`
     - `CLAUDE_API_KEY`
     - `DEBUG=false`
   - Deploy!

3. **After deploy completes:**
   ```bash
   # Test backend
   curl https://your-service.onrender.com/health
   ```

## 🎨 Deploy Frontend to Vercel (2 min)

1. **On Vercel.com:**
   - New Project
   - Import Git repository: `panda-vision-recruit`
   - Select `frontend` directory
   - Framework: Vite (auto-detected)
   - Environment variable:
     - `VITE_API_URL` = `https://your-service.onrender.com`
   - Deploy!

2. **After deploy completes:**
   - Visit Vercel frontend URL
   - Test login/register
   - Verify dashboard loads

## 🧪 Verify Production (1 min)

1. **Backend health:**
   ```bash
   curl https://your-backend.onrender.com/health
   # → Should return: {"status":"ok"}
   ```

2. **Frontend:**
   - Open https://your-frontend.vercel.app
   - Register account
   - Login
   - View dashboard

3. **Check logs:**
   - Render: Service → Logs (should be clean)
   - Vercel: Deployments (should be success)

## 🔑 Critical Configuration

**NEVER commit to git:**
- `.env.production` file
- Any file with credentials

**Always set in cloud provider:**
- All environment variables listed above
- Different values for production vs development

## 📋 Files You Need

- ✅ `Dockerfile` - Production image
- ✅ `docker-compose.prod.yml` - Docker setup
- ✅ `.env.production.example` - Template for env vars
- ✅ `test_production.sh` - Verification script
- ✅ `PRODUCTION_READINESS.md` - Complete checklist
- ✅ `DEPLOY_TO_PRODUCTION.md` - Detailed steps
- ✅ `QUICK_START_PRODUCTION.md` - This file

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't deploy | Check Render logs → fix error → git push |
| Frontend can't reach backend | Verify `VITE_API_URL` environment variable |
| Database connection fails | Check `DATABASE_URL` is from Render PostgreSQL |
| Login doesn't work | Check backend logs, ensure database migrated |
| 404 on health check | Service hasn't started, wait 1-2 min and retry |

## 📞 Need Help?

See full deployment guide: `DEPLOY_TO_PRODUCTION.md`
See production checklist: `PRODUCTION_READINESS.md`
Run verification script: `bash test_production.sh http://localhost:8001`

---

**Status:** ✅ Your system is production-ready. Deploy with confidence!
