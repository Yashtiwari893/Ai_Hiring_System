export type Candidate = {
  id: string
  name: string
  email?: string
  phone?: string
  city?: string
  college?: string
  role_applied?: string
  role?: string
  resume_url?: string
  match_score?: number
  ranking_score?: number
  status?: string
  current_stage?: string
  duplicate_of?: string | null
  duplicate_reason?: string | null
  duplicate_detected_at?: string | null
  parsed_json?: any
  sheet_synced?: boolean
  email_sent?: boolean
  whatsapp_sent?: boolean
  last_activity_at?: string
  created_at?: string
}

export type CandidateAnalysis = {
  id: string
  candidate_id?: string | null
  skills?: any // JSON structure
  experience?: number | null
  education?: any
  summary?: string | null
  score?: number | null
  status?: string | null
  missing_skills?: any
  created_at?: string
}

export type CandidateCounts = {
  total: number
  shortlisted: number
  rejected: number
  manualReview: number
}

export type CandidateNote = {
  id: string
  candidate_id: string
  author: string
  note: string
  category?: string
  created_at?: string
}

export type InterviewStage = {
  id: string
  candidate_id: string
  stage: string
  comments?: string
  updated_by?: string
  created_at?: string
}

export type LeaderboardCandidate = {
  id: string
  name: string
  email?: string
  role_applied?: string
  match_score?: number
  ranking_score?: number
  status?: string
  current_stage?: string
  resume_url?: string
}

export type AnalyticsSummary = {
  total: number
  pending: number
  shortlisted: number
  manualReview: number
  rejected: number
  duplicateCount: number
  noteCount: number
  stageCounts: Record<string, number>
}

export type InsertCandidate = Omit<Candidate, 'id' | 'created_at'>
export type InsertCandidateAnalysis = Omit<CandidateAnalysis, 'id' | 'created_at'>
export type InsertCandidateNote = Omit<CandidateNote, 'id' | 'created_at'>
export type InsertInterviewStage = Omit<InterviewStage, 'id' | 'created_at'>
