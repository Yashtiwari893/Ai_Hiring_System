import { NextResponse, type NextRequest } from 'next/server'
import { addCandidateAnalysis } from '../../../lib/db/helpers'
import { scoreCandidateWithGemini, type CandidateProfile } from '../../../lib/ai/scoreCandidate'

type ScoreCandidateRequest = {
  candidate_profile: CandidateProfile
  required_skills: string[]
  candidate_id?: string
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
  }
  return []
}

function normalizeCandidateProfile(profile: CandidateProfile) {
  const skills = ensureStringArray(profile.skills)
  const education = Array.isArray(profile.education)
    ? profile.education.filter((item) => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : typeof profile.education === 'string'
    ? profile.education.split(/\n|,|;/).map((item) => item.trim()).filter((item) => item.length > 0)
    : []

  const summary = typeof profile.summary === 'string' ? profile.summary.trim() : ''
  const experience = typeof profile.experience === 'number'
    ? profile.experience
    : typeof profile.experience === 'string'
    ? Number(profile.experience.replace(/[^0-9\.]/g, ''))
    : null

  return { skills, education, summary, experience: Number.isFinite(experience) ? experience : null }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScoreCandidateRequest

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.candidate_profile || typeof body.candidate_profile !== 'object') {
      return NextResponse.json({ success: false, error: 'Missing candidate_profile' }, { status: 400 })
    }

    const requiredSkills = ensureStringArray(body.required_skills)
    if (requiredSkills.length === 0) {
      return NextResponse.json({ success: false, error: 'required_skills must be a non-empty array of strings' }, { status: 400 })
    }

    const scoreResult = await scoreCandidateWithGemini(body.candidate_profile, requiredSkills)
    const normalizedProfile = normalizeCandidateProfile(body.candidate_profile)

    const analysisPayload: any = {
      candidate_id: body.candidate_id || null,
      skills: normalizedProfile.skills,
      experience: normalizedProfile.experience,
      education: normalizedProfile.education,
      summary: normalizedProfile.summary,
      score: scoreResult.score,
      status: scoreResult.status,
      missing_skills: scoreResult.missing_skills,
    }

    try {
      await addCandidateAnalysis(analysisPayload)
    } catch (err: any) {
      console.error('/api/score-candidate DB save failed', err)
      return NextResponse.json({ success: false, error: 'Failed to persist score to Supabase' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: scoreResult }, { status: 200 })
  } catch (err: any) {
    console.error('/api/score-candidate error', err)
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
