import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

export type AuthenticatedPartner = {
  partnerId: string
  displayName: string
  rateLimitPerMin: number
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/**
 * Env fallback for local/demo partners (no DB seed required):
 * INTAKE_PARTNER_KEYS='zitcha:ts_live_xxxx,demo:ts_live_yyyy'
 * Values are plaintext keys; hashed at verify time. Prefer DB credentials in production.
 */
function partnersFromEnv(): Array<{ partnerId: string; apiKey: string; displayName: string }> {
  const raw = process.env.INTAKE_PARTNER_KEYS?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx <= 0) return null
      const partnerId = part.slice(0, idx).trim()
      const apiKey = part.slice(idx + 1).trim()
      if (!partnerId || !apiKey) return null
      return { partnerId, apiKey, displayName: partnerId }
    })
    .filter((p): p is { partnerId: string; apiKey: string; displayName: string } => p != null)
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

export async function authenticatePartnerApiKey(apiKey: string | null): Promise<AuthenticatedPartner | null> {
  if (!apiKey || apiKey.length < 16) return null

  const keyHash = hashApiKey(apiKey)

  // DB credentials first
  try {
    const prefix = apiKey.slice(0, 8)
    const candidates = await prisma.partnerApiCredential.findMany({
      where: { isActive: true, apiKeyPrefix: prefix },
    })
    for (const c of candidates) {
      if (safeEqualHex(c.apiKeyHash, keyHash)) {
        return {
          partnerId: c.partnerId,
          displayName: c.displayName,
          rateLimitPerMin: c.rateLimitPerMin,
        }
      }
    }
  } catch {
    // Table may not exist yet — fall through to env
  }

  for (const p of partnersFromEnv()) {
    if (p.apiKey === apiKey) {
      return {
        partnerId: p.partnerId,
        displayName: p.displayName,
        rateLimitPerMin: Number(process.env.INTAKE_PARTNER_RATE_LIMIT || 30),
      }
    }
  }

  return null
}

/** Generate a new partner API key (plaintext returned once; store hash). */
export function generatePartnerApiKey(): { apiKey: string; apiKeyHash: string; apiKeyPrefix: string } {
  const apiKey = `ts_live_${randomBytes(24).toString('base64url')}`
  return {
    apiKey,
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPrefix: apiKey.slice(0, 8),
  }
}

export { hashApiKey }
