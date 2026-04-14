// ─────────────────────────────────────────────
// Turnstyle Preflight — Deterministic Rules Engine
// Pure functions. No AI. No side effects.
// Each rule returns PreflightIssue | null
// ─────────────────────────────────────────────

import {
  CampaignBuilderInput,
  TermsDocument,
  PreflightIssue,
  ClauseType,
} from '../types'
import { getClauseBody } from '../classifier'

type RuleFn = (
  builder: CampaignBuilderInput,
  doc: TermsDocument
) => PreflightIssue | null

// ─── Helpers ──────────────────────────────────

const issue = (
  partial: Omit<PreflightIssue, 'sourceLayer'>
): PreflightIssue => ({ ...partial, sourceLayer: 'rules' })

function bodyContains(doc: TermsDocument, type: ClauseType, ...terms: string[]): boolean {
  const body = getClauseBody(doc, type)
  if (!body) return false
  return terms.every((t) => body.toLowerCase().includes(t.toLowerCase()))
}

function clauseExists(doc: TermsDocument, type: ClauseType): boolean {
  return doc.clauses.some((c) => c.type === type)
}

// ─── Date & Timeline Rules ────────────────────

const RULE_DATE_01: RuleFn = (builder) => {
  if (builder.promoStart >= builder.promoEnd) {
    return issue({
      ruleId: 'RULE-DATE-01',
      severity: 'CRITICAL',
      category: 'DATE_TIMELINE',
      title: 'Promotion start date is not before end date',
      description: `Start: ${builder.promoStart.toDateString()} · End: ${builder.promoEnd.toDateString()}`,
      builderField: 'promoStart / promoEnd',
      suggestedFix: 'Ensure promotion start date is strictly before the end date.',
    })
  }
  return null
}

const RULE_DATE_02: RuleFn = (builder) => {
  if (builder.promotionType === 'chance' && builder.drawDate) {
    if (builder.drawDate <= builder.promoEnd) {
      return issue({
        ruleId: 'RULE-DATE-02',
        severity: 'CRITICAL',
        category: 'DATE_TIMELINE',
        title: 'Draw date must be after promotion close date',
        description: `Draw: ${builder.drawDate.toDateString()} · Close: ${builder.promoEnd.toDateString()}`,
        builderField: 'drawDate',
        suggestedFix: 'Set draw date to at least the day after promotion close.',
      })
    }
  }
  return null
}

const RULE_DATE_03: RuleFn = (builder) => {
  if (builder.unclaimedDrawDate && builder.drawDate) {
    if (builder.unclaimedDrawDate <= builder.drawDate) {
      return issue({
        ruleId: 'RULE-DATE-03',
        severity: 'CRITICAL',
        category: 'DATE_TIMELINE',
        title: 'Unclaimed prize draw must occur after original draw',
        description: `Unclaimed draw: ${builder.unclaimedDrawDate.toDateString()} · Original draw: ${builder.drawDate.toDateString()}`,
        builderField: 'unclaimedDrawDate',
        suggestedFix: 'Set unclaimed prize draw date after the original draw date.',
      })
    }
  }
  return null
}

const RULE_DATE_04: RuleFn = (builder) => {
  if (builder.claimDeadline && builder.unclaimedDrawDate) {
    if (builder.claimDeadline >= builder.unclaimedDrawDate) {
      return issue({
        ruleId: 'RULE-DATE-04',
        severity: 'ERROR',
        category: 'DATE_TIMELINE',
        title: 'Claim deadline must be before unclaimed prize draw',
        description: `Claim deadline: ${builder.claimDeadline.toDateString()} · Unclaimed draw: ${builder.unclaimedDrawDate.toDateString()}`,
        builderField: 'claimDeadline',
        suggestedFix: 'Claim deadline must fall strictly before the unclaimed prize draw date.',
      })
    }
  }
  return null
}

// ─── Prize Validation Rules ───────────────────

const RULE_PRIZE_01: RuleFn = (builder) => {
  const calculated = builder.prizes.reduce(
    (sum, p) => sum + p.quantity * p.valueIncGst,
    0
  )
  const diff = Math.abs(calculated - builder.totalPrizePoolIncGst)
  if (diff > 0.01) {
    return issue({
      ruleId: 'RULE-PRIZE-01',
      severity: 'CRITICAL',
      category: 'PRIZE',
      title: 'Prize pool maths mismatch',
      description: `Calculated: $${calculated.toFixed(2)} · Builder total: $${builder.totalPrizePoolIncGst.toFixed(2)} · Difference: $${diff.toFixed(2)}`,
      builderField: 'totalPrizePoolIncGst',
      suggestedFix: `Update total prize pool to $${calculated.toFixed(2)} incl. GST.`,
    })
  }
  return null
}

