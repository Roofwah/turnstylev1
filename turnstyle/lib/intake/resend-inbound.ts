import { Resend } from 'resend'
import { interpretCampaignBrief } from './interpret'
import { saveIntakeDraft } from './drafts'
import { sendIntakeReplyEmail } from './reply-email'

const resend = new Resend(process.env.RESEND_API_KEY)

export type ResendReceivedWebhook = {
  type: string
  created_at?: string
  data?: {
    email_id: string
    from: string
    to?: string[]
    subject?: string
    message_id?: string
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchReceivedEmailBody(emailId: string): Promise<{
  text: string
  subject: string
  from: string
  messageId?: string
}> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  type ReceivedEmail = {
    text?: string | null
    html?: string | null
    subject?: string
    from?: string
    message_id?: string
  }

  let data: ReceivedEmail | null = null
  let fetchError: string | undefined

  const receiving = (resend.emails as { receiving?: { get: (id: string) => Promise<{ data: ReceivedEmail | null; error: { message: string } | null }> } }).receiving
  if (receiving?.get) {
    const result = await receiving.get(emailId)
    data = result.data
    fetchError = result.error?.message
  } else {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      fetchError = `Resend API ${res.status}`
    } else {
      data = (await res.json()) as ReceivedEmail
    }
  }

  if (!data) {
    throw new Error(fetchError ?? 'Failed to fetch received email from Resend')
  }

  const text =
    (data.text && data.text.trim()) ||
    (data.html ? stripHtml(data.html) : '') ||
    ''

  return {
    text,
    subject: data.subject ?? '(no subject)',
    from: data.from ?? 'unknown',
    messageId: data.message_id ?? undefined,
  }
}

export function verifyResendWebhook(
  rawBody: string,
  headers: { id?: string | null; timestamp?: string | null; signature?: string | null }
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[intake/inbound] RESEND_WEBHOOK_SECRET not set — skipping webhook verification')
    return true
  }

  if (!headers.id || !headers.timestamp || !headers.signature) {
    console.error('[intake/inbound] Missing svix webhook headers')
    return false
  }

  try {
    resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: headers.id,
        timestamp: headers.timestamp,
        signature: headers.signature,
      },
      webhookSecret: secret,
    })
    return true
  } catch (e) {
    console.error('[intake/inbound] Webhook verification failed:', e)
    return false
  }
}

export async function processInboundResendEmail(emailId: string): Promise<{
  reviewToken: string
  reviewUrl: string
}> {
  const { text, subject, from, messageId } = await fetchReceivedEmailBody(emailId)

  const rawInput = [
    `From: ${from}`,
    `Subject: ${subject}`,
    '',
    text || '(empty body)',
  ].join('\n')

  const { intake, source } = await interpretCampaignBrief(text || rawInput)

  const { reviewToken } = await saveIntakeDraft({
    rawInput: text || rawInput,
    intake,
    source,
    fromEmail: from,
    subject,
    resendEmailId: emailId,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reviewUrl = `${appUrl}/dashboard/intake?token=${reviewToken}`

  await sendIntakeReplyEmail({
    to: from,
    subject: `Re: ${subject}`,
    intake,
    reviewUrl,
    inReplyTo: messageId,
  })

  return { reviewToken, reviewUrl }
}
