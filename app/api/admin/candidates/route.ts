import { NextResponse, type NextRequest } from 'next/server'
import { fetchCandidates } from '@/lib/db/helpers'

const VALID_FILTERS = ['All', 'Shortlisted', 'Manual Review', 'Rejected']

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page') || '1')
    const limit = Number(url.searchParams.get('limit') || '10')
    const filter = url.searchParams.get('filter') || 'All'
    const search = url.searchParams.get('search') || ''

    if (page < 1 || Number.isNaN(page)) {
      return NextResponse.json({ ok: false, error: 'Invalid page value' }, { status: 400 })
    }

    if (limit < 1 || limit > 50 || Number.isNaN(limit)) {
      return NextResponse.json({ ok: false, error: 'Invalid limit value' }, { status: 400 })
    }

    const status = VALID_FILTERS.includes(filter) && filter !== 'All' ? filter : undefined
    const pageData = await fetchCandidates({ page, limit, status, search })

    return NextResponse.json({ ok: true, ...pageData }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/candidates error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch candidates' }, { status: 500 })
  }
}
