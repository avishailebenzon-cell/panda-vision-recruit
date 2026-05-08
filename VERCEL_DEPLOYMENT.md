# Vercel Deployment - Copy & Paste Instructions

**Prerequisites**: 
- ✅ Backend deployed to Render and working
- ✅ Have your backend URL (e.g., `https://panda-vision-recruit-api.onrender.com`)

---

## Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize access to avishailebenzon-cell
5. Complete onboarding

---

## Step 2: Create New Project

### In Vercel Dashboard:
1. Click **"Add New..."** → **"Project"**

### Import Repository:
1. Search for: `panda-vision-recruit`
2. Click **"Import"**

### Configure Project:

| Setting | Value |
|---------|-------|
| **Project Name** | `panda-vision-recruit` (auto-filled) |
| **Framework Preset** | `Vite` (auto-detected) |
| **Root Directory** | `./frontend` |

### Click "Import"

---

## Step 3: Add Environment Variables

### Before deploying:

1. In project settings, go to **"Environment Variables"**
2. Add this variable:

```
VITE_API_URL = https://panda-vision-recruit-api.onrender.com
```

(Replace with your actual Render backend URL)

3. Click **"Save"**

---

## Step 4: Deploy

The deployment should start automatically. Wait for:
- ✅ Build completes
- ✅ Shows deployment URL (like: `https://panda-vision-recruit.vercel.app`)

⏳ Usually takes 1-2 minutes

---

## Step 5: Verify Frontend is Running

1. Open your Vercel deployment URL in browser
2. You should see the login page
3. Test functionality:
   - **Register**: Create a new account
   - **Login**: Log in with those credentials
   - **Dashboard**: Should load without errors
   - **Check browser console (F12)**: No red errors

---

## Step 6: Test End-to-End

1. **Open frontend URL** in browser
2. **Register** a test account:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. **Login** with same credentials
4. **Verify dashboard** loads:
   - No console errors (F12 → Console)
   - Can see candidates/jobs lists
   - API requests succeed (F12 → Network)

---

## Environment Variables Summary

### What goes where:

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_API_URL` | Vercel Project Settings | Your Render backend URL |
| `DATABASE_URL` | Render Web Service | PostgreSQL connection string |
| `SECRET_KEY` | Render Web Service | Generated random string |
| `CLAUDE_API_KEY` | Render Web Service | From Anthropic console |
| `PIPEDRIVE_API_KEY` | Render Web Service | From Pipedrive |

---

## Troubleshooting

### Frontend Loads But Can't Login?
- Check browser console (F12) for errors
- Verify `VITE_API_URL` environment variable is set correctly
- Test backend directly: `curl https://your-backend.onrender.com/health`
- Check if backend is still running

### Frontend Shows Blank Page?
- Wait 30 seconds and refresh
- Check Vercel deployment logs
- Verify build completed successfully

### API Requests Failing?
- Verify backend URL in environment variable matches your Render URL
- Check CORS errors in browser console
- Confirm backend is running: `curl https://your-backend.onrender.com/health`

### Still Having Issues?
1. Check Render logs for backend errors
2. Check Vercel logs for frontend build errors
3. Verify all environment variables are set correctly
4. Try redeploying both services

---

## Final Verification Checklist

- ✅ Frontend URL opens without errors
- ✅ Login page displays correctly
- ✅ Can register new user
- ✅ Can login with credentials
- ✅ Dashboard loads after login
- ✅ No console errors (F12)
- ✅ API requests succeed (Network tab)
- ✅ Can view candidates list
- ✅ Can view jobs list

---

**You're Done!** Your Panda-Vision Recruit system is now live in production! 🎉

**URLs to Save:**
- Frontend: https://your-frontend.vercel.app
- Backend API: https://your-backend.onrender.com
- API Docs: https://your-backend.onrender.com/docs
