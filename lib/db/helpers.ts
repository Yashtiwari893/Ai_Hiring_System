import { getSupabaseAdminClient } from '../supabaseClient'
import type {
  Candidate,
  InsertCandidate,
  CandidateAnalysis,
  InsertCandidateAnalysis,
  CandidateNote,
  InsertCandidateNote,
  InterviewStage,
  InsertInterviewStage,
  AnalyticsSummary,
  LeaderboardCandidate,
  CandidateCounts,
} from './types'

const supabaseAdmin = () => getSupabaseAdminClient()

export type CandidatePageOptions = {
  page?: number
  limit?: number
  status?: string
  search?: string
}

export type CandidatePage = {
  candidates: Candidate[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const STATUS_FILTERS = ['Shortlisted', 'Rejected', 'Manual Review']
const STAGE_VALUES = ['Applied', 'Phone Screen', 'Technical Interview', 'Interview Scheduled', 'Offer', 'Hired', 'Rejected']

function normalizeStatusFilter(status?: string) {
  return status && STATUS_FILTERS.includes(status) ? status : undefined
}

function escapeSearchTerm(value: string) {
  return value.replace(/([%_])/g, '\\$1')
}

export async function createCandidate(payload: InsertCandidate): Promise<Candidate> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidates').insert(payload).select().single()
  if (error) throw error
  return data as Candidate
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
  if (error && error.code !== 'PGRST116') throw error
  return data as Candidate | null
}

export async function addCandidateAnalysis(payload: InsertCandidateAnalysis): Promise<CandidateAnalysis> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_analysis').insert(payload).select().single()
  if (error) throw error
  return data as CandidateAnalysis
}

export async function getAnalysisByCandidateId(candidate_id: string): Promise<CandidateAnalysis[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_analysis').select('*').eq('candidate_id', candidate_id).order('created_at', { ascending: false })
  if (error) throw error
  return data as CandidateAnalysis[]
}

export async function listCandidates(limit = 50): Promise<Candidate[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidates').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data as Candidate[]
}

export async function getCandidateCounts(): Promise<CandidateCounts> {
  const supabase = supabaseAdmin()

  const totalResponse = await supabase.from('candidates').select('id', { count: 'exact', head: true })
  if (totalResponse.error) throw totalResponse.error

  const shortlistedResponse = await supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Shortlisted')
  if (shortlistedResponse.error) throw shortlistedResponse.error

  const rejectedResponse = await supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Rejected')
  if (rejectedResponse.error) throw rejectedResponse.error

  const manualReviewResponse = await supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Manual Review')
  if (manualReviewResponse.error) throw manualReviewResponse.error

  return {
    total: totalResponse.count ?? 0,
    shortlisted: shortlistedResponse.count ?? 0,
    rejected: rejectedResponse.count ?? 0,
    manualReview: manualReviewResponse.count ?? 0,
  }
}

