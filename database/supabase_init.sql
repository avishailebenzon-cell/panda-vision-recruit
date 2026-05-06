-- Panda-Vision Recruit Database Initialization for Supabase
-- Based on Specification V8
-- Run this script in Supabase SQL Editor to initialize the schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Candidates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id BIGSERIAL PRIMARY KEY,

    -- Personal Information
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    location VARCHAR(255),

    -- Security Classification
    security_level TEXT DEFAULT 'no_security' CHECK (security_level IN ('no_security', 'confidential', 'secret', 'top_secret')),

    -- CV/Resume
    cv_url TEXT,  -- Supabase Storage URL
    notes TEXT,   -- Extracted CV text

    -- Tracking Dates
    email_received_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scanned_date TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted')),

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Indexes for performance
    CONSTRAINT email_idx UNIQUE (email),
    INDEX idx_candidates_status (status),
    INDEX idx_candidates_email (email),
    INDEX idx_candidates_security (security_level)
);

-- ============================================================================
-- Jobs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,

    -- Pipedrive Integration
    pipedrive_deal_id VARCHAR(255) NOT NULL UNIQUE,

    -- Job Details
    title VARCHAR(255) NOT NULL,
    qualifications TEXT NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),

    -- Additional Fields
    department VARCHAR(255),
    salary_range VARCHAR(255),

    -- Security & Priority
    security_level TEXT DEFAULT 'no_security' CHECK (security_level IN ('no_security', 'confidential', 'secret', 'top_secret')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Indexes
    CONSTRAINT pipedrive_id_idx UNIQUE (pipedrive_deal_id),
    INDEX idx_jobs_active (is_active),
    INDEX idx_jobs_priority (priority),
    INDEX idx_jobs_security (security_level)
);

-- ============================================================================
-- Matches Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id BIGSERIAL PRIMARY KEY,

    -- Foreign Keys
    candidate_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,

    -- Agent Information
    agent_name VARCHAR(255) NOT NULL,

    -- Match Scoring
    match_score NUMERIC(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    summary TEXT NOT NULL,

    -- Status & Approval
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    admin_approved BOOLEAN DEFAULT false,
    admin_notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Foreign Key Constraints
    CONSTRAINT fk_matches_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_matches_status (status),
    INDEX idx_matches_candidate (candidate_id),
    INDEX idx_matches_job (job_id),
    INDEX idx_matches_approved (admin_approved)
);

-- ============================================================================
-- Synonyms Dictionary Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS synonyms_dictionary (
    id BIGSERIAL PRIMARY KEY,

    -- Category
    category TEXT NOT NULL,  -- e.g., 'security_top_secret', 'security_secret', etc.

    -- Synonyms (stored as JSON array for flexibility)
    synonyms JSONB NOT NULL DEFAULT '[]',

    -- Metadata
    language TEXT DEFAULT 'he',  -- Hebrew by default
    description TEXT,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Constraints
    CONSTRAINT unique_category_language UNIQUE (category, language),
    INDEX idx_synonyms_category (category)
);

-- ============================================================================
-- System Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,

    -- Log Information
    log_type TEXT NOT NULL,  -- 'email_scan', 'watchdog_restart', 'agent_task', etc.
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),

    -- Content
    message TEXT NOT NULL,
    details JSONB,  -- Additional context as JSON

    -- Related IDs
    candidate_id BIGINT,
    job_id BIGINT,
    match_id BIGINT,

    -- Source
    source VARCHAR(255),  -- Which service/agent generated this log

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Indexes
    INDEX idx_logs_type (log_type),
    INDEX idx_logs_severity (severity),
    INDEX idx_logs_created (created_at),
    INDEX idx_logs_candidate (candidate_id)
);

-- ============================================================================
-- Settings Table (Configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,

    -- Key-Value Store
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,

    -- Metadata
    description TEXT,

    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Indexes
    CONSTRAINT unique_settings_key UNIQUE (key)
);

-- ============================================================================
-- Initial Data - Default Synonyms Dictionary
-- ============================================================================
INSERT INTO synonyms_dictionary (category, synonyms, language, description)
VALUES
    (
        'security_top_secret',
        '["סוד עליון", "top secret", "סוד מדינה", "ביטחוני ביותר", "הסדר סוד", "צה\"ל", "משרד הביטחון"]',
        'he',
        'Top Secret security clearance keywords'
    ),
    (
        'security_secret',
        '["secret", "סוד", "סודי", "סודיות", "מסווג", "classified", "הנדסה צבאית"]',
        'he',
        'Secret security clearance keywords'
    ),
    (
        'security_confidential',
        '["confidential", "חסוי", "פנים", "sensitive", "בתוך הקבוצה", "restricted", "מוגבל"]',
        'he',
        'Confidential security clearance keywords'
    )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Email Scan Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_scan_logs (
    id BIGSERIAL PRIMARY KEY,

    -- Timing
    scan_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scan_end_time TIMESTAMP WITH TIME ZONE,

    -- Results
    total_emails_scanned BIGINT DEFAULT 0,
    attachments_found BIGINT DEFAULT 0,
    candidates_created BIGINT DEFAULT 0,
    candidates_updated BIGINT DEFAULT 0,
    candidates_skipped BIGINT DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,

    -- Detailed Info
    details JSONB,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Indexes
    INDEX idx_scan_logs_status (status),
    INDEX idx_scan_logs_created (created_at)
);

