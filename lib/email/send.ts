import { Resend } from 'resend'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(apiKey)
}

export async function sendEmail(to: string, subject: string, html: string) {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) throw new Error('RESEND_FROM_EMAIL is not configured')

  const resend = getResendClient()
  const res = await resend.emails.send({ from, to, subject, html })
  return res
}

export default { sendEmail }
