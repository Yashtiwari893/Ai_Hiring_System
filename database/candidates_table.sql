-- AI Hiring System - Candidates Table
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT,
  college TEXT,
  role_applied TEXT NOT NULL,
  resume_url TEXT,
  resume_text TEXT,
  parsed_json JSONB,
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  ranking_score INTEGER CHECK (ranking_score >= 0 AND ranking_score <= 100),
  current_stage TEXT NOT NULL DEFAULT 'Applied' CHECK (current_stage IN ('Applied', 'Phone Screen', 'Technical Interview', 'Interview Scheduled', 'Offer', 'Hired', 'Rejected')),
  duplicate_of UUID,
  duplicate_reason TEXT,
  duplicate_detected_at TIMESTAMP WITH TIME ZONE,
  role_relevance TEXT,
  ai_summary TEXT,
  sheet_synced BOOLEAN DEFAULT false,
  sheet_sync_error TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_error TEXT,
  whatsapp_sent BOOLEAN DEFAULT false,
  whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
  whatsapp_error TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Shortlisted', 'Manual Review', 'Rejected')),
  error_step TEXT,
  error_message TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_role_applied ON candidates(role_applied);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_match_score ON candidates(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_ranking_score ON candidates(ranking_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_current_stage ON candidates(current_stage);
CREATE INDEX IF NOT EXISTS idx_candidates_duplicate_of ON candidates(duplicate_of);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS candidates_update_timestamp ON candidates;
CREATE TRIGGER candidates_update_timestamp
BEFORE UPDATE ON candidates
FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

-- Notes table
CREATE TABLE IF NOT EXISTS candidate_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  note TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stages table
CREATE TABLE IF NOT EXISTS candidate_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('Applied', 'Phone Screen', 'Technical Interview', 'Interview Scheduled', 'Offer', 'Hired', 'Rejected')),
  comments TEXT,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_stages_candidate_id ON candidate_stages(candidate_id);

-- Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_stages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow public insert" ON candidates;
CREATE POLICY "Allow public insert" ON candidates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role all" ON candidates;
CREATE POLICY "Allow service role all" ON candidates USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role notes" ON candidate_notes;
CREATE POLICY "Allow service role notes" ON candidate_notes USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role stages" ON candidate_stages;
CREATE POLICY "Allow service role stages" ON candidate_stages USING (true) WITH CHECK (true);
