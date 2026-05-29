import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabaseClient'
import { PDFParse } from 'pdf-parse'

type ParseRequest = { resume_url: string; candidate_id?: string }

function cleanExtractedText(input: string) {
  if (!input) return ''
  // Normalize whitespace, remove non-printable chars
  let s = input.replace(/\r/g, '\n')
  s = s.replace(/\n{2,}/g, '\n\n')
  s = s.replace(/[\t\u0000-\u001F\u007F]/g, ' ')
  s = s.replace(/ {2,}/g, ' ')
  s = s.trim()
  return s
}

async function fetchPdfBuffer(url: string, maxBytes = 10 * 1024 * 1024): Promise<Buffer> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status} ${resp.statusText}`)

  const contentType = resp.headers.get('content-type') || ''
  if (!contentType.includes('pdf') && !contentType.includes('application/octet-stream')) {
    // Not strictly required but helpful to catch obvious non-PDF
    throw new Error(`URL does not appear to be a PDF (content-type: ${contentType})`)
  }

  const ab = await resp.arrayBuffer()
  if (ab.byteLength === 0) throw new Error('Downloaded file is empty')
  if (ab.byteLength > maxBytes) throw new Error('PDF too large')

  return Buffer.from(ab)
}

export async function POST(req: NextRequest) {
  try {
    const body: ParseRequest = await req.json()

    if (!body || !body.resume_url) {
      return NextResponse.json({ success: false, error: 'Missing resume_url' }, { status: 400 })
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await fetchPdfBuffer(body.resume_url)
    } catch (err: any) {
      console.error('Error fetching PDF:', err)
      return NextResponse.json({ success: false, error: 'Failed to download PDF: ' + err.message }, { status: 400 })
    }

    let parsed: any
    let parser: PDFParse | null = null
    try {
      parser = new PDFParse({ data: pdfBuffer as any })
      parsed = await parser.getText()
    } catch (err: any) {
      console.error('pdf-parse error:', err)
      return NextResponse.json({ success: false, error: 'Invalid or corrupted PDF' }, { status: 422 })
    } finally {
      if (parser) {
        await parser.destroy()
      }
    }

    const rawText = (parsed && parsed.text) ? String(parsed.text) : ''
    const cleaned = cleanExtractedText(rawText)

    // Save raw text to DB in candidate_analysis.summary (candidate_id may be null)
    try {
      const supabase = getSupabaseAdminClient()
      const insert = {
        candidate_id: body.candidate_id || null,
        skills: [] as any,
        experience: null,
        education: [] as any,
        summary: cleaned,
        score: null,
        status: 'parsed_raw',
        missing_skills: [] as any,
      }
      const { data, error } = await supabase.from('candidate_analysis').insert(insert).select().single()
      if (error) {
        console.error('Failed to save parsed text:', error)
      } else {
        console.log('Saved parsed text record id:', data?.id)
      }
    } catch (err) {
      console.error('DB save error:', err)
    }

    return NextResponse.json({ success: true, extractedText: cleaned }, { status: 200 })
  } catch (err: any) {
    console.error('/api/parse-resume unexpected error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 })
  }
}
