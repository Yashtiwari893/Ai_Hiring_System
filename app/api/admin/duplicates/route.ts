import { NextResponse, type NextRequest } from 'next/server'
import { findDuplicateCandidates, getDuplicateCandidates } from '@/lib/db/helpers'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const email = url.searchParams.get('email') || undefined
    const phone = url.searchParams.get('phone') || undefined

    const duplicates = email || phone
      ? await findDuplicateCandidates({ email, phone })
      : await getDuplicateCandidates()

    return NextResponse.json({ ok: true, duplicates }, { status: 200 })
  } catch (err: any) {
    console.error('/api/admin/duplicates error', err)
    return NextResponse.json({ ok: false, error: err.message || 'Unable to fetch duplicate candidates' }, { status: 500 })
  }
}
