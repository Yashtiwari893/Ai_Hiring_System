import { NextResponse, type NextRequest } from 'next/server'
import { addCandidateNote, listCandidateNotes } from '@/lib/db/helpers'

type NoteRequest = {
  candidate_id: string
  author: string
  note: string
  category?: string
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const candidate_id = url.searchParams.get('candidate_id')
    if (!candidate_id) {
      return NextResponse.json({ ok: false, error: 'candidate_id is required' }, { status: 400 })
    }

    const notes = await listCandidateNotes(candidate_id)
    return NextResponse.json({ ok: true, notes }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/candidate-notes error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch notes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NoteRequest
    if (!body?.candidate_id || !body?.author || !body?.note) {
      return NextResponse.json({ ok: false, error: 'candidate_id, author, and note are required' }, { status: 400 })
    }

    const note = await addCandidateNote({
      candidate_id: body.candidate_id,
      author: body.author,
      note: body.note,
      category: body.category || 'general',
    })

    return NextResponse.json({ ok: true, note }, { status: 201 })
  } catch (err: any) {
    console.error('/api/admin/candidate-notes POST error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to create note' }, { status: 500 })
  }
}
