import { evaluateCandidateWithGemini } from './gemini'

export type CandidateProfile = {
  name?: string
  email?: string
  phone?: string
  city?: string
  college?: string
  role?: string
  skills?: string[] | string
  experience?: string | number
  education?: string[] | string
  certifications?: string[] | string
  projects?: string[] | string
  summary?: string
  [key: string]: unknown
}

export type CandidateScore = {
  score: number
  status: 'Shortlisted' | 'Manual Review' | 'Rejected'
  reason: string
  missing_skills: string[]
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function normalizeScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)))
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)))
    }
  }
  return 0
}

function normalizeStatus(value: unknown, score: number): CandidateScore['status'] {
  const normalized = typeof value === 'string' ? value.trim() : ''
  const allowed = ['Shortlisted', 'Manual Review', 'Rejected']
  if (allowed.includes(normalized)) {
    return normalized as CandidateScore['status']
  }
  if (score >= 80) return 'Shortlisted'
  if (score >= 50) return 'Manual Review'
  return 'Rejected'
}

export async function scoreCandidateWithGemini(
  candidateProfile: CandidateProfile,
  requiredSkills: string[]
): Promise<CandidateScore> {
  if (!candidateProfile || typeof candidateProfile !== 'object') {
    throw new Error('candidateProfile must be an object')
  }
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    throw new Error('requiredSkills must be a non-empty array of strings')
  }

  // Call Gemini scoring helper which returns match_score and ai_summary
  const role = String(candidateProfile.role || '')
  const geminiResp = await evaluateCandidateWithGemini(candidateProfile, role)

  const score = normalizeScore(geminiResp.match_score)
  const reason = String(geminiResp.ai_summary || '')

  const profileSkills = normalizeStringArray(candidateProfile.skills)
  const lowerSkills = profileSkills.map((s) => s.toLowerCase())
  const missing_skills = requiredSkills
    .map((s) => s.trim())
    .filter((rs) => rs.length > 0 && !lowerSkills.includes(rs.toLowerCase()))

  const status = normalizeStatus(null, score)

  return { score, status, reason, missing_skills }
}
