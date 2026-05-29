import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

function createSheetsClient() {
  if (!SERVICE_ACCOUNT_KEY) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured')
  const credentials = JSON.parse(SERVICE_ACCOUNT_KEY)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function appendCandidateRow(candidate: {
  id: string
  name: string
  email: string
  phone?: string
  city?: string
  college?: string
  role_applied: string
  status: string
  match_score?: number
  skills?: string[]
  experience_years?: number
  education?: string[]
  certifications?: string[]
  top_projects?: string[]
  ai_summary?: string
  resume_url?: string
}) {
  // Google Sheets is optional — skip gracefully if not configured
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_KEY) {
    console.warn('Google Sheets not configured, skipping sync')
    return
  }

  const sheets = createSheetsClient()
  const values = [
    candidate.id,
    candidate.name,
    candidate.email,
    candidate.phone || '',
    candidate.city || '',
    candidate.college || '',
    candidate.role_applied,
    candidate.status,
    String(candidate.match_score ?? ''),
    (candidate.skills || []).join(', '),
    String(candidate.experience_years ?? ''),
    (candidate.education || []).join(', '),
    (candidate.certifications || []).join(', '),
    (candidate.top_projects || []).join(', '),
    candidate.ai_summary || '',
    candidate.resume_url || '',
    new Date().toISOString(),
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Candidates!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}
