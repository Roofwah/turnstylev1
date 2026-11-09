import { NextRequest, NextResponse } from 'next/server'
import { authenticatePartnerApiKey, extractBearerToken } from '@/lib/intake/partner-auth'
import { processIntakePacket, validatePacketSubmitInput } from '@/lib/intake/packet'
import { checkRateLimit } from '@/lib/intake/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 32_000

/**
 * Partner Intake API — one-way promotional concept submission.
 * Auth: Authorization: Bearer <partner_api_key>
 */
export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const apiKey =
      extractBearerToken(req.headers.get('authorization')) ||
      req.headers.get('x-api-key')

    const partner = await authenticatePartnerApiKey(apiKey)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(`partner:${partner.partnerId}`, partner.rateLimitPerMin)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retry_after_seconds: rl.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const idempotencyKey =
      (typeof body.idempotency_key === 'string' && body.idempotency_key) ||
      (typeof body.idempotencyKey === 'string' && body.idempotencyKey) ||
      req.headers.get('idempotency-key')

    const validated = validatePacketSubmitInput({
      concept: body.concept ?? body.promotional_concept ?? body.promotionalConcept,
      submitterName: body.submitter_name ?? body.submitterName ?? body.name,
      submitterEmail: body.submitter_email ?? body.submitterEmail ?? body.email,
      submitterCompany: body.submitter_company ?? body.submitterCompany ?? body.company,
      partnerId: partner.partnerId,
      partnerDisplayName: partner.displayName,
      source: 'partner',
      externalRef: body.external_ref ?? body.externalRef ?? null,
      idempotencyKey: idempotencyKey || null,
    })

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status })
    }

    const result = await processIntakePacket(validated.data)

    return NextResponse.json({
      ok: true,
      packet_ref: result.packetRef,
      status: result.idempotentReplay ? 'duplicate' : 'submitted',
      interpretation_source: result.interpretationSource,
      campaign_name: result.presentation.campaignName,
      summary: result.presentation.summary,
      emails: {
        submitter: result.emails.submitterSent,
        flow_marketing: result.emails.flowSent,
      },
      message: result.idempotentReplay
        ? 'Idempotent replay — existing packet returned.'
        : 'Promotional concept received. Flow Marketing has been notified.',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Submission failed'
    console.error('POST /api/v1/intake error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
