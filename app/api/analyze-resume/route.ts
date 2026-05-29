import { NextResponse, type NextRequest } from 'next/server'
import { analyzeResumeWithGemini, type ResumeAnalysis } from '../../../lib/ai/resumeAnalysis'
import { addCandidateAnalysis } from '../../../lib/db/helpers'

type AnalyzeResumeRequest = {
  resume_text: string
  candidate_id?: string
}

function parseExperienceToNumber(experience: string): number | null {
  if (!experience || typeof experience !== 'string') return null
  const trimmed = experience.trim()
  const numericMatch = trimmed.match(/\d+(?:[\.,]\d+)?/)
  if (!numericMatch) return null
  const normalized = numericMatch[0].replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeResumeRequest

    if (!body?.resume_text || typeof body.resume_text !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing resume_text' }, { status: 400 })
    }

    const analysis: ResumeAnalysis = await analyzeResumeWithGemini(body.resume_text)

    const candidateAnalysisRecord: any = {
      skills: analysis.skills,
      experience: parseExperienceToNumber(analysis.experience),
      education: analysis.education ? [analysis.education] : [],
      summary: analysis.summary,
      score: null,
      status: 'analyzed',
      missing_skills: [],
    }

    if (body.candidate_id) {
      candidateAnalysisRecord.candidate_id = body.candidate_id
    }

    try {
      await addCandidateAnalysis(candidateAnalysisRecord)
    } catch (err: any) {
      console.error('/api/analyze-resume DB save failed', err)
      return NextResponse.json({ success: false, error: 'Failed to persist analysis' }, { status: 500 })
    }

    return NextResponse.json({ success: true, analysis }, { status: 200 })
  } catch (err: any) {
    const message = err?.message ? String(err.message) : 'Internal server error'
    console.error('/api/analyze-resume error', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
