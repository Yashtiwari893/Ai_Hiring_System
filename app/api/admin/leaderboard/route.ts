import { NextResponse, type NextRequest } from 'next/server'
import { getTopCandidates } from '@/lib/db/helpers'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') || '10')
    const topCandidates = await getTopCandidates(Math.min(20, Math.max(5, limit)))
    return NextResponse.json({ ok: true, topCandidates }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/leaderboard error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch leaderboard' }, { status: 500 })
  }
}
