# Phase 3: AI Agents & Orchestration System

## Overview

Phase 3 implements the "brains" of the recruitment system - AI agents that intelligently match candidates to job positions based on domain expertise, security requirements, and detailed qualifications analysis.

## Architecture

### Core Components

#### 1. **OrchestratorAgent** (מנהל הגיוס)
- Central coordinator for the matching process
- Classifies new jobs to appropriate specialized agents
- Performs quality control checks
- Manages priorities based on job importance
- Produces final hiring recommendations

#### 2. **Specialized Agents** (סוכני גיוס מתמחים)
Eight domain-specific agents, each with expertise:

- **Software**: Programming languages, frameworks, DevOps, cloud
- **Electronics**: Hardware design, microcontrollers, FPGA, embedded systems
- **Mechanical**: CAD, FEA/CFD, manufacturing, materials
- **QA**: Test automation, manual testing, performance testing
- **IT**: Network/system administration, cloud services, monitoring
- **Cybersecurity**: Penetration testing, secure coding, incident response
- **Systems Engineering**: Architecture, requirements, integration, testing
- **Garbage Collector**: Catch-all for general/miscellaneous positions

#### 3. **ClaudeClient**
Wrapper around the Claude API for:
- Formatting job and candidate data
- Calling Claude with specialized system prompts
- Parsing JSON responses
- Token usage tracking

#### 4. **AgentWatchdog**
Monitors and manages agent health:
- Detects stuck/timeout tasks
- Auto-restarts failed tasks (with retry limit)
- Tracks task statistics
- Prevents infinite loops

#### 5. **OrchestratorEngine**
Main workflow orchestrator:
- Processes new jobs end-to-end
- Coordinates candidate matching
- Manages task queues
- Provides system status monitoring

### Data Models

#### AgentTask
Tracks every agent operation:
- Status: pending, in_progress, completed, failed, timeout
- Input/output data
- Retry logic (max 3 retries by default)
- Timeout management (300 seconds default)
- Error tracking

#### AgentLog
Complete audit trail of all agent communications:
- Message type: input, output, error, feedback
- Sender identification
- Content of each message
- Token usage and model information
- Processing time

#### FeedbackLog
Human feedback for continuous agent learning:
- Which matches were correct/incorrect
- Optional human commentary
- Agent type that made the match
- Flag for ML training usage

## System Prompts

Each specialized agent receives a detailed Hebrew system prompt defining:

### Matching Criteria

1. **Security Classification (חובה)**
   - Must match: If job requires SECRET and candidate is CONFIDENTIAL → reject
   - Exact match or candidate higher → accept
   - Example: SECRET job + SECRET CV candidate → OK ✓

2. **Percentage Match Score (0-100)**
   - Analyzes required vs. actual skills
   - Weighted by importance
   - Returns numeric score for ranking

3. **3-Year Rule**
   - Flag if CV is older than 3 years
   - Warning in summary, doesn't fail match
   - Indicates possible skill degradation

4. **Verbal Summary**
   - Professional paragraph explaining the match
   - Lists key matching skills
   - Identifies gaps
   - Business-ready reasoning

### Response Format

All specialized agents return JSON:
```json
{
  "match_score": 75,
  "security_level_valid": true,
  "summary": "Strong match - 5 years Python experience covers all requirements",
  "key_skills_found": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Kubernetes"],
  "warnings": ["CV from 2021 - 3 years old"],
  "decision": "match"
}
```

## Workflow

### Full Matching Cycle (process_job_and_find_matches)

```
1. New Job Arrives
   ↓
2. OrchestratorAgent Classifies
   - "This is a Software Engineering role"
   - Assign to: SoftwareAgent
   ↓
3. For Each Active Candidate:
   ↓
4. SoftwareAgent Analyzes Match
   - Security: Check ✓
   - Skills: Python ✓, Docker ✓, Kubernetes ✗
   - Score: 75/100
   ↓
5. OrchestratorAgent Quality Control
   - Check Pipedrive for negative notes
   - Verify no duplicate matches
   ↓
6. Create Match Record
   - Store score, summary, agent name
   - Status: PENDING (awaiting admin approval)
   ↓
7. Admin Reviews & Approves/Rejects
   ↓
8. Feedback Logged for Agent Learning
```

## API Endpoints

### Matching
- **POST /agents/jobs/{job_id}/match** - Start full matching workflow for a job

### Task Management
- **GET /agents/tasks** - List agent tasks with filtering
- **GET /agents/tasks/{task_id}** - Detailed task info with logs

### Feedback & Learning
- **POST /agents/feedback/match/{match_id}** - Submit feedback on a match

### System Health
- **GET /agents/status** - Overall system status
- **POST /agents/watchdog/restart-stuck** - Manually restart stuck tasks

