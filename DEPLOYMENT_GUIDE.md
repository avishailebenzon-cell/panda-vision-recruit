# Deployment Guide - Panda-Vision Recruit

## Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Clone repository
git clone <repo>
cd panda-vision-recruit

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Supabase Setup

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to:
- [ ] Create Supabase project
- [ ] Initialize database schema
- [ ] Create cv-files Storage bucket
- [ ] Get credentials

### 3. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required variables:
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
PIPEDRIVE_API_KEY=...
```

### 4. Local Testing

```bash
# Test database connection
python3 -c "from app.database import SessionLocal; db = SessionLocal(); db.execute('SELECT 1'); print('✓ DB OK')"

# Start development server
python3 -m app.main

# In another terminal, test API
curl http://localhost:8000/health
```

---

## Deployment Options

### Option 1: Railway.app (Easiest)

#### Setup

1. Create Railway account at [railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL plugin (uses Supabase connection)
4. Deploy from GitHub

#### Steps

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Connect to Supabase
railway add

# Deploy
railway up
```

#### Environment Variables

Add in Railway dashboard:
- `DATABASE_URL` from Supabase
- `SUPABASE_URL`, `SUPABASE_KEY`
- All other API keys

---

### Option 2: Heroku

#### Setup

```bash
# Install Heroku CLI
brew install heroku  # macOS
# or download from heroku.com

# Login
heroku login

# Create app
heroku create panda-vision-recruit

# Add environment variables
heroku config:set DATABASE_URL="postgresql://..."
heroku config:set SUPABASE_URL="https://..."
heroku config:set SUPABASE_KEY="eyJ..."
# ... add all variables

# Deploy
git push heroku main
```

#### Procfile (create in root)

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: python app/tasks/scheduler.py
```

---

### Option 3: Docker + AWS/GCP/Azure

#### Build Docker Image

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Build and Push

```bash
# Build image
docker build -t panda-vision:latest .

# Push to registry (e.g., ECR, GCR, Docker Hub)
docker tag panda-vision:latest myregistry/panda-vision:latest
docker push myregistry/panda-vision:latest
```

#### Deploy to Cloud

**AWS ECS:**
```bash
aws ecs create-service \
  --cluster panda-vision \
  --service-name api \
  --task-definition panda-vision:1 \
  --desired-count 2
```

**Google Cloud Run:**
```bash
gcloud run deploy panda-vision \
  --image gcr.io/project/panda-vision \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=...
```

**Azure Container Instances:**
```bash
az container create \
  --resource-group my-group \
  --name panda-vision \
  --image myregistry/panda-vision \
  --environment-variables DATABASE_URL=...
```

---

### Option 4: VPS/Linux Server

#### Installation

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Python
sudo apt-get install -y python3 python3-pip python3-venv

# Clone repository
cd /opt
sudo git clone <repo> panda-vision
cd panda-vision

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
nano .env  # Add your credentials
```

#### Systemd Service

Create `/etc/systemd/system/panda-vision.service`:

```ini
[Unit]
Description=Panda-Vision Recruit API
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/opt/panda-vision
Environment="PATH=/opt/panda-vision/venv/bin"
ExecStart=/opt/panda-vision/venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

#### Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable panda-vision
sudo systemctl start panda-vision
sudo systemctl status panda-vision
```

#### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/panda-vision`:

```nginx
upstream panda_vision {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.pandatech.co.il;

    client_max_body_size 100M;

    location / {
        proxy_pass http://panda_vision;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API documentation
    location /docs {
        proxy_pass http://panda_vision/docs;
    }

    location /openapi.json {
        proxy_pass http://panda_vision/openapi.json;
    }
}
```

Enable and start:
```bash
sudo ln -s /etc/nginx/sites-available/panda-vision /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Post-Deployment Verification

### Health Checks

```bash
# API health
curl https://api.pandatech.co.il/health

# Database connection
curl https://api.pandatech.co.il/candidates/

