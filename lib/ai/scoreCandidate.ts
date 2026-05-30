import Groq from 'groq-sdk'

export type CandidateProfile = {
  name?: string
  email?: string
  phone?: string
  city?: string
  college?: string
  role?: string
  skills?: string[] | string
  experience?: string | number
  education?: string[] | string
  certifications?: string[] | string
  projects?: string[] | string
  summary?: string
  [key: string]: unknown
}

export type CandidateScore = {
  score: number
  status: 'Shortlisted' | 'Manual Review' | 'Rejected'
  reason: string
  missing_skills: string[]
}

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b'
const MAX_RETRIES = Number(process.env.GROQ_RETRY_ATTEMPTS ?? 3)
const BASE_RETRY_DELAY_MS = Number(process.env.GROQ_RETRY_BASE_DELAY_MS ?? 500)
const DEFAULT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 30000)

if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY must be configured for candidate scoring')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getGroqClient() {
  return new Groq({ apiKey: GROQ_API_KEY })
}

function extractRawText(response: any): string {
  if (!response) return ''
  if (typeof response?.text === 'string') return response.text
  if (typeof response?.outputText === 'string') return response.outputText
  if (Array.isArray(response?.content)) {
    return response.content.map((item: any) => String(item?.text || item?.content || '')).join('\n')
  }
  if (typeof response?.response?.text === 'function') {
    return String(response.response.text())
  }
  return JSON.stringify(response)
}

function extractJson(raw: string): string {
  const trimmed = raw.trim()
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.substring(first, last + 1)
  }
  return trimmed
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function normalizeScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)))
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)))
    }
  }
  return 0
}

function normalizeStatus(value: unknown, score: number): CandidateScore['status'] {
  const normalized = typeof value === 'string' ? value.trim() : ''
  const allowed = ['Shortlisted', 'Manual Review', 'Rejected']
  if (allowed.includes(normalized)) {
    return normalized as CandidateScore['status']
  }
  if (score >= 80) return 'Shortlisted'
  if (score >= 50) return 'Manual Review'
  return 'Rejected'
}

function normalizeReason(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  return ''
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Groq scoring request timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer!)
  }
}

async function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === attempts - 1) break
      const delay = BASE_RETRY_DELAY_MS * 2 ** attempt
      await sleep(delay)
    }
  }
  throw lastError
}

export async function scoreCandidateWithGroq(
  candidateProfile: CandidateProfile,
  requiredSkills: string[]
): Promise<CandidateScore> {
  if (!candidateProfile || typeof candidateProfile !== 'object') {
    throw new Error('candidateProfile must be an object')
  }
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    throw new Error('requiredSkills must be a non-empty array of strings')
  }

  const systemPrompt = `You are an expert recruiter scoring candidates against required skills. Return exactly one valid JSON object and nothing else.
The JSON must contain these keys:
- "score": integer between 0 and 100
- "status": "Shortlisted", "Manual Review", or "Rejected"
- "reason": a short objective sentence explaining the score
- "missing_skills": array of missing required skill strings

Use the following score thresholds:
- 80 or above => Shortlisted
- 50 to 79 => Manual Review
- Below 50 => Rejected

If a value is unknown, return an empty string or empty array. No markdown, no extra keys, no explanation.`

  const userPrompt = `Job roles examples:
- Node.js Developer: Node.js, MongoDB, Express, REST API, Git
- Frontend Developer: React, Next.js, JavaScript, Tailwind CSS

Candidate Profile:
${JSON.stringify(candidateProfile, null, 2)}

Required Skills:
${requiredSkills.join(', ')}

Evaluate the candidate's fit for the required skills and return only the JSON object described above.`

  const message = await retry(async () => {
    return await runWithTimeout(
      ((getGroqClient() as any).messages.create)({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 256,
        temperature: 0.0,
      }),
      DEFAULT_TIMEOUT_MS
    )
  }, MAX_RETRIES)

  const raw = extractRawText(message)
  const jsonText = extractJson(raw)

  let parsed: any
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new Error(`Invalid JSON from Groq scoring response: ${raw}`)
  }

  const score = normalizeScore(parsed.score)
  const status = normalizeStatus(parsed.status, score)
  const reason = normalizeReason(parsed.reason)
  const missing_skills = normalizeStringArray(parsed.missing_skills)

  return { score, status, reason, missing_skills }
}
