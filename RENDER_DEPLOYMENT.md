# Render Deployment - Copy & Paste Instructions

## Step 1: Create Render Account
1. Go to https://render.com
2. Click "Sign up with GitHub"
3. Authorize access to avishailebenzon-cell
4. Complete onboarding

## Step 2: Create PostgreSQL Database

### In Render Dashboard:
1. Click **"+ New"** → **"PostgreSQL"**

### Fill in form:
- **Name**: `panda-vision-recruit-db`
- **Database**: `panda_vision`
- **Username**: `postgres` (default)
- **Password**: Generate strong password (Render generates one)
- **Region**: `Northern Europe` or closest to you
- **PostgreSQL Version**: 15
- **Billing Plan**: Free or Pay-as-you-go

### Click "Create Database"

⏳ Wait for database status to turn **green** (usually 5-10 minutes)

### Copy Your Database Connection String
When database is ready:
1. Go to database details
2. Copy the "Internal Database URL" - it looks like:
   ```
   postgresql://postgres:PASSWORD@dpg-xxxxxxxxxxxxxx.postgres.render.com:5432/panda_vision
   ```
3. **SAVE THIS VALUE** - you'll need it for backend

---

## Step 3: Create Web Service (Backend)

### In Render Dashboard:
1. Click **"+ New"** → **"Web Service"**

### GitHub Connection:
- Click **"Connect your GitHub"** if needed
- Select **`avishailebenzon-cell/panda-vision-recruit`**
- Click **"Connect"**

### Configure Service:

| Field | Value |
|-------|-------|
| **Name** | `panda-vision-recruit-api` |
| **Environment** | `Docker` |
| **Build Command** | (Leave empty - auto-detect) |
| **Start Command** | (Leave empty - auto-detect) |
| **Root Directory** | `.` (dot) |
| **Branch** | `main` |
| **Region** | Same as database |
| **Plan** | Free or Pay-as-you-go |

### Click "Create Web Service"

---

## Step 4: Add Environment Variables

### Still in Web Service settings:
1. Go to **"Environment"** tab
2. Click **"Add Environment Variable"** for each:

```
DATABASE_URL = postgresql://postgres:PASSWORD@dpg-xxxxxxxxxxxxxx.postgres.render.com:5432/panda_vision
SECRET_KEY = your-secret-key-here
AZURE_TENANT_ID = (leave blank if not using email scanning)
AZURE_CLIENT_ID = (leave blank if not using email scanning)
AZURE_CLIENT_SECRET = (leave blank if not using email scanning)
EMAIL_ADDRESS = jobs@pandatech.co.il
PIPEDRIVE_API_KEY = (your key)
CLAUDE_API_KEY = sk-ant-xxxxx
DEBUG = false
APP_VERSION = 1.0.0
FRONTEND_URL = https://your-frontend-url.vercel.app
```

**Important**: Don't use quotes in Render's environment variable form

3. Click **"Save"**

---

## Step 5: Deploy

1. Click **"Deploy"** button
2. Watch the **"Logs"** tab for deployment progress
3. Wait for: **"Your service is live"** message

⏳ Deployment usually takes 2-5 minutes

---

## Step 6: Verify Backend is Running

Once "Your service is live" appears:

1. Get your service URL (looks like: `https://panda-vision-recruit-api.onrender.com`)
2. Test it:
   ```bash
   curl https://panda-vision-recruit-api.onrender.com/health
   ```
3. Should respond: `{"status":"healthy","service":"Panda-Vision Recruit API",...}`

**SAVE YOUR BACKEND URL** - you'll need this for frontend deployment

---

## Troubleshooting

### Deployment Failed?
- Click **"Logs"** tab → Look for error message
- Common issues:
  - `DATABASE_URL` is invalid → Check connection string
  - Missing environment variables → Add all from list above
  - Port issues → Should auto-use 8000

### Takes Too Long?
- Free tier instances sleep after 15 min of inactivity
- Upgrade to paid plan for always-on

### Still Not Working?
1. Restart service: Click **"..." → "Restart"**
2. Check logs for errors
3. Verify `DATABASE_URL` is from your PostgreSQL database
4. Make sure all required environment variables are set

---

**Next Step**: Use this Backend URL in Vercel deployment
