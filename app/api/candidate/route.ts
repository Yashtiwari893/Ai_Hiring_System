import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabaseClient'

type CandidatePayload = {
  name?: string
  email?: string
  phone?: string
  city?: string
  college?: string
  role?: string
  role_applied?: string
  position?: string
  resume_url?: string
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const body: CandidatePayload = await req.json()

    // Basic validation
    if (!body || !body.name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }
    if (body.email && !isValidEmail(body.email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (!body.resume_url) {
      return NextResponse.json({ error: 'Missing resume_url' }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()

    const insert = {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      city: body.city || null,
      college: body.college || null,
      role_applied: body.role || body.role_applied || body.position || null,
      resume_url: body.resume_url,
    }

    const { data, error } = await supabase.from('candidates').insert(insert).select().single()
    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, candidate: data }, { status: 201 })
  } catch (err: any) {
    console.error('API /api/candidate error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
