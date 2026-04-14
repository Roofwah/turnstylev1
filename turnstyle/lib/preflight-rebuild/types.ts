// ─────────────────────────────────────────────
// Turnstyle Preflight Rebuild — Type Definitions
//
// CampaignDraftSeed is a builder-facing object that pre-populates
// the campaign wizard with values extracted from an uploaded document.
//
// Every field is optional — missing fields are left as wizard defaults.
// Confidence tags let the UI flag fields that need manual review.
// ─────────────────────────────────────────────

import type { ExtractionConfidence } from '../preflight-extraction/types'
import type { AustralianState } from '../preflight/types'

/** A seeded field carries its value and the confidence of extraction */
export interface SeedField<T> {
  value: T
  confidence: ExtractionConfidence
  /** True if the user should manually verify this value before proceeding */
  needsReview: boolean
}

/** A seeded prize, ready to pre-populate a Prize row in the builder */
export interface SeedPrize {
  description: SeedField<string>
  quantity: SeedField<number>
  valueIncGst: SeedField<number>
  prizeTypes: SeedField<string[]>
}

/**
 * Campaign draft seed — all fields optional, populated from extraction.
 * Designed to be passed directly to the campaign wizard pre-fill layer.
 */
export interface CampaignDraftSeed {
  /** Source document metadata */
  sourceFilename: string | null
  sourceWordCount: number
  extractedAt: Date

  // ── Identity ───────────────────────────────
  campaignName?: SeedField<string>
  promoterName?: SeedField<string>
  promoterAbn?: SeedField<string>
  promoterAddress?: SeedField<string>
  website?: SeedField<string>

  // ── Promotion meta ─────────────────────────
  promotionType?: SeedField<'chance' | 'skill' | 'instant_win'>
  states?: SeedField<AustralianState[]>

  // ── Dates ──────────────────────────────────
  promoStart?: SeedField<string>   // ISO date string YYYY-MM-DD
  promoEnd?: SeedField<string>
  drawDate?: SeedField<string>
  drawTime?: SeedField<string>
  drawLocation?: SeedField<string>
  claimDeadline?: SeedField<string>

  // ── Eligibility ────────────────────────────
  minAge?: SeedField<number>
  minorsCanEnter?: SeedField<boolean>
  residencyRequirement?: SeedField<string>
  loyaltyRequired?: SeedField<boolean>
  loyaltyProgramName?: SeedField<string>

  // ── Entry ──────────────────────────────────
  entryMechanic?: SeedField<string>
  purchaseRequired?: SeedField<boolean>
  purchaseThreshold?: SeedField<number>
  entryLimit?: SeedField<number | 'unlimited'>

  // ── Prizes ─────────────────────────────────
  prizes?: SeedPrize[]
  totalPrizePoolIncGst?: SeedField<number>
  numberOfWinners?: SeedField<number>
  hasTravelPrize?: boolean
  hasEventPrize?: boolean

  // ── Compliance ─────────────────────────────
  permitNumbers?: SeedField<Partial<Record<AustralianState, string>>>
  permitStates?: SeedField<AustralianState[]>
  privacyPolicyUrl?: SeedField<string>
  notificationMethod?: SeedField<string[]>
  notificationDaysAfterDraw?: SeedField<number>
  gstTreatment?: SeedField<'incl' | 'excl'>

  /**
   * Fields that were detected but the extraction confidence was low —
   * listed here so the UI can highlight them for manual review.
   */
  lowConfidenceFields: string[]

  /**
   * Fields that could not be extracted at all — the user must fill these
   * manually in the wizard.
   */
  missingFields: string[]
}
