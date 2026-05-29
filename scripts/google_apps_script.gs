/**
 * Google Apps Script to forward Google Form submissions to Next.js API
 * Usage:
 *  - Set `API_ENDPOINT` to your deployed Next.js `/api/candidate` endpoint
 *  - Install an onFormSubmit trigger for `onFormSubmit` (see createOnFormSubmitTrigger)
 */

const API_ENDPOINT = 'https://ai-hiring-system-chi.vercel.app/api/process-application' // <-- set this
const FORM_ID = '11Hlobrhbs8igpsu3B8ZvJ84ikLlHn-9zgLbZirHd4kU' // optional, used by createOnFormSubmitTrigger

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

    const payload = {
      name,
      email,
      phone,
      city,
      college,
      role_applied: role,
      resume_url: resumeUrl,
    }

    Logger.log('Final payload: ' + JSON.stringify(payload))

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