## Configuration

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-7
```

### Task Configuration

Default values in code:
- `timeout_seconds`: 300 (5 minutes)
- `max_retries`: 3
- `temperature`: 0.2 (low for deterministic matching)
- Match score threshold: 50/100

## Example Usage

### Start Matching for a Job

```bash
curl -X POST http://localhost:8000/agents/jobs/42/match \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "status": "success",
  "data": {
    "status": "completed",
    "job_id": 42,
    "agent_type": "software",
    "total_candidates_checked": 50,
    "matches_found": 8,
    "matches": [
      {
        "match_id": 123,
        "candidate_id": 45,
        "match_score": 92,
        "summary": "Excellent match..."
      }
    ]
  }
}
```

### Get System Status

```bash
curl http://localhost:8000/agents/status
```

Response:
```json
{
  "status": "operational",
  "statistics": {
    "total": 150,
    "pending": 5,
    "in_progress": 2,
    "completed": 140,
    "failed": 2,
    "timeout": 1
  },
  "stuck_tasks": []
}
```

### Submit Feedback

```bash
curl -X POST http://localhost:8000/agents/feedback/match/123 \
  -H "Content-Type: application/json" \
  -d '{
    "was_correct": false,
    "feedback_text": "Candidate lacked required security clearance"
  }'
```

## Logging & Transparency

All agent communications are logged to `AgentLog` table:

- **Task Input**: What the agent received
- **Agent Processing**: Claude API calls with prompts
- **Agent Output**: The response and parsed JSON
- **Errors**: Any failures during processing
- **Tokens Used**: For cost tracking

Query logs:
```sql
SELECT * FROM agent_logs 
WHERE task_id = 42 
ORDER BY created_at;
```

## Quality Control Process

### Orchestrator QC Checks

1. **Security Validation** (chatbotlevel)
   - Cross-reference candidate security level
   - Candidate security ≥ Job security

2. **Negative Notes Check** (future Pipedrive integration)
   - Search Pipedrive for candidate by name
   - Flag if previous negative feedback exists
   - Reject match if disqualifying

3. **Decision Finalization**
   - Generate final "APPROVED" or "REJECTED" decision
   - Provide clear reasoning
   - Log decision in database

## Feedback & Learning Loop

### Human Feedback Collection

Admin/recruiter marks matches as correct/incorrect:
- **Correct**: Agent's prediction matched actual hiring decision
- **Incorrect**: Agent missed red flags or overestimated fit

### Learning Mechanism (Future Enhancement)

Feedback logs are stored in `FeedbackLog` table:
- Can be used to fine-tune agent prompts
- Identify systematic biases
- Improve matching accuracy over time
- Track agent performance metrics

## Watchdog & Recovery

### Stuck Task Detection

Tasks marked as "In Progress" for > 5 minutes are considered stuck.

### Automatic Recovery

1. Check elapsed time
2. If < max_retries:
   - Reset status to PENDING
   - Increment retry_count
   - Log restart reason
3. If >= max_retries:
   - Mark as TIMEOUT
   - Send alert (optional)
   - Stop retrying

### Manual Intervention

```bash
curl -X POST http://localhost:8000/agents/watchdog/restart-stuck
```

Returns count of tasks restarted.

## Performance Metrics

### Typical Processing Time

- Job classification: ~2-3 seconds
- Single candidate match: ~3-5 seconds
- Batch matching (50 candidates): ~3-4 minutes

### Token Usage

- Job classification: ~200-300 tokens
- Candidate match: ~500-800 tokens
- Total for 50-candidate batch: ~25,000-40,000 tokens

### Cost Estimate (Claude Opus 4.7)

Assuming $15/M input tokens, $45/M output tokens:
- Single match: $0.01
- 50-candidate batch: $0.30-0.50

## Error Handling

### Common Errors

1. **JSON Parse Failure**
   - Claude response not valid JSON
   - Falls back to default response
   - Marked as error, retried

2. **API Timeout**
   - Watchdog detects and restarts
   - Retry up to 3 times
   - Then mark as TIMEOUT

3. **Data Not Found**
   - Job or candidate missing
   - Clear error message
   - Task marked as FAILED

## Security Considerations

- System prompts are version-controlled
- All decisions are auditable via logs
- Claude API key in environment (never in code)
- No PII leaked in logs (only IDs)
- Rate limiting via task queue (future)

## Next Steps

1. **Integration with Pipedrive**
   - Fetch negative notes from deals
   - Automated QC validation

2. **Admin Dashboard**
   - Review pending matches
   - Approve/reject with notes
   - See agent confidence scores

3. **Continuous Learning**
   - Aggregate feedback data
   - Analyze agent performance
   - Fine-tune system prompts

4. **Advanced Matching**
   - Skill extraction from CVs
   - Experience level scoring
   - Language detection
   - Cultural fit analysis

5. **Performance Optimization**
   - Batch candidate processing
   - Caching for repeated jobs
   - Parallel agent execution
