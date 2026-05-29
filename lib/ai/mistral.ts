// Mistral AI API wrapper (fetch-based, OpenAI-compatible endpoint)
// Usage: server-side only

const MISTRAL_API_URL = 'https://api.mistral.ai'
const DEFAULT_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest'

export async function analyzeResumeWithMistral(
  prompt: string,
  options?: { model?: string; max_tokens?: number; temperature?: number }
): Promise<string> {
  const model = options?.model || DEFAULT_MODEL
  const max_tokens = options?.max_tokens ?? 1024
  const temperature = options?.temperature ?? 0.2

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured')

  const res = await fetch(`${MISTRAL_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens,
      temperature,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mistral API error: ${res.status} ${res.statusText} ${text}`)
  }

  const data = await res.json()

  if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
    return data.choices[0].message.content
  }

  return JSON.stringify(data)
}

export default { analyzeResumeWithMistral }