const RULE_PRIZE_02: RuleFn = (builder, doc) => {
  // Detect "valued up to" AND "valued at" in prize description — contradictory
  const body = getClauseBody(doc, 'prize_description') ?? ''
  const hasUpTo = /valued?\s+up\s+to/i.test(body)
  const hasValuedAt = /valued?\s+at\s+\$/i.test(body)
  if (hasUpTo && hasValuedAt) {
    return issue({
      ruleId: 'RULE-PRIZE-02',
      severity: 'ERROR',
      category: 'PRIZE',
      title: 'Contradictory prize value wording',
      description: 'Prize description contains both "valued up to" and "valued at" — these are contradictory qualifiers.',
      affectedClause: 'prize_description',
      suggestedFix: 'Use either "valued up to $X" (variable) or "valued at $X" (fixed). For travel prizes, "valued up to" is preferred.',
    })
  }
  return null
}

// ─── Builder vs Terms Mismatch Rules ─────────

const RULE_BUILDER_01: RuleFn = (builder, doc) => {
  const body = getClauseBody(doc, 'draw_mechanics') ?? ''
  const match = body.match(/(\d+)\s+winner/i)
  if (match) {
    const termsWinners = parseInt(match[1], 10)
    if (termsWinners !== builder.numberOfWinners) {
      return issue({
        ruleId: 'RULE-BUILDER-01',
        severity: 'CRITICAL',
        category: 'BUILDER_MISMATCH',
        title: 'Winner count mismatch',
        description: `Terms state ${termsWinners} winner(s) but builder is configured for ${builder.numberOfWinners}.`,
        affectedClause: 'draw_mechanics',
        builderField: 'numberOfWinners',
        suggestedFix: `Update terms to reflect ${builder.numberOfWinners} winner(s).`,
      })
    }
  }
  return null
}

