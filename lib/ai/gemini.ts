import { GoogleGenerativeAI } from '@google/generative-ai'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  return new GoogleGenerativeAI(apiKey)
}

export async function evaluateCandidateWithGemini(parsedJson: any, role: string) {
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

  const systemPrompt = `You are an expert technical recruiter. Given a parsed resume JSON and a target role, evaluate the candidate's fit and return ONLY a single valid JSON object (no markdown, no explanation) with keys:
- "match_score": integer between 0 and 100
- "ai_summary": a two-sentence concise summary explaining the score`

  const userPrompt = `Role: ${role}\n\nCandidate JSON:\n${JSON.stringify(parsedJson)}`

  const model = getClient().getGenerativeModel({ model: modelName })

  const response = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 512,
    },
  })

  let raw = ''
  try {
    raw = response.response.text()
  } catch (e) {
    raw = JSON.stringify(response)
  }

  // Strip markdown fences if present
  raw = raw.replace(/```json|```/g, '').trim()

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const jsonText = start !== -1 && end !== -1 ? raw.substring(start, end + 1) : raw

  try {
    const parsed = JSON.parse(jsonText)
    let score = parsed.match_score
    if (typeof score === 'string') score = parseFloat(score)
    if (typeof score !== 'number' || isNaN(score)) score = 0
    parsed.match_score = Math.max(0, Math.min(100, Math.round(score)))
    parsed.ai_summary = String(parsed.ai_summary || '')
    return parsed
  } catch (err) {
    throw new Error('Failed to parse Gemini response as JSON: ' + raw)
  }
}

export default { evaluateCandidateWithGemini }
