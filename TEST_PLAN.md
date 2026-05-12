# Panda-Vision Recruit - Comprehensive Test Plan

**Version**: 1.0  
**Date**: May 12, 2026  
**Scope**: End-to-end testing of production deployment

---

## Table of Contents

1. [Pre-Test Checklist](#pre-test-checklist)
2. [Frontend Testing](#frontend-testing)
3. [Backend API Testing](#backend-api-testing)
4. [Integration Testing](#integration-testing)
5. [Agent Processing Testing](#agent-processing-testing)
6. [Performance Testing](#performance-testing)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Test Checklist

### System Health Verification

Before running any tests, ensure the system is ready:

```bash
# 1. Verify Vercel deployment is complete
# Go to: https://vercel.com/dashboard
# Check: Build status shows "Ready" (green checkmark)

# 2. Verify Render deployment is complete
# Go to: https://dashboard.render.com
# Check: Service status shows "Live" (green)

# 3. Test backend health endpoint
curl -s https://panda-vision-recruit.onrender.com/health | jq .

# Expected response:
{
  "status": "healthy",
  "service": "Panda-Vision Recruit API",
  "version": "0.1.0"
}

# 4. Record any issues found
```

### Database Verification

```bash
# Connect to Supabase database (optional - for admin use)
# Get connection string from Render environment variables
psql $DATABASE_URL -c "SELECT COUNT(*) FROM candidates;"

# Expected: Should return a number (even if 0)
```

---

## Frontend Testing

### 1. Page Load Test

**Objective**: Verify frontend loads without errors

**Steps**:
1. Open browser: https://panda-vision-recruit-882u.vercel.app
2. Open DevTools: Press F12
3. Go to Console tab
4. Refresh page: Press Cmd+R (Mac) or Ctrl+R (Windows/Linux)

**Expected Results**:
- [ ] Page loads without 404 errors
- [ ] No red error messages in console
- [ ] Page title shows "frontend"
- [ ] Dashboard with navigation sidebar visible
- [ ] All layout elements visible (header, sidebar, main content)

**Pass Criteria**: Zero JavaScript errors in console, page fully visible

---

### 2. Navigation Test

**Objective**: Verify all navigation routes work

**Steps**:
1. Click each navigation item in sidebar
2. Verify page loads for each
3. Note any errors

**Navigation Items**:
- [ ] Dashboard (/) - Home page with system overview
- [ ] Software Engineer (/agents/software) - Software agent view
- [ ] Electronics (/agents/electronics) - Electronics agent view
- [ ] Mechanical (/agents/mechanical) - Mechanical agent view
- [ ] QA (/agents/qa) - QA agent view
- [ ] IT (/agents/it) - IT agent view
- [ ] Cybersecurity (/agents/cybersecurity) - Cybersecurity agent view
- [ ] Systems Engineer (/agents/systems_engineering) - Systems agent view
- [ ] Orchestrator (/orchestrator) - Orchestrator agent view
- [ ] Matches (/matches) - All matches view
- [ ] Candidates (/candidates) - Candidate list
- [ ] Jobs (/jobs) - Job list
- [ ] Settings (/settings) - Configuration

**Expected Results**:
- [ ] Each route loads without errors
- [ ] Page content changes appropriately
- [ ] No blank pages or 404 errors

**Pass Criteria**: All 13 routes navigate successfully with page content

---

### 3. API Connectivity Test

**Objective**: Verify frontend can communicate with backend

**Steps**:
1. Open DevTools: Press F12
2. Go to Network tab
3. Go to Dashboard page
4. Watch for network requests
5. Look for requests to `/candidates`, `/jobs`, `/matches`, etc.

**Expected Results**:
- [ ] API requests show Status 200 OK
- [ ] Requests go to https://panda-vision-recruit.onrender.com
- [ ] Response times reasonable (< 2 seconds)
- [ ] No CORS errors
- [ ] No 502/503 errors

**Example API Requests**:
```
GET https://panda-vision-recruit.onrender.com/candidates/
GET https://panda-vision-recruit.onrender.com/jobs/
GET https://panda-vision-recruit.onrender.com/matches/
```

**Pass Criteria**: All API requests return 200 OK, no CORS errors

---

### 4. UI Rendering Test

**Objective**: Verify UI elements render correctly

**Steps**:
1. Go to Dashboard
2. Scroll through entire page
3. Check each section
4. Verify all content displays

**Expected Sections**:
- [ ] Agent cards visible with icons
- [ ] Statistics displayed correctly
- [ ] Tables render with proper formatting
- [ ] Colors match Panda-Vision theme (not Base44)
- [ ] Icons from Lucide React library visible
- [ ] Tailwind CSS styles applied correctly

**Pass Criteria**: All UI elements visible, properly styled, no layout issues

---

## Backend API Testing

### 1. Health Endpoint Test

**Objective**: Verify backend is responding

```bash
curl -X GET https://panda-vision-recruit.onrender.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "service": "Panda-Vision Recruit API",
  "version": "0.1.0"
}
```

**Pass Criteria**: 200 OK, correct response structure

---

### 2. Candidates Endpoint Test

**Objective**: Verify candidates API works

```bash
curl -X GET https://panda-vision-recruit.onrender.com/candidates/
```

**Expected Response**:
```json
{
  "candidates": [
    {
      "id": 1,
      "email": "...",
      "name": "...",
      "phone": "...",
      "security_level": "...",
      "status": "active",
      ...
    }
  ]
}
```

**Alternative if no candidates exist**:
```json
{
  "candidates": []
}
```

**Pass Criteria**: 200 OK, returns list (empty or populated)

---

### 3. Jobs Endpoint Test

**Objective**: Verify jobs API works

```bash
curl -X GET https://panda-vision-recruit.onrender.com/jobs/
```

**Expected Response**:
```json
{
  "jobs": [...]
}
```

**Pass Criteria**: 200 OK, returns job list

---

### 4. Matches Endpoint Test

**Objective**: Verify matches API works

```bash
curl -X GET https://panda-vision-recruit.onrender.com/matches/
```

**Expected Response**:
```json
{
  "matches": [...]
}
```

**Pass Criteria**: 200 OK, returns match list

---

### 5. Email Scan Endpoint Test

**Objective**: Verify email scanner can be triggered

```bash
curl -X POST https://panda-vision-recruit.onrender.com/email/scan
```

**Expected Response**:
```json
{
  "status": "scan_started",
  "message": "..."
}
```

**Pass Criteria**: 200 OK, scan initiates without errors

---

### 6. Error Handling Test

**Objective**: Verify API returns proper errors

```bash
# Request non-existent candidate
curl -X GET https://panda-vision-recruit.onrender.com/candidates/99999

# Expected: 404 Not Found or empty result
```

**Pass Criteria**: API returns appropriate error codes, not 500 errors

---

## Integration Testing

### 1. Create Test Data

**Objective**: Populate system with test candidates and jobs

**Option A: Via API**:
```bash
# Create test candidate
curl -X POST https://panda-vision-recruit.onrender.com/candidates/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test Candidate",
    "phone": "+1234567890",
    "security_level": "no_security",
    "location": "Tel Aviv"
  }'

# Create test job (via Pipedrive sync)
curl -X POST https://panda-vision-recruit.onrender.com/jobs/sync-from-pipedrive
```

**Option B: Via Pipedrive**:
1. Add new deal to Pipedrive
2. Set job_title field
3. Wait for automatic sync
4. Verify job appears in system

**Expected Results**:
- [ ] Test candidate appears in candidates list
- [ ] Test job appears in jobs list
- [ ] Data is retrievable via API

---

### 2. Frontend Data Display Test

**Objective**: Verify frontend displays test data

**Steps**:
1. Create test candidate (see above)
2. Create test job
3. Go to Dashboard in browser
4. Verify test data appears

**Expected Results**:
- [ ] Test candidate visible in candidates table
- [ ] Test job visible in jobs table
- [ ] Data matches what was created
- [ ] No data transformation errors

---

### 3. Email Scanning Integration Test

**Objective**: Verify email scanner processes CV attachments

**Setup**:
1. Ensure AZURE_* environment variables are set
2. Ensure EMAIL_ADDRESS is set to correct mailbox
3. Have test CV files ready

**Steps**:
1. Send email with CV attachment to jobs@pandatech.co.il
2. Trigger email scan via API:
   ```bash
   curl -X POST https://panda-vision-recruit.onrender.com/email/scan
   ```
3. Check email scan logs:
   ```bash
   curl -X GET https://panda-vision-recruit.onrender.com/email/scan-logs
   ```

**Expected Results**:
- [ ] Email is processed (marked as read)
- [ ] CV text is extracted
- [ ] New candidate created from CV
- [ ] Security level is classified
- [ ] Scan log shows success

---

## Agent Processing Testing

### 1. Agent Task Creation

**Objective**: Create agent tasks for candidate-job matching

**Steps**:
1. Ensure test candidate exists
2. Ensure test job exists
3. Trigger agent matching:
   ```bash
   curl -X POST https://panda-vision-recruit.onrender.com/agents/jobs/1/match
   ```

**Expected Response**:
```json
{
  "status": "matching_started",
  "job_id": 1,
  "agents": [...]
}
```

**Pass Criteria**: 200 OK, matching process initiated

---

### 2. Agent Processing Verification

**Objective**: Verify all 9 agents process matches

**Steps**:
1. Create agent task (see above)
2. Wait 30-60 seconds for processing
3. Check agent tasks:
   ```bash
   curl -X GET https://panda-vision-recruit.onrender.com/agents/tasks
   ```

**Expected Response**:
```json
{
  "tasks": [
    {
      "id": 1,
      "job_id": 1,
      "candidate_id": 1,
      "agent_type": "software",
      "status": "completed|pending|failed",
      ...
    },
    ...
  ]
}
```

**Verification Checklist**:
- [ ] Task status is "completed" (not "failed" or "pending" after wait)
- [ ] All 9 agent types appear:
  - [ ] orchestrator
  - [ ] software
  - [ ] electronics
  - [ ] mechanical
  - [ ] qa
  - [ ] it
  - [ ] cybersecurity
  - [ ] systems_engineering
  - [ ] garbage_collector

---

### 3. Agent Logs Review

**Objective**: Verify agent reasoning and match scores

**Steps**:
1. Get agent logs:
   ```bash
   curl -X GET https://panda-vision-recruit.onrender.com/agents/logs
   ```

**Expected Response**:
```json
{
  "logs": [
    {
      "id": 1,
      "task_id": 1,
      "agent_type": "software",
      "decision": "matched|rejected|hold",
      "match_score": 85,
      "reasoning": "Candidate has required Python experience...",
      "created_at": "2026-05-12T22:30:00Z"
    }
  ]
}
```

**Verification Checklist**:
- [ ] Each agent has a decision (matched/rejected/hold)
- [ ] Match scores are 0-100
- [ ] Reasoning is clear and relevant
- [ ] Scores reflect candidate-job fit
- [ ] Agent names are correct

---

### 4. Match Results Verification

**Objective**: Verify matches appear in system

**Steps**:
1. Get matches:
   ```bash
   curl -X GET https://panda-vision-recruit.onrender.com/matches/
   ```

**Expected Response**:
```json
{
  "matches": [
    {
      "id": 1,
      "candidate_id": 1,
      "job_id": 1,
      "agent_type": "software",
      "match_score": 85,
      "decision": "matched",
      "summary": "...",
      "status": "pending_approval",
      ...
    }
  ]
}
```

**Verification Checklist**:
- [ ] Matches with "matched" decision have scores > 70
- [ ] Matches with "rejected" decision have scores < 50
- [ ] Status is "pending_approval" (waiting for human review)
- [ ] Summary provides clear rationale
- [ ] All matched candidates appear

---

## Performance Testing

### 1. Response Time Test

**Objective**: Verify API response times are acceptable

**Test Endpoints**:
- GET /health
- GET /candidates/ (small dataset)
- GET /jobs/ (small dataset)
- GET /matches/ (small dataset)
- POST /agents/jobs/1/match (medium compute)

**Acceptable Times**:
- Health check: < 200ms
- GET endpoints: < 1 second
- Agent matching: < 5 seconds

**Test Command**:
```bash
time curl -s https://panda-vision-recruit.onrender.com/health > /dev/null
```

---

### 2. Load Test (Optional)

**Objective**: Verify system handles concurrent requests

**Tool**: Apache Bench or `ab` command

```bash
# Test 100 concurrent requests
ab -n 100 -c 10 https://panda-vision-recruit.onrender.com/health

# Check results:
# - Requests per second
# - Failed requests (should be 0)
# - Average response time
```

---

## Troubleshooting

### Frontend Issues

#### Issue: Page shows only "frontend" text

**Causes**:
- JavaScript bundle didn't load
- API URL not configured correctly
- Build not completed

**Solutions**:
1. Check browser console (F12): Any JavaScript errors?
2. Check Network tab: Is bundle.js loading?
3. Verify API URL: 
   ```javascript
   console.log(import.meta.env.VITE_API_URL)
   ```
4. Check Vercel build logs

---

#### Issue: Pages load but show no data

**Causes**:
- API connection failing
- Database empty
- CORS issues

**Solutions**:
1. Check Network tab: API requests returning what status?
2. Test API directly: `curl https://panda-vision-recruit.onrender.com/candidates/`
3. Check browser console for CORS errors
4. Verify backend is healthy: `/health` endpoint

---

### Backend Issues

#### Issue: API returns 502 Bad Gateway

**Causes**:
- Render service crashed
- Database connection failed
- Environment variables not set

**Solutions**:
1. Check Render logs: https://dashboard.render.com
2. Verify DATABASE_URL is set correctly
3. Restart Render service
4. Check all required environment variables

---

#### Issue: Agents not processing

**Causes**:
- ANTHROPIC_API_KEY not set
- Database not initialized
- Agent service crashed

**Solutions**:
1. Verify ANTHROPIC_API_KEY in Render dashboard
2. Check Render logs for errors
3. Test agent endpoint directly: `POST /agents/jobs/1/match`
4. Check agent logs: `GET /agents/logs`

---

### Database Issues

#### Issue: "relation 'candidates' does not exist"

**Cause**: Database tables not created

**Solution**:
1. Check database initialization: Render logs should show "Database initialized"
2. If not, restart Render service
3. Manually create tables if needed (contact admin)

---

## Test Results Template

```markdown
# Panda-Vision Recruit - Test Results

**Date**: YYYY-MM-DD  
**Tester**: [Your Name]  
**Duration**: HH:MM

## Pre-Test Checklist
- [ ] Vercel build complete
- [ ] Render build complete
- [ ] Backend health check passes
- [ ] Database accessible

## Frontend Tests
- [ ] Page load test: PASS/FAIL
- [ ] Navigation test: PASS/FAIL (items: ___)
- [ ] API connectivity: PASS/FAIL
- [ ] UI rendering: PASS/FAIL

## Backend Tests
- [ ] Health endpoint: PASS/FAIL
- [ ] Candidates endpoint: PASS/FAIL
- [ ] Jobs endpoint: PASS/FAIL
- [ ] Matches endpoint: PASS/FAIL
- [ ] Email scan endpoint: PASS/FAIL
- [ ] Error handling: PASS/FAIL

## Integration Tests
- [ ] Test data creation: PASS/FAIL
- [ ] Frontend data display: PASS/FAIL
- [ ] Email scanner: PASS/FAIL

## Agent Tests
- [ ] Agent task creation: PASS/FAIL
- [ ] Agent processing: PASS/FAIL
- [ ] Agent logs: PASS/FAIL
- [ ] Match results: PASS/FAIL

## Performance Tests
- [ ] Response times: PASS/FAIL
- [ ] Load test: PASS/FAIL

## Overall Result: PASS/FAIL

### Issues Found
1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Status: Open/In Progress/Resolved
   - Notes: [Additional details]

### Sign-Off
- Tested by: [Name]
- Date: YYYY-MM-DD
- Approved by: [Name]
```

---

## Sign-Off

This test plan should be followed after production deployment is complete. Once all tests pass, the system is ready for use.

**Test Plan Created**: May 12, 2026  
**Last Updated**: May 12, 2026  
**Maintained by**: Development Team