const RULE_BUILDER_02: RuleFn = (builder, doc) => {
  const body =
    (getClauseBody(doc, 'prize_description') ?? '') +
    (getClauseBody(doc, 'draw_mechanics') ?? '') +
    doc.rawText

  for (const prize of builder.prizes) {
    const value = prize.valueIncGst

    // Build multiple formats to search for:
    // 8245 → $8,245 / $8,245.00 / 8245 / 8,245
    const formatted = value.toLocaleString('en-AU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    const formattedWithCents = value.toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const plain = value.toString()

    const found =
      body.includes(`$${formatted}`) ||
      body.includes(`$${formattedWithCents}`) ||
      body.includes(`$${plain}`) ||
      body.includes(formatted) ||
      body.includes(plain)

    if (!found) {
      return issue({
        ruleId: 'RULE-BUILDER-02',
        severity: 'CRITICAL',
        category: 'BUILDER_MISMATCH',
        title: 'Prize value not found in terms',
        description: `Builder prize value $${formattedWithCents} (incl. GST) does not appear in the prize description or draw clause.`,
        affectedClause: 'prize_description',
        builderField: 'prizes[].valueIncGst',
        suggestedFix: `Ensure prize value $${formattedWithCents} is stated in the prize description.`,
      })
    }
  }
  return null
}

const RULE_BUILDER_03: RuleFn = (builder, doc) => {
  const body =
    (getClauseBody(doc, 'promotional_period') ?? '') +
    (getClauseBody(doc, 'draw_mechanics') ?? '')

  const startYear = builder.promoStart.getFullYear().toString()
  const endYear = builder.promoEnd.getFullYear().toString()

  if (!body.includes(startYear) || !body.includes(endYear)) {
    return issue({
      ruleId: 'RULE-BUILDER-03',
      severity: 'CRITICAL',
      category: 'BUILDER_MISMATCH',
      title: 'Promotion dates may not match terms',
      description: 'Expected promotion year not found in the promotional period or draw clause.',
      affectedClause: 'promotional_period',
      builderField: 'promoStart / promoEnd',
      suggestedFix: 'Verify all dates in the terms match the builder configuration.',
    })
  }
  return null
}

// ─── Eligibility Rules ────────────────────────

const RULE_ELIG_01: RuleFn = (builder, doc) => {
  if (builder.minorsCanEnter && !clauseExists(doc, 'eligibility')) {
    return issue({
      ruleId: 'RULE-ELIG-01',
      severity: 'ERROR',
      category: 'ELIGIBILITY',
      title: 'Guardian consent clause required for minor entrants',
      description: 'Builder indicates minors can enter but no eligibility/guardian clause was found.',
      affectedClause: 'eligibility',
      builderField: 'minorsCanEnter',
      suggestedFix: 'Add a guardian consent clause to the eligibility section.',
    })
  }
  return null
}

// ─── Permit Rules ─────────────────────────────

const RULE_PERMIT_01: RuleFn = (builder, doc) => {
  // Match permit numbers that still contain placeholder characters.
  // Australian permits follow T##/... or TP##/... prefixes.
  // Both #### and XXXX placeholders are in common use:
  //   TP26/XXXX  (ACT placeholder)   T26/0XXXX (SA placeholder)
  //   T26/####   (legacy style)
  // [\dX#]* allows optional leading digits before the placeholder run.
  const hasPlaceholder = /T\d{2}\/[\dX#]*[X#]{3,}|TP\s*\d{2}\/[\dX#]*[X#]{3,}/i.test(doc.rawText)
  if (hasPlaceholder) {
    return issue({
      ruleId: 'RULE-PERMIT-02',
      severity: 'NOTICE',
      category: 'STRUCTURAL',
      title: 'Permit number placeholders not yet filled',
      description: 'Terms contain permit number placeholders (e.g. ####). These will need to be replaced once permits are issued.',
      affectedClause: 'permits',
      builderField: 'permitNumbers',
      suggestedFix: 'Enter permit numbers in the LOA tab once they have been issued.',
    })
  }
  return null
}

const RULE_PERMIT_02: RuleFn = (builder, doc) => {
  const hasPlaceholder = /T\d{2}\/[\dX#]*[X#]{3,}|TP\s*\d{2}\/[\dX#]*[X#]{3,}/i.test(doc.rawText)
  if (hasPlaceholder) return null

  const needsSA  = builder.permitStates.includes('SA')  && !builder.permitNumbers.SA
  const needsACT = builder.permitStates.includes('ACT') && !builder.permitNumbers.ACT

  if (needsSA || needsACT) {
    const missing = [needsSA ? 'SA' : null, needsACT ? 'ACT' : null].filter(Boolean).join(', ')
    return issue({
      ruleId: 'RULE-PERMIT-01',
      severity: 'NOTICE',
      category: 'STRUCTURAL',
      title: `Permit numbers pending: ${missing}`,
      description: `This promotion requires a permit for ${missing}. Permits are applied for separately and entered in the LOA tab once issued.`,
      builderField: 'permitNumbers',
      suggestedFix: `Enter ${missing} permit number(s) in the LOA tab once issued.`,
    })
  }
  return null
}

const RULE_PERMIT_03: RuleFn = (builder, doc) => {
  const hasPlaceholder = /T\d{2}\/[\dX#]*[X#]{3,}|TP\s*\d{2}\/[\dX#]*[X#]{3,}/i.test(doc.rawText)
  if (hasPlaceholder) return null

  if (builder.permitStates.includes('NSW') && !builder.permitNumbers.NSW) {
    return issue({
      ruleId: 'RULE-PERMIT-03',
      severity: 'NOTICE',
      category: 'STRUCTURAL',
      title: 'NSW permit number not set',
      description: 'NSW promotions use Flow Marketing permit TP/000076.',
      builderField: 'permitNumbers',
      suggestedFix: 'Set NSW permit number to TP/000076 in the LOA tab.',
    })
  }
  return null
}

// ─── Travel Prize Rules ───────────────────────

const RULE_TRAVEL_01: RuleFn = (builder, doc) => {
  if (!builder.hasTravelPrize) return null
  if (!clauseExists(doc, 'travel_conditions')) {
    return issue({
      ruleId: 'RULE-TRAVEL-01',
      severity: 'ERROR',
      category: 'TRAVEL_PRIZE',
      title: 'Travel clause missing',
      description: 'Builder indicates a travel prize but no travel conditions clause was found.',
      affectedClause: 'travel_conditions',
      builderField: 'hasTravelPrize',
      suggestedFix: 'Add a travel prize conditions clause covering booking, availability, exclusions and companion travel.',
    })
  }
  return null
}

const RULE_TRAVEL_02: RuleFn = (builder, doc) => {
  if (!builder.hasTravelPrize) return null
  const body = getClauseBody(doc, 'travel_conditions') ?? ''
  if (!body.toLowerCase().includes('travel insurance')) {
    return issue({
      ruleId: 'RULE-TRAVEL-02',
      severity: 'NOTICE',
      category: 'TRAVEL_PRIZE',
      title: 'Travel insurance recommendation missing',
      description: 'Travel prize clause does not mention travel insurance.',
      affectedClause: 'travel_conditions',
      suggestedFix: 'Add wording recommending the winner obtain travel insurance.',
      suggestedRewrite:
        'The Promoter strongly recommends that the winner and any travelling companion(s) obtain travel insurance prior to travel. Travel insurance is not included in the prize unless otherwise stated.',
    })
  }
  return null
}

// ─── Privacy Rules ────────────────────────────

const RULE_PRIV_01: RuleFn = (builder, doc) => {
  if (!clauseExists(doc, 'privacy')) {
    return issue({
      ruleId: 'RULE-PRIV-01',
      severity: 'CRITICAL',
      category: 'PRIVACY_LIABILITY',
      title: 'Privacy clause missing',
      description: 'No privacy clause was found in the terms.',
      affectedClause: 'privacy',
      suggestedFix: 'Add a privacy clause referencing the promoter\'s privacy policy.',
    })
  }
  return null
}

const RULE_PRIV_02: RuleFn = (builder, doc) => {
  if (!builder.privacyPolicyUrl) {
    return issue({
      ruleId: 'RULE-PRIV-02',
      severity: 'ERROR',
      category: 'PRIVACY_LIABILITY',
      title: 'Privacy policy URL missing from builder',
      description: 'No privacy policy URL has been configured.',
      builderField: 'privacyPolicyUrl',
      suggestedFix: 'Add the promoter\'s privacy policy URL in the builder.',
    })
  }
  // Check it appears in terms
  if (!doc.rawText.includes(builder.privacyPolicyUrl)) {
    return issue({
      ruleId: 'RULE-PRIV-03',
      severity: 'WARNING',
      category: 'PRIVACY_LIABILITY',
      title: 'Privacy policy URL not found in terms text',
      description: `Builder URL "${builder.privacyPolicyUrl}" was not detected in the generated terms.`,
      affectedClause: 'privacy',
      builderField: 'privacyPolicyUrl',
      suggestedFix: 'Ensure the privacy policy URL is referenced in the privacy clause.',
    })
  }
  return null
}

// ─── Rule Registry ────────────────────────────

export const ALL_RULES: RuleFn[] = [
  RULE_DATE_01,
  RULE_DATE_02,
  RULE_DATE_03,
  RULE_DATE_04,
  RULE_PRIZE_01,
  RULE_PRIZE_02,
  RULE_BUILDER_01,
  RULE_BUILDER_02,
  RULE_BUILDER_03,
  RULE_ELIG_01,
  RULE_PERMIT_01,
  RULE_PERMIT_02,
  RULE_PERMIT_03,
  RULE_TRAVEL_01,
  RULE_TRAVEL_02,
  RULE_PRIV_01,
  RULE_PRIV_02,
]

/**
 * Rules that operate purely on document text and require no CampaignBuilderInput context.
 * Used by the standalone document preflight path (upload flow).
 * Builder-dependent rules (dates, prize pool maths, mismatch checks) are excluded.
 */
export const DOCUMENT_SAFE_RULES: RuleFn[] = [
  RULE_PERMIT_01, // Detects unfilled permit placeholders (#### patterns) — text only
  RULE_PRIZE_02,  // Detects contradictory "valued up to" / "valued at" wording — text only
  RULE_PRIV_01,   // Checks for presence of a privacy clause — text only
]

export function runRules(
  builder: CampaignBuilderInput,
  doc: TermsDocument,
  options?: { documentOnly?: boolean }
): PreflightIssue[] {
  const rules = options?.documentOnly ? DOCUMENT_SAFE_RULES : ALL_RULES
  return rules.map((rule) => rule(builder, doc)).filter(
    (result): result is PreflightIssue => result !== null
  )
}
