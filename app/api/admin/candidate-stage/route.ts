import { NextResponse, type NextRequest } from 'next/server'
import { addInterviewStage, listInterviewStages, updateCandidateStage } from '@/lib/db/helpers'

type StageRequest = {
  candidate_id: string
  stage: string
  comments?: string
  updated_by?: string
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const candidate_id = url.searchParams.get('candidate_id')
    if (!candidate_id) {
      return NextResponse.json({ ok: false, error: 'candidate_id is required' }, { status: 400 })
    }

    const stages = await listInterviewStages(candidate_id)
    return NextResponse.json({ ok: true, stages }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/candidate-stage error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch stages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StageRequest
    if (!body?.candidate_id || !body?.stage) {
      return NextResponse.json({ ok: false, error: 'candidate_id and stage are required' }, { status: 400 })
    }

    const stage = await updateCandidateStage({
      candidate_id: body.candidate_id,
      stage: body.stage,
      comments: body.comments ?? undefined,
      updated_by: body.updated_by || 'recruiter',
    })

    return NextResponse.json({ ok: true, stage }, { status: 201 })
  } catch (err: any) {
    console.error('/api/admin/candidate-stage POST error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to update stage' }, { status: 500 })
  }
}