-- ============================================================================
-- Agent Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id BIGSERIAL PRIMARY KEY,

    -- Task Info
    task_type VARCHAR(50) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout')),

    -- Agent Assignment
    assigned_agent TEXT,

    -- Related Entities
    job_id BIGINT,
    candidate_id BIGINT,
    match_id BIGINT,

    -- Data
    input_data JSONB,
    output_data JSONB,

    -- Error Handling
    error_message TEXT,
    retry_count BIGINT DEFAULT 0,
    max_retries BIGINT DEFAULT 3,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_seconds BIGINT DEFAULT 300,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Foreign Keys
    CONSTRAINT fk_tasks_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_agent (assigned_agent),
    INDEX idx_tasks_created (created_at)
);

-- ============================================================================
-- Agent Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGSERIAL PRIMARY KEY,

    -- Task Reference
    task_id BIGINT,

    -- Log Info
    agent_type VARCHAR(50) NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    sender VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,

    -- Metrics
    tokens_used BIGINT,
    model_used VARCHAR(100),
    processing_time_ms BIGINT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Foreign Key
    CONSTRAINT fk_logs_task FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_agent_logs_task (task_id),
    INDEX idx_agent_logs_type (agent_type),
    INDEX idx_agent_logs_created (created_at)
);

-- ============================================================================
-- Feedback Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_logs (
    id BIGSERIAL PRIMARY KEY,

    -- Match Feedback
    match_id BIGINT NOT NULL,
    was_correct BOOLEAN NOT NULL,
    feedback_text TEXT,

    -- Agent Learning
    agent_type VARCHAR(50) NOT NULL,
    used_for_learning BOOLEAN DEFAULT false,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Foreign Key
    CONSTRAINT fk_feedback_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_feedback_match (match_id),
    INDEX idx_feedback_agent (agent_type),
    INDEX idx_feedback_correct (was_correct)
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon (unauthenticated) read access for specific tables
CREATE POLICY "Allow anon read on candidates" ON candidates
    FOR SELECT USING (true);

CREATE POLICY "Allow anon read on jobs" ON jobs
    FOR SELECT USING (true);

CREATE POLICY "Allow anon read on matches" ON matches
    FOR SELECT USING (true);

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated all on candidates" ON candidates
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated all on jobs" ON jobs
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated all on matches" ON matches
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated all on agent_tasks" ON agent_tasks
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated all on agent_logs" ON agent_logs
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Active candidates view
CREATE OR REPLACE VIEW active_candidates AS
SELECT * FROM candidates
WHERE status = 'active'
ORDER BY scanned_date DESC;

-- Open jobs view
CREATE OR REPLACE VIEW open_jobs AS
SELECT * FROM jobs
WHERE is_active = true
ORDER BY priority DESC, created_at DESC;

-- Pending matches view
CREATE OR REPLACE VIEW pending_matches AS
SELECT
    m.*,
    c.first_name,
    c.last_name,
    c.email,
    j.title as job_title
FROM matches m
JOIN candidates c ON m.candidate_id = c.id
JOIN jobs j ON m.job_id = j.id
WHERE m.status = 'pending'
ORDER BY m.match_score DESC;

-- Recent logs view
CREATE OR REPLACE VIEW recent_system_logs AS
SELECT * FROM system_logs
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candidates_status_date ON candidates(status, scanned_date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_job_status ON matches(job_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_status ON matches(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created ON agent_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type_created ON system_logs(log_type, created_at DESC);

-- ============================================================================
-- Initialize Default Settings
-- ============================================================================

INSERT INTO settings (key, value, description)
VALUES
    ('email_scan_interval_minutes', '30', 'Email scan frequency in minutes'),
    ('email_scan_limit', '50', 'Maximum emails per scan'),
    ('agent_timeout_seconds', '300', 'Agent task timeout in seconds'),
    ('agent_max_retries', '3', 'Maximum retries for failed tasks'),
    ('match_score_threshold', '50', 'Minimum match score to create match record')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Grants (if using service role)
-- ============================================================================

-- Grant permissions to anon role for read operations
GRANT SELECT ON candidates, jobs, matches, email_scan_logs, agent_tasks TO anon;

-- Grant full permissions to authenticated role
GRANT ALL ON candidates, jobs, matches, synonyms_dictionary, system_logs, settings,
    email_scan_logs, agent_tasks, agent_logs, feedback_logs TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- Create Supabase Storage Bucket Policy
-- ============================================================================

-- This should be run after bucket creation in Supabase dashboard:
-- 1. Go to Storage in Supabase dashboard
-- 2. Create bucket "cv-files" with public access
-- 3. Add policy to allow uploads from authenticated users
-- SQL below shows the intended policy structure

-- Note: Storage policies are set in Supabase dashboard UI
-- CREATE POLICY "Allow public read on CV files"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'cv-files');
--
-- CREATE POLICY "Allow authenticated upload on CV files"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'cv-files' AND auth.role() = 'authenticated');

PRINT 'Database initialization complete!';
