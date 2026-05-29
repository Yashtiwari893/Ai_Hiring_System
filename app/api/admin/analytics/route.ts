import { NextResponse, type NextRequest } from 'next/server'
import { getRecruiterAnalytics } from '@/lib/db/helpers'

export async function GET(req: NextRequest) {
  try {
    const analytics = await getRecruiterAnalytics()
    return NextResponse.json({ ok: true, analytics }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/analytics error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch analytics' }, { status: 500 })
  }
}
