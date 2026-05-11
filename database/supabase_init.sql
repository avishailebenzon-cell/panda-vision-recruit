-- Panda-Vision Recruit Database Initialization for Supabase
-- Run this script to initialize the schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Candidates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    location VARCHAR(255),
    security_level TEXT DEFAULT 'no_security' CHECK (security_level IN ('no_security', 'confidential', 'secret', 'top_secret')),
    cv_url TEXT,
    notes TEXT,
    email_received_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scanned_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_security ON candidates(security_level);
CREATE INDEX IF NOT EXISTS idx_candidates_status_date ON candidates(status, scanned_date DESC);

-- ============================================================================
-- Jobs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    pipedrive_deal_id VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    qualifications TEXT NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    department VARCHAR(255),
    salary_range VARCHAR(255),
    security_level TEXT DEFAULT 'no_security' CHECK (security_level IN ('no_security', 'confidential', 'secret', 'top_secret')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);
CREATE INDEX IF NOT EXISTS idx_jobs_security ON jobs(security_level);

-- ============================================================================
-- Matches Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    agent_name VARCHAR(255) NOT NULL,
    match_score NUMERIC(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    summary TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    admin_approved BOOLEAN DEFAULT false,
    admin_notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_candidate ON matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_job ON matches(job_id);
CREATE INDEX IF NOT EXISTS idx_matches_job_status ON matches(job_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_status ON matches(candidate_id, status);

-- ============================================================================
-- Synonyms Dictionary Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS synonyms_dictionary (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    synonyms JSONB NOT NULL DEFAULT '[]',
    language TEXT DEFAULT 'he',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_category_language UNIQUE (category, language)
);

CREATE INDEX IF NOT EXISTS idx_synonyms_category ON synonyms_dictionary(category);

-- ============================================================================
-- System Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    log_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    details JSONB,
    candidate_id BIGINT,
    job_id BIGINT,
    match_id BIGINT,
    source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_type_created ON system_logs(log_type, created_at DESC);

-- ============================================================================
-- Settings Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- Email Scan Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_scan_logs (
    id BIGSERIAL PRIMARY KEY,
    scan_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scan_end_time TIMESTAMP WITH TIME ZONE,
    total_emails_scanned BIGINT DEFAULT 0,
    attachments_found BIGINT DEFAULT 0,
    candidates_created BIGINT DEFAULT 0,
    candidates_updated BIGINT DEFAULT 0,
    candidates_skipped BIGINT DEFAULT 0,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_status ON email_scan_logs(status);
CREATE INDEX IF NOT EXISTS idx_scan_logs_created ON email_scan_logs(created_at);

-- ============================================================================
-- Agent Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id BIGSERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout')),
    assigned_agent TEXT,
    job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id BIGINT REFERENCES candidates(id) ON DELETE CASCADE,
    match_id BIGINT,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    retry_count BIGINT DEFAULT 0,
    max_retries BIGINT DEFAULT 3,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_seconds BIGINT DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON agent_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON agent_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created ON agent_tasks(status, created_at DESC);

-- ============================================================================
-- Agent Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES agent_tasks(id) ON DELETE CASCADE,
    agent_type VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    sender VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    tokens_used BIGINT,
    model_used VARCHAR(100),
    processing_time_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at);

-- ============================================================================
-- Feedback Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_logs (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    was_correct BOOLEAN NOT NULL,
    feedback_text TEXT,
    agent_type VARCHAR(50) NOT NULL,
    used_for_learning BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_match ON feedback_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback_logs(agent_type);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read on candidates" ON candidates FOR SELECT USING (true);
CREATE POLICY "Allow anon read on jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Allow anon read on matches" ON matches FOR SELECT USING (true);

CREATE POLICY "Allow authenticated all on candidates" ON candidates USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all on jobs" ON jobs USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all on matches" ON matches USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all on agent_tasks" ON agent_tasks USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all on agent_logs" ON agent_logs USING (auth.role() = 'authenticated');

-- ============================================================================
-- Views
-- ============================================================================
CREATE OR REPLACE VIEW active_candidates AS
SELECT * FROM candidates WHERE status = 'active' ORDER BY scanned_date DESC;

CREATE OR REPLACE VIEW open_jobs AS
SELECT * FROM jobs WHERE is_active = true ORDER BY priority DESC, created_at DESC;

CREATE OR REPLACE VIEW pending_matches AS
SELECT m.*, c.first_name, c.last_name, c.email, j.title as job_title
FROM matches m
JOIN candidates c ON m.candidate_id = c.id
JOIN jobs j ON m.job_id = j.id
WHERE m.status = 'pending'
ORDER BY m.match_score DESC;

CREATE OR REPLACE VIEW recent_system_logs AS
SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT SELECT ON candidates, jobs, matches, email_scan_logs, agent_tasks TO anon;
GRANT ALL ON candidates, jobs, matches, synonyms_dictionary, system_logs, settings,
    email_scan_logs, agent_tasks, agent_logs, feedback_logs TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Default Data
-- ============================================================================
INSERT INTO synonyms_dictionary (category, synonyms, language, description)
VALUES
    ('security_top_secret', '["סוד עליון", "top secret", "סוד מדינה", "ביטחוני ביותר", "הסדר סוד", "צה\"ל", "משרד הביטחון"]', 'he', 'Top Secret keywords'),
    ('security_secret', '["secret", "סוד", "סודי", "סודיות", "מסווג", "classified", "הנדסה צבאית"]', 'he', 'Secret keywords'),
    ('security_confidential', '["confidential", "חסוי", "פנים", "sensitive", "בתוך הקבוצה", "restricted", "מוגבל"]', 'he', 'Confidential keywords')
ON CONFLICT (category, language) DO NOTHING;

INSERT INTO settings (key, value, description)
VALUES
    ('email_scan_interval_minutes', '30', 'Email scan frequency in minutes'),
    ('email_scan_limit', '50', 'Maximum emails per scan'),
    ('agent_timeout_seconds', '300', 'Agent task timeout in seconds'),
    ('agent_max_retries', '3', 'Maximum retries for failed tasks'),
    ('match_score_threshold', '50', 'Minimum match score to create match record')
ON CONFLICT (key) DO NOTHING;

-- Initialization complete
