import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeResumeWithMistral } from '../../../lib/ai/mistral'
import { sendEmail } from '../../../lib/email/send'
import { appendCandidateRow } from '../../../lib/googleSheets'
// Replaced Groq with Gemini-based parsing/scoring
import { analyzeResume } from '../../../lib/ai/resumeAnalysis'
import { evaluateCandidateWithGemini } from '../../../lib/ai/gemini'

type RequestBody = {
  name: string
  email: string
  phone?: string
  city?: string
  college?: string
  role_applied: string
  resume_url?: string
  resume_base64?: string
  resume_filename?: string
}

function normalizeResumeUrl(url: string): string {
  try {
    // Use WHATWG URL API (fixes DEP0169 warning)
    const parsed = new URL(url)
    if (parsed.hostname.includes('drive.google.com')) {
      const fileId = parsed.searchParams.get('id')
      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`
      }
      const match = parsed.pathname.match(/\/file\/d\/([^\/]+)/)
      if (match) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`
      }
    }
  } catch {
    // ignore invalid URL and use original value
  }
  return url
}

async function fetchPdfBuffer(url: string): Promise<Buffer> {
  const normalizedUrl = normalizeResumeUrl(url)
  const res = await fetch(normalizedUrl, {
    headers: { Accept: 'application/pdf,*/*;q=0.9' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText} from ${normalizedUrl}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('pdf')) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(`Expected PDF, got ${contentType}. Body: ${bodyText.slice(0, 200)}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  // Use Buffer.from() instead of deprecated Buffer() constructor (fixes DEP0005)
  return Buffer.from(arrayBuffer)
}

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
  const pdfParse = (pdfParseModule as any).default || pdfParseModule
  const data = await pdfParse(buf)
  return data.text || ''
}

// Groq removed — using Gemini via lib/ai/resumeAnalysis.ts and lib/ai/gemini.ts

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(supabaseUrl, supabaseKey)
}

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 45000)

async function runWithTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout]) as T
  } finally {
    clearTimeout(timer!)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const { name, email, phone, city, college, role_applied, resume_url, resume_base64, resume_filename } = body

    if (!name || !email || !role_applied || (!resume_url && !resume_base64)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Insert initial candidate record
    let candidateId: string | null = null

    const { data: initialData, error: initErr } = await getSupabase()
      .from('candidates')
      .insert([{ name, email, phone, city, college, role_applied, resume_url, status: 'Processing' }])
      .select()
      .single()

    if (initErr) {
      if (initErr.code === '23505') {
        const { data: existingCandidate, error: findErr } = await getSupabase()
          .from('candidates')
          .select('id')
          .eq('email', email)
          .single()

        if (findErr || !existingCandidate?.id) {
          console.error('Duplicate email but could not retrieve existing candidate', findErr, initErr)
          return new Response(JSON.stringify({ error: 'Failed to create candidate record' }), { status: 500 })
        }

        candidateId = existingCandidate.id
        await getSupabase()
          .from('candidates')
          .update({ phone, city, college, role_applied, resume_url, status: 'Processing' })
          .eq('id', candidateId)
      } else {
        console.error('Failed to create initial candidate record', initErr)
        return new Response(JSON.stringify({ error: 'Failed to create candidate record' }), { status: 500 })
      }
    } else {
      candidateId = initialData?.id ?? null
    }

    if (!candidateId) {
      return new Response(JSON.stringify({ error: 'Failed to create candidate record' }), { status: 500 })
    }

    // Step 1: Decode or fetch resume → Buffer
    let pdfBuffer: Buffer
    try {
      if (resume_base64) {
        // FIX: Use Buffer.from() directly — clean and no deprecated constructor
        pdfBuffer = Buffer.from(resume_base64, 'base64')
        console.log(`Decoded base64 resume: ${pdfBuffer.length} bytes`)
      } else {
        pdfBuffer = await fetchPdfBuffer(resume_url!)
        console.log(`Fetched PDF from URL: ${pdfBuffer.length} bytes`)
      }
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Fetch PDF', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to fetch PDF' }), { status: 500 })
    }

    // Step 2: Extract text from PDF
    let resumeText: string
    try {
      resumeText = await extractTextFromPdf(pdfBuffer)
      console.log(`Extracted resume text: ${resumeText.length} chars`)
      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error('Extracted text is too short — PDF may be image-based or corrupted')
      }
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'PDF Extraction', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to extract PDF text' }), { status: 500 })
    }

    // Step 3: Parse resume with Gemini (using analyzeResume)
    // Trim resume text to avoid token limit issues
    const trimmedResumeText = resumeText.slice(0, 6000)

    let parsed: any = null
    try {
      const analysis = await runWithTimeout(analyzeResume(trimmedResumeText), LLM_TIMEOUT_MS, 'Gemini Resume Analysis')
      // Map analyzeResume output to the expected parsed schema
      // analyzeResume returns: { skills, experience, education, projects, certifications, summary }
      const experienceYearsRaw = String(analysis.experience || '')
      const yearsMatch = experienceYearsRaw.match(/(\d+(?:\.\d+)?)/)
      const experience_years = yearsMatch ? Number(yearsMatch[1]) : 0

      parsed = {
        skills: Array.isArray(analysis.skills) ? analysis.skills : [],
        experience_years,
        education: Array.isArray(analysis.education) ? analysis.education : (analysis.education ? [analysis.education] : []),
        certifications: Array.isArray(analysis.certifications) ? analysis.certifications : [],
        top_projects: Array.isArray(analysis.projects) ? analysis.projects : [],
        role_relevance: analysis.summary || '',
        fake_resume_risk: 'low',
        summary: analysis.summary || '',
      }
    } catch (err: any) {
      console.error('Gemini resume analysis error:', err?.message || err)
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Resume Analysis', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to analyze resume' }), { status: 500 })
    }

    // Step 4: Score with Gemini
    let geminiResult: any
    try {
      geminiResult = await runWithTimeout(evaluateCandidateWithGemini(parsed, role_applied), LLM_TIMEOUT_MS, 'Gemini Evaluation')
    } catch (err: any) {
      console.error('Gemini error:', err?.message || err)
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Gemini Evaluation', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed at Gemini Evaluation' }), { status: 500 })
    }

    const match_score = typeof geminiResult.match_score === 'number' ? Math.round(geminiResult.match_score) : 0
    const ai_summary = String(geminiResult.ai_summary || parsed.summary || '')
    const role_relevance = String(parsed.role_relevance || '')

    let status = 'Pending'
    if (match_score >= 80) status = 'Shortlisted'
    else if (match_score >= 50) status = 'Manual Review'
    else status = 'Rejected'

    if (parsed.fake_resume_risk === 'high' && status !== 'Rejected') {
      status = 'Manual Review'
    }

    const { data, error } = await getSupabase()
      .from('candidates')
      .update({ city, college, parsed_json: parsed, match_score, role_relevance, ai_summary, status, resume_text: resumeText })
      .eq('id', candidateId)
      .select()
      .single()

    if (error) {
      await getSupabase().from('candidates').update({ error_step: 'Supabase Update', error_message: String(error.message), status: 'Pending' }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to update candidate' }), { status: 500 })
    }

    // Step 5: Sync to Google Sheets (optional)
    let sheetSynced = false
    try {
      await appendCandidateRow({
        id: candidateId, name, email, phone, city, college, role_applied, status, match_score,
        skills: parsed.skills || [], experience_years: parsed.experience_years || 0,
        education: parsed.education || [], certifications: parsed.certifications || [],
        top_projects: parsed.top_projects || [], ai_summary, resume_url,
      })
      sheetSynced = true
      await getSupabase().from('candidates').update({ sheet_synced: true }).eq('id', candidateId)
    } catch (err: any) {
      await getSupabase().from('candidates').update({ sheet_sync_error: String(err?.message || err) }).eq('id', candidateId)
    }

    // Step 6: Send email (shortlisted or rejected)
    let emailSent = false
    if (status === 'Shortlisted' || status === 'Rejected') {
      try {
        const mention = parsed.top_projects?.[0] || parsed.skills?.[0] || ''
        const mistralPrompt = status === 'Shortlisted'
          ? `Write a warm, professional interview invitation email. Candidate name: ${name}, role: ${role_applied}, city: ${city || 'your city'}. Skill or project to mention: ${mention}. Be concise and next-step oriented. Output valid JSON only with keys: subject, html_body. No extra text.`
          : `Write a polite rejection email. Candidate name: ${name}, role: ${role_applied}. Skill to mention: ${mention}. Be empathetic and constructive. Output valid JSON only with keys: subject, html_body. No extra text.`

        const mistralResp = await runWithTimeout(analyzeResumeWithMistral(mistralPrompt), LLM_TIMEOUT_MS, 'Mistral Email')
        let emailObj: any = null
        try {
          const clean = mistralResp.replace(/```json|```/g, '').trim()
          const s = clean.indexOf('{')
          const e2 = clean.lastIndexOf('}')
          emailObj = JSON.parse(s !== -1 && e2 !== -1 ? clean.substring(s, e2 + 1) : clean)
        } catch {
          emailObj = {
            subject: status === 'Shortlisted' ? `Interview invitation — ${role_applied}` : `Your application for ${role_applied}`,
            html_body: `<p>${mistralResp}</p>`,
          }
        }

        await sendEmail(email, emailObj.subject, emailObj.html_body)
        emailSent = true
        await getSupabase().from('candidates').update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq('id', candidateId)
      } catch (err: any) {
        await getSupabase().from('candidates').update({ email_sent: false, email_error: String(err?.message || err) }).eq('id', candidateId)
      }
    }

    return new Response(
      JSON.stringify({ success: true, candidate: data, parsed, gemini: geminiResult, emailSent, sheetSynced }),
      { status: 200 }
    )
  } catch (err: any) {
    console.error('Processing error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500 })
  }
}