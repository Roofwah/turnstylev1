import { NextRequest, NextResponse } from 'next/server'
import {
  processInboundResendEmail,
  verifyResendWebhook,
  type ResendReceivedWebhook,
} from '@/lib/intake/resend-inbound'

export const runtime = 'nodejs'

/**
 * Resend Inbound webhook — subscribe to `email.received` in Resend dashboard.
 *
 * Env:
 *   RESEND_API_KEY
 *   RESEND_WEBHOOK_SECRET (whsec_… from Resend webhook settings)
 *   NEXT_PUBLIC_APP_URL
 *   INTAKE_FROM_EMAIL (optional, verified sender for replies)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    const verified = verifyResendWebhook(rawBody, {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    })

    if (!verified) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as ResendReceivedWebhook

    if (payload.type !== 'email.received') {
      return NextResponse.json({ ok: true, skipped: payload.type })
    }

    const emailId = payload.data?.email_id
    if (!emailId) {
      return NextResponse.json({ error: 'Missing email_id in webhook payload' }, { status: 400 })
    }

    const { reviewToken, reviewUrl } = await processInboundResendEmail(emailId)

    return NextResponse.json({ ok: true, reviewToken, reviewUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Inbound processing failed'
    console.error('POST /api/intake/inbound error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
