-- SQL schema for AI Recruitment Automation
-- Creates candidates and candidate_analysis tables

-- Enable pgcrypto/gen_random_uuid if available (Supabase uses pgcrypto)
-- Note: On some Postgres setups you may prefer pgcrypto or uuid-ossp
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  city text,
  college text,
  role text,
  resume_url text,
  resume_text text,
  parsed_json jsonb,
  match_score integer,
  ranking_score integer,
  current_stage text DEFAULT 'Applied',
  duplicate_of uuid,
  duplicate_reason text,
  duplicate_detected_at timestamptz,
  role_relevance text,
  ai_summary text,
  sheet_synced boolean DEFAULT false,
  sheet_sync_error text,
  email_sent boolean DEFAULT false,
  email_error text,
  whatsapp_sent boolean DEFAULT false,
  whatsapp_error text,
  status text DEFAULT 'Pending',
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  author text NOT NULL,
  note text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage text NOT NULL,
  comments text,
  updated_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_stages_candidate_id ON candidate_stages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidates_duplicate_of ON candidates(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_candidates_current_stage ON candidates(current_stage);
CREATE INDEX IF NOT EXISTS idx_candidates_ranking_score ON candidates(ranking_score DESC);