export async function fetchCandidates(options: CandidatePageOptions = {}): Promise<CandidatePage> {
  const page = Math.max(1, Number(options.page ?? 1))
  const limit = Math.min(50, Math.max(5, Number(options.limit ?? 10)))
  const status = normalizeStatusFilter(options.status)
  const searchTerm = (options.search || '').trim()
  const offset = (page - 1) * limit

  const supabase = supabaseAdmin()
  let query = supabase
    .from('candidates')
    .select('id,name,email,role_applied,match_score,ranking_score,status,current_stage,resume_url,parsed_json', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (searchTerm.length > 0) {
    const escaped = escapeSearchTerm(searchTerm)
    query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%,role_applied.ilike.%${escaped}%`)
  }

  const { data, error, count } = await query
  if (error) throw error

  const total = count ?? (data?.length ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return {
    candidates: (data ?? []) as Candidate[],
    total,
    page,
    limit,
    totalPages,
  }
}

export async function getTopCandidates(limit = 10): Promise<LeaderboardCandidate[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('candidates')
    .select('id,name,email,role_applied,match_score,ranking_score,status,current_stage,resume_url')
    .order('ranking_score', { ascending: false, nullsFirst: false })
    .order('match_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as LeaderboardCandidate[]
}

export async function getRecruiterAnalytics(): Promise<AnalyticsSummary> {
  const supabase = supabaseAdmin()

  const [pending, shortlisted, manualReview, rejected, duplicateCount, noteCount] = await Promise.all([
    supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Shortlisted'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Manual Review'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('status', 'Rejected'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).not('duplicate_of', 'is', null),
    supabase.from('candidate_notes').select('id', { count: 'exact', head: true }),
  ])

  if (pending.error) throw pending.error
  if (shortlisted.error) throw shortlisted.error
  if (manualReview.error) throw manualReview.error
  if (rejected.error) throw rejected.error
  if (duplicateCount.error) throw duplicateCount.error
  if (noteCount.error) throw noteCount.error

  const stageCounts: Record<string, number> = {}
  await Promise.all(
    STAGE_VALUES.map(async (stage) => {
      const response = await supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('current_stage', stage)
      if (response.error) throw response.error
      stageCounts[stage] = response.count ?? 0
    })
  )

  const totalResponse = await supabase.from('candidates').select('id', { count: 'exact', head: true })
  if (totalResponse.error) throw totalResponse.error

  return {
    total: totalResponse.count ?? 0,
    pending: pending.count ?? 0,
    shortlisted: shortlisted.count ?? 0,
    manualReview: manualReview.count ?? 0,
    rejected: rejected.count ?? 0,
    duplicateCount: duplicateCount.count ?? 0,
    noteCount: noteCount.count ?? 0,
    stageCounts,
  }
}

export async function findDuplicateCandidates(params: { email?: string; phone?: string }): Promise<Candidate[]> {
  const supabase = supabaseAdmin()
  const filters: string[] = []

  if (params.email) {
    filters.push(`email.eq.${params.email}`)
  }
  if (params.phone) {
    filters.push(`phone.eq.${params.phone}`)
  }
  if (filters.length === 0) {
    throw new Error('Email or phone is required to detect duplicates')
  }

  const { data, error } = await supabase
    .from('candidates')
    .select('id,name,email,phone,role_applied,match_score,status,duplicate_of,duplicate_reason')
    .or(filters.join(','))
    .limit(20)

  if (error) throw error
  return (data ?? []) as Candidate[]
}

export async function getDuplicateCandidates(): Promise<Candidate[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('candidates')
    .select('id,name,email,phone,role_applied,match_score,status,duplicate_of,duplicate_reason,duplicate_detected_at')
    .not('duplicate_of', 'is', null)
    .order('duplicate_detected_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Candidate[]
}

export async function addCandidateNote(payload: InsertCandidateNote): Promise<CandidateNote> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_notes').insert(payload).select().single()
  if (error) throw error
  return data as CandidateNote
}

export async function listCandidateNotes(candidate_id: string): Promise<CandidateNote[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_notes').select('*').eq('candidate_id', candidate_id).order('created_at', { ascending: false })
  if (error) throw error
  return data as CandidateNote[]
}

export async function addInterviewStage(payload: InsertInterviewStage): Promise<InterviewStage> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_stages').insert(payload).select().single()
  if (error) throw error
  return data as InterviewStage
}

export async function listInterviewStages(candidate_id: string): Promise<InterviewStage[]> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_stages').select('*').eq('candidate_id', candidate_id).order('created_at', { ascending: false })
  if (error) throw error
  return data as InterviewStage[]
}

export async function updateCandidateStage(payload: InsertInterviewStage): Promise<InterviewStage> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.from('candidate_stages').insert(payload).select().single()
  if (error) throw error

  const updateResponse = await supabase
    .from('candidates')
    .update({ current_stage: payload.stage, last_activity_at: new Date().toISOString() })
    .eq('id', payload.candidate_id)

  if (updateResponse.error) throw updateResponse.error
  return data as InterviewStage
}

export async function setCandidateRankingScore(candidate_id: string, ranking_score: number): Promise<Candidate> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('candidates')
    .update({ ranking_score, last_activity_at: new Date().toISOString() })
    .eq('id', candidate_id)
    .select()
    .single()

  if (error) throw error
  return data as Candidate
}
