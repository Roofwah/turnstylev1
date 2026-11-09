import { NextRequest, NextResponse } from 'next/server'
import { processIntakePacket, validatePacketSubmitInput } from '@/lib/intake/packet'
import { checkRateLimit } from '@/lib/intake/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16_000
const DEMO_RATE_LIMIT = Number(process.env.INTAKE_DEMO_RATE_LIMIT || 8)

/**
 * Server-side demo submission — same Packet pipeline as partner API.
 * No API keys in the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const email = String(body.email || body.submitterEmail || '').trim().toLowerCase()
    const rl = checkRateLimit(`demo:${ip}:${email || 'anon'}`, DEMO_RATE_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    // Optional allowlist: INTAKE_DEMO_ALLOWED_EMAILS=troy@zitcha.com,@zitcha.com
    const allow = process.env.INTAKE_DEMO_ALLOWED_EMAILS?.trim()
    if (allow) {
      const rules = allow.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      const ok = rules.some((rule) =>
        rule.startsWith('@') ? email.endsWith(rule) : email === rule
      )
      if (!ok) {
        return NextResponse.json(
          { error: 'This demonstration is currently limited to invited participants.' },
          { status: 403 }
        )
      }
    }

    const validated = validatePacketSubmitInput({
      concept: body.concept,
      submitterName: body.name ?? body.submitterName,
      submitterEmail: email,
      submitterCompany: body.company ?? body.submitterCompany,
      partnerId: 'demo',
      partnerDisplayName: 'Interactive Demo',
      source: 'demo',
      externalRef: null,
      idempotencyKey: null,
    })

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status })
    }

    const result = await processIntakePacket(validated.data)

    return NextResponse.json({
      ok: true,
      packet_ref: result.packetRef,
      presentation: result.presentation,
      interpretation_source: result.interpretationSource,
      emails: {
        submitter: result.emails.submitterSent,
        flow_marketing: result.emails.flowSent,
        submitter_error: result.emails.submitterError ?? null,
        flow_error: result.emails.flowError ?? null,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Submission failed'
    console.error('POST /api/intake/demo/submit error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
