import { GoogleGenerativeAI } from '@google/generative-ai'
import { resumeAnalysisSystemPrompt, resumeAnalysisUserPrompt } from './prompts'

export type ResumeAnalysis = {
  skills: string[]
  experience: string
  education: string
  projects: string[]
  certifications: string[]
  summary: string
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY must be configured')
  return new GoogleGenerativeAI(apiKey)
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  const model = getGeminiClient().getGenerativeModel({ model: modelName })

  const response = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${resumeAnalysisSystemPrompt}\n\n${resumeAnalysisUserPrompt(resumeText)}` }],
      },
    ],
    generationConfig: { temperature: 0.0, maxOutputTokens: 1024 },
  })

  let raw = ''
  try {
    raw = response.response.text()
  } catch {
    raw = JSON.stringify(response)
  }

  raw = raw.replace(/```json|```/g, '').trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  const jsonText = start !== -1 && end !== -1 ? raw.substring(start, end + 1) : raw

  try {
    return JSON.parse(jsonText) as ResumeAnalysis
  } catch {
    throw new Error('Failed to parse resume analysis JSON: ' + raw)
  }
}
