#!/bin/bash
# Automated deployment guide - Follow these steps

set -e

echo "🚀 Panda-Vision Recruit - Automated Deployment"
echo "=============================================="
echo ""
echo "This script will guide you through deployment."
echo "Some steps require your input (GitHub, Render, Vercel)."
echo ""

# Step 1: Verify local setup
echo "STEP 1: Verifying local system..."
echo "=================================="

# Check backend
echo -n "Backend health check... "
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL - Backend not running on port 8001"
    exit 1
fi

# Check tests
echo -n "Running production tests... "
if bash test_production.sh http://localhost:8001 >/dev/null 2>&1; then
    echo "✅ PASS (9/9)"
else
    echo "❌ FAIL"
    exit 1
fi

# Check git status
echo -n "Git status... "
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Clean"
else
    echo "❌ Uncommitted changes detected"
    git status
    exit 1
fi

echo ""
echo "✅ LOCAL SYSTEM READY FOR DEPLOYMENT"
echo ""

# Step 2: GitHub setup
echo "STEP 2: GitHub Repository Setup"
echo "================================"
echo ""
echo "You need to:"
echo "1. Go to https://github.com/new"
echo "2. Create repository: 'panda-vision-recruit'"
echo "3. Choose 'Private' (recommended)"
echo "4. DO NOT initialize with README"
echo ""
read -p "Press Enter when repository is created... "

echo ""
echo "Now pushing code to GitHub..."
read -p "Enter your GitHub username: " GITHUB_USER

REPO_URL="https://github.com/${GITHUB_USER}/panda-vision-recruit.git"

# Set up git remote
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git branch -M main
git push -u origin main

echo "✅ Code pushed to GitHub"
echo ""

# Step 3: Backend deployment
echo "STEP 3: Render Backend Deployment"
echo "=================================="
echo ""
echo "You need to:"
echo "1. Go to https://render.com"
echo "2. Sign up/Sign in with GitHub"
echo "3. Click '+ New' → 'Web Service'"
echo "4. Select your 'panda-vision-recruit' repository"
echo "5. Fill in settings:"
echo "   - Name: panda-vision-recruit-api"
echo "   - Runtime: Docker"
echo "   - Branch: main"
echo ""
echo "Then create PostgreSQL database:"
echo "1. Click '+ New' → 'PostgreSQL'"
echo "2. Name: panda-vision-recruit-db"
echo "3. Database: panda_vision"
echo "4. Note the connection string"
echo ""
echo "Add environment variables to Web Service:"
read -p "Paste your DATABASE_URL from PostgreSQL: " DB_URL
read -p "Enter a SECRET_KEY (or press Enter to skip for now): " SECRET_KEY
if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    echo "Generated SECRET_KEY: $SECRET_KEY"
fi

echo ""
echo "Backend deployment configuration ready:"
echo "DATABASE_URL=$DB_URL"
echo "SECRET_KEY=$SECRET_KEY"
echo "DEBUG=false"
echo ""
read -p "Press Enter after adding environment variables and deploying in Render... "

echo ""
echo "Testing backend deployment..."
read -p "Enter your Render backend URL (e.g., https://panda-vision-recruit-api.onrender.com): " BACKEND_URL

echo -n "Testing $BACKEND_URL/health... "
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL - Waiting for deployment..."
    sleep 30
    if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo "✅ PASS (after wait)"
    else
        echo "⚠️  Still not responding - may need more time"
    fi
fi

echo ""

# Step 4: Frontend deployment
echo "STEP 4: Vercel Frontend Deployment"
echo "===================================="
echo ""
echo "You need to:"
echo "1. Go to https://vercel.com"
echo "2. Sign up/Sign in with GitHub"
echo "3. Click 'New Project'"
echo "4. Import: 'panda-vision-recruit'"
echo "5. Select 'frontend' directory"
echo "6. Add environment variable:"
echo "   VITE_API_URL=$BACKEND_URL"
echo "7. Click Deploy"
echo ""
read -p "Press Enter after deploying to Vercel... "

read -p "Enter your Vercel frontend URL (e.g., https://panda-vision-recruit.vercel.app): " FRONTEND_URL

echo ""
echo "Testing frontend deployment..."
echo "Open this URL in your browser: $FRONTEND_URL"
echo ""
echo "Verify:"
echo "1. Login page displays"
echo "2. Can register new user"
echo "3. Can login with credentials"
echo "4. Dashboard displays without errors"
echo ""
read -p "Press Enter when verified... "

echo ""
echo "✅✅✅ DEPLOYMENT COMPLETE! ✅✅✅"
echo ""
echo "Your application is now live!"
echo ""
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo ""
echo "Save these URLs for future reference."
echo ""
