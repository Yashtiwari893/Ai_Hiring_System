/**
 * Google Apps Script to forward Google Form submissions to Next.js API
 * Usage:
 *  - Set `API_ENDPOINT` to your deployed Next.js `/api/candidate` endpoint
 *  - Install an onFormSubmit trigger for `onFormSubmit` (see createOnFormSubmitTrigger)
 */

const API_ENDPOINT = 'https://ai-hiring-system-chi.vercel.app/api/process-application' // <-- set this
const FORM_ID = '11Hlobrhbs8igpsu3B8ZvJ84ikLlHn-9zgLbZirHd4kU' // optional, used by createOnFormSubmitTrigger

function getDriveFileId(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('drive.google.com')) {
      const idFromParam = parsed.searchParams.get('id')
      if (idFromParam) return idFromParam
      const match = parsed.pathname.match(/\/file\/d\/([^\/]+)/)
      if (match) return match[1]
    }
  } catch (err) {
    return null
  }
  return null
}

function getDriveFileBase64(fileId) {
  const file = DriveApp.getFileById(fileId)
  const blob = file.getBlob()
  return {
    resume_base64: Utilities.base64Encode(blob.getBytes()),
    resume_filename: file.getName(),
  }
}

function onFormSubmit(e) {
  try {
    const nv = e.namedValues || {}
    Logger.log('namedValues keys: ' + Object.keys(nv).join(', '))
    Logger.log('namedValues raw: ' + JSON.stringify(nv))

    const normalized = {}
    Object.keys(nv).forEach((key) => {
      normalized[key.trim().toLowerCase()] = nv[key] && nv[key].length ? nv[key][0] : ''
    })

    const name = normalized['name'] || ''
    const email = normalized['email'] || ''
    const phone = normalized['phone number'] || normalized['phone'] || ''
    const city = normalized['city'] || ''
    const college = normalized['college/university'] || normalized['college'] || ''
    const role = normalized['position applied for'] || normalized['role applied for'] || normalized['role'] || ''
    const resumeUrl = normalized['resume or cv'] || normalized['resume'] || ''

    let resume_base64 = ''
    let resume_filename = ''
    const driveId = getDriveFileId(resumeUrl)
    Logger.log('Resolved Drive ID: ' + driveId)
    if (driveId) {
      try {
        const driveFile = getDriveFileBase64(driveId)
        resume_base64 = driveFile.resume_base64
        resume_filename = driveFile.resume_filename
        Logger.log('Loaded Drive file content for upload: ' + resume_filename)
      } catch (error) {
        Logger.log('Failed to load Drive file content: ' + error)
        if (error && error.message) Logger.log('Drive error message: ' + error.message)
        if (error && error.stack) Logger.log('Drive error stack: ' + error.stack)
      }
    } else {
      Logger.log('No Drive ID could be parsed from resume URL')
    }

    const payload = {
      name,
      email,
      phone,
      city,
      college,
      role_applied: role,
      resume_url: resumeUrl,
      resume_base64,
      resume_filename,
    }

    Logger.log('Final payload: ' + JSON.stringify({
      ...payload,
      resume_base64: resume_base64 ? '[BASE64]' : '',
    }))

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }

    const resp = UrlFetchApp.fetch(API_ENDPOINT, options)
    Logger.log('Posted to API: %s -> %s', API_ENDPOINT, resp.getResponseCode())
    Logger.log('API response body: %s', resp.getContentText())
  } catch (err) {
    Logger.log('Error in onFormSubmit: ' + err)
  }
}

// Helper to create a trigger programmatically (run once manually)
function createOnFormSubmitTrigger() {
  if (!FORM_ID) throw new Error('Set FORM_ID constant in script')
  const form = FormApp.openById(FORM_ID)
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create()
  Logger.log('Trigger created for form: ' + FORM_ID)
}

function authorizeDriveAccess() {
  try {
    const root = DriveApp.getRootFolder()
    Logger.log('Drive authorized. Root folder: ' + root.getName())
  } catch (err) {
    Logger.log('Drive authorization failed: ' + err)
  }
}
