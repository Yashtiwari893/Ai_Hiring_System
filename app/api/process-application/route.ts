import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateCandidateWithGemini } from '../../../lib/ai/gemini'
import { analyzeResumeWithMistral } from '../../../lib/ai/mistral'
import { sendEmail } from '../../../lib/email/send'
import { appendCandidateRow } from '../../../lib/googleSheets'
import Groq from 'groq-sdk'

type RequestBody = {
  name: string
  email: string
  phone?: string
  city?: string
  college?: string
  role_applied: string
  resume_url: string
}

function normalizeResumeUrl(url: string): string {
  try {
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

async function fetchPdfBuffer(url: string): Promise<ArrayBuffer> {
  const normalizedUrl = normalizeResumeUrl(url)
  const res = await fetch(normalizedUrl, {
    headers: {
      Accept: 'application/pdf,*/*;q=0.9',
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText} from ${normalizedUrl}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('pdf')) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(`Expected PDF, got ${contentType}. Response body snippet: ${bodyText.slice(0, 200)}`)
  }

  return await res.arrayBuffer()
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // Use pdf-parse for server-side PDF text extraction
  const pdfParseModule = await import('pdf-parse')
  const pdfParse = (pdfParseModule as any).default || pdfParseModule
  const data = await pdfParse(Buffer.from(buffer))
  return data.text || ''
}

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured')
  return new Groq({ apiKey })
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(supabaseUrl, supabaseKey)
}

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30000)

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
    const { name, email, phone, city, college, role_applied, resume_url } = body

    if (!name || !email || !role_applied || !resume_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Insert initial candidate record, or reuse existing candidate if email already exists
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
          console.error('Duplicate email found but could not retrieve existing candidate', findErr, initErr)
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
      console.error('Candidate ID missing after insert or lookup')
      return new Response(JSON.stringify({ error: 'Failed to create candidate record' }), { status: 500 })
    }

    // Step 1: Fetch PDF and extract text
    let pdfBuffer: ArrayBuffer
    try {
      pdfBuffer = await fetchPdfBuffer(resume_url)
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Fetch PDF', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to fetch PDF' }), { status: 500 })
    }

    let resumeText: string
    try {
      resumeText = await extractTextFromPdf(pdfBuffer)
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'PDF Extraction', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to extract PDF text' }), { status: 500 })
    }

    // Step 2: Parse resume with Groq
    const systemPrompt = `You are a strict JSON generator. Given a resume text, output ONLY one valid JSON object with these exact keys:
- "skills": array of strings
- "experience_years": number
- "education": array of strings
- "certifications": array of strings
- "top_projects": array of strings
- "role_relevance": concise string summary of candidate fit for the applied role
- "fake_resume_risk": one of "low", "medium", "high"
- "summary": brief two-sentence candidate summary
If a value is unknown, return empty array, empty string, or 0. No markdown, no explanation, no extra keys.`

    let message: any
    try {
      message = await runWithTimeout(
        getGroqClient().chat.completions.create({
          model: process.env.GROQ_MODEL || 'llama3-8b-8192',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Resume:\n\n${resumeText}` },
          ],
          max_tokens: 1024,
          temperature: 0.0,
        }),
        LLM_TIMEOUT_MS,
        'Groq Parsing'
      )
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Groq Parsing', error_message: String(err?.message || err) }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed at Groq Parsing' }), { status: 500 })
    }

    const rawGroq = message?.choices?.[0]?.message?.content || ''
    let parsed: any = null
    try {
      const clean = rawGroq.replace(/```json|```/g, '').trim()
      const jsonStart = clean.indexOf('{')
      const jsonEnd = clean.lastIndexOf('}')
      const jsonText = jsonStart !== -1 && jsonEnd !== -1 ? clean.substring(jsonStart, jsonEnd + 1) : clean
      parsed = JSON.parse(jsonText)
    } catch (err: any) {
      await getSupabase().from('candidates').update({ status: 'Pending', error_step: 'Groq JSON Parse', error_message: String(err?.message || err), ai_summary: rawGroq }).eq('id', candidateId)
      return new Response(JSON.stringify({ error: 'Failed to parse Groq JSON response' }), { status: 500 })
    }

    // Step 3: Score with Gemini
    let geminiResult: any
    try {
      geminiResult = await runWithTimeout(evaluateCandidateWithGemini(parsed, role_applied), LLM_TIMEOUT_MS, 'Gemini Evaluation')
    } catch (err: any) {
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

    // Step 4: Sync to Google Sheets (optional)
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

    // Step 5: Send email (shortlisted or rejected)
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