# View logs
# Railway: railway logs -d
# Heroku: heroku logs --tail
# VPS: journalctl -u panda-vision -f
```

### Database Verification

```sql
-- Connect to Supabase database
SELECT count(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should show: 9 (our 9 tables)
```

### Storage Verification

```bash
# Test storage bucket access
curl https://[PROJECT_ID].supabase.co/storage/v1/object/public/cv-files/

# Should return list of files (or empty if no uploads yet)
```

---

## Monitoring & Logging

### Logs Destinations

- **Railway**: Dashboard → Logs
- **Heroku**: `heroku logs --tail`
- **Docker**: `docker logs <container-id>`
- **Supabase**: Project → Logs (Edge Functions logs)

### Key Metrics to Monitor

1. **API Response Time**
   ```bash
   curl -w "@curl-format.txt" https://api.pandatech.co.il/health
   ```

2. **Database Connections**
   ```sql
   SELECT datname, count(*) 
   FROM pg_stat_activity 
   GROUP BY datname;
   ```

3. **Storage Usage**
   ```sql
   SELECT pg_size_pretty(sum(metadata->>'size')::bigint)
   FROM storage.objects
   WHERE bucket_id = 'cv-files';
   ```

4. **Error Rates**
   - Check `system_logs` table for errors
   - Monitor agent_tasks for failures

---

## Scaling

### Horizontal Scaling (Multiple Instances)

Use container orchestration:

**Kubernetes**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: panda-vision
spec:
  replicas: 3
  selector:
    matchLabels:
      app: panda-vision
  template:
    metadata:
      labels:
        app: panda-vision
    spec:
      containers:
      - name: api
        image: myregistry/panda-vision:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: panda-vision-secrets
              key: database-url
        - name: WORKERS
          value: "4"
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  api1:
    image: panda-vision:latest
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=...
  api2:
    image: panda-vision:latest
    ports:
      - "8002:8000"
    environment:
      - DATABASE_URL=...
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Vertical Scaling (Bigger Instances)

- Increase worker processes: `--workers 8`
- Increase RAM: Upgrade server/container
- Increase database connections: Supabase paid tier

### Database Scaling

**Supabase**:
- Free: 500 MB database
- Pro: $25/month, 10 GB
- Business: Custom resources

Upgrade in: Project → Settings → Billing

---

## Troubleshooting

### API Won't Start

**Check logs**:
```bash
# Railway
railway logs -d

# Heroku
heroku logs --tail

# VPS
journalctl -u panda-vision -f
```

**Common issues**:
- ❌ Missing environment variables → Add all vars from `.env.example`
- ❌ Database connection error → Verify DATABASE_URL
- ❌ Port already in use → Change port or kill process

### Database Connection Timeout

**Solution**:
```
Use pooled connection (port 6543, not 5432)
DATABASE_URL=postgresql://...:6543/postgres
```

### Storage Upload Failing

**Check**:
```bash
# Verify bucket exists
curl https://[PROJECT_ID].supabase.co/storage/v1/buckets \
  -H "Authorization: Bearer [KEY]"

# Check storage policies in Supabase dashboard
```

### High CPU/Memory Usage

**Optimize**:
```python
# Reduce worker count
uvicorn app.main:app --workers 2

# Add caching
# Implement batch processing
# Profile with: pip install py-spy
```

---

## Security Hardening

### 1. HTTPS/TLS

All deployed services should use HTTPS:

```bash
# Railway: Automatic (*.railway.app)
# Heroku: Automatic (*.herokuapp.com)
# Custom domain: Use Let's Encrypt (free)

# Certbot (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.pandatech.co.il
```

### 2. Rate Limiting

Add in FastAPI:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

### 3. CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. API Key Rotation

```bash
# Every 90 days:
# 1. Generate new key in Supabase dashboard
# 2. Add as new env var (e.g., SUPABASE_KEY_NEW)
# 3. Update application
# 4. Monitor for issues
# 5. Remove old key
```

### 5. Database Backups

```bash
# Enable in Supabase: Project → Backups
# Test restore procedure quarterly
# Keep encrypted copy off-site
```

---

## Maintenance Schedule

### Daily
- Check health endpoint
- Monitor error logs
- Review system_logs table

### Weekly
- Review agent task statistics
- Check database size
- Monitor API response times

### Monthly
- Review user feedback
- Analyze agent performance
- Plan capacity upgrades
- Update dependencies

### Quarterly
- Test disaster recovery
- Rotate API keys
- Security audit
- Backup restoration test

---

## Rollback Procedure

If deployment fails:

```bash
# Get previous commit
git log --oneline

# Revert to previous version
git revert HEAD
git push

# Redeploy
# (Auto-deployment will trigger)

# Monitor logs for success
```

---

## Support & Documentation

- **API Docs**: https://api.pandatech.co.il/docs
- **GitHub**: [repo-url]
- **Issues**: GitHub Issues
- **Documentation**: README.md, CLAUDE.md

---

## Checklist

Before going live:

- [ ] Database initialized in Supabase
- [ ] Storage bucket created and configured
- [ ] All environment variables set
- [ ] Health check passes
- [ ] Email scanning works (test manually)
- [ ] Agent matching works (test with sample job)
- [ ] Logs being written to database
- [ ] HTTPS/SSL configured
- [ ] Backups enabled
- [ ] Monitoring in place
- [ ] Incident response plan
- [ ] Team trained on operations
