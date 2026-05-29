/**
 * Google Apps Script to forward Google Form submissions to Next.js API
 * Usage:
 *  - Set `API_ENDPOINT` to your deployed Next.js `/api/candidate` endpoint
 *  - Install an onFormSubmit trigger for `onFormSubmit` (see createOnFormSubmitTrigger)
 */

const API_ENDPOINT = 'https://your-nextjs-site.com/api/candidate' // <-- set this
const FORM_ID = 'YOUR_GOOGLE_FORM_ID' // optional, used by createOnFormSubmitTrigger

function onFormSubmit(e) {
  try {
    // e.namedValues is a map of question -> [answers]
    const nv = e.namedValues || {}

    // Adjust keys to match your form question titles
    const name = (nv['Name'] || nv['Full Name'] || [''])[0]
    const email = (nv['Email'] || [''])[0]
    const phone = (nv['Phone'] || nv['Phone Number'] || [''])[0]
    const city = (nv['City'] || [''])[0]
    const college = (nv['College'] || [''])[0]
    const role = (nv['Role Applied'] || nv['Role Applied For'] || [''])[0]

    // File upload responses normally provide a Drive URL in the cell value
    let resumeUrl = ''
    if (nv['Resume'] && nv['Resume'].length) {
      resumeUrl = nv['Resume'][0]
    } else if (nv['Resume Upload'] && nv['Resume Upload'].length) {
      resumeUrl = nv['Resume Upload'][0]
    }

    const payload = {
      name,
      email,
      phone,
      city,
      college,
      role,
      resume_url: resumeUrl,
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }

    const resp = UrlFetchApp.fetch(API_ENDPOINT, options)
    Logger.log('Posted to API: %s -> %s', API_ENDPOINT, resp.getResponseCode())
    if (resp.getResponseCode() >= 400) {
      Logger.log('API response: %s', resp.getContentText())
    }
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
