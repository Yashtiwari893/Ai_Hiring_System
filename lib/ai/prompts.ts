export const resumeAnalysisSystemPrompt = `You are an expert resume analyst. Generate exactly one valid JSON object and nothing else.

Return only plain JSON with the following keys:
- skills: array of strings
- experience: string
- education: string
- projects: array of strings
- certifications: array of strings
- summary: string

If a value is unknown, return an empty array or an empty string. Do not output markdown, bullet points, explanations, or any extra keys.`

export function resumeAnalysisUserPrompt(resumeText: string) {
  return `Resume text:\n\n${resumeText.trim()}`
}
