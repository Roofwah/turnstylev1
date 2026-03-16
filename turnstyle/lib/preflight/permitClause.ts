// ─────────────────────────────────────────────
// Turnstyle — Permit Clause Builder
//
// Builds the permit numbers clause dynamically
// based on campaign.requiredPermits and stored
// permit number fields.
//
// Usage:
//   import { buildPermitClause } from '@/lib/preflight/permitClause'
//   const clause = buildPermitClause(campaign)
//   if (clause) renderedTerms += '\n\n---\n\n' + clause
//
// Returns null if no permits are required.
// ─────────────────────────────────────────────

interface CampaignPermitFields {
  requiredPermits: string[]
  permitNSW: string | null
  permitSA: string | null
  permitACT: string | null
}

// NSW permit is always Flow Marketing's fixed number
const NSW_PERMIT_DEFAULT = 'TP/000076'

// Placeholder text shown when permit not yet issued
const PLACEHOLDER_SA  = 'T26/####'
const PLACEHOLDER_ACT = 'TP 26/#####'

export function buildPermitClause(campaign: CampaignPermitFields): string | null {
  const required = campaign.requiredPermits ?? []

  // No permits required — don't add clause
  if (required.length === 0) return null

  const parts: string[] = []

  if (required.includes('ACT')) {
    const number = campaign.permitACT ?? PLACEHOLDER_ACT
    parts.push(`ACT: ${number}`)
  }

  if (required.includes('SA')) {
    const number = campaign.permitSA ?? PLACEHOLDER_SA
    parts.push(`SA: ${number}`)
  }

  if (required.includes('NSW')) {
    const number = campaign.permitNSW ?? NSW_PERMIT_DEFAULT
    parts.push(`NSW: ${number}`)
  }

  // No recognised permit states found
  if (parts.length === 0) return null

  return `Permit Numbers\n\nAuthorised in Australia: ${parts.join('; ')}`
}

// Returns true if any permit placeholders are unfilled
// Used by preflight to warn about unpublishable terms
export function hasUnfilledPermits(campaign: CampaignPermitFields): boolean {
  const required = campaign.requiredPermits ?? []
  if (required.includes('SA')  && !campaign.permitSA)  return true
  if (required.includes('ACT') && !campaign.permitACT) return true
  return false
}
