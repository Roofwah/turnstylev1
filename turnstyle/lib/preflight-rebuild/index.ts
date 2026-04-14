// ─────────────────────────────────────────────
// Turnstyle Preflight Rebuild — Draft Seed Mapper
//
// mapExtractedSchemaToCampaignDraftSeed(schema)
//
// Converts an ExtractedCampaignSchema into a CampaignDraftSeed
// ready to pre-populate the campaign wizard.
//
// Rules:
//   - Only fields with confidence !== 'none' are included
//   - Fields with confidence 'low' are flagged as needsReview
//   - All state arrays are validated against known AustralianState values
//   - Date strings are passed through as-is (ISO or raw)
// ─────────────────────────────────────────────

import type { ExtractedCampaignSchema, ExtractionConfidence, ExtractedField } from '../preflight-extraction/types'
import type { AustralianState } from '../preflight/types'
import type { CampaignDraftSeed, SeedField, SeedPrize } from './types'

const VALID_STATES = new Set<AustralianState>(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'])

// ─── Helpers ──────────────────────────────────

function seed<T>(field: ExtractedField<T>): SeedField<T> | undefined {
  if (field.confidence === 'none' || field.value === null) return undefined
  return {
    value: field.value as T,
    confidence: field.confidence,
    needsReview: field.confidence === 'low',
  }
}

function seedRequired<T>(field: ExtractedField<T>, fallback: T): SeedField<T> {
  return {
    value: field.value !== null ? (field.value as T) : fallback,
    confidence: field.confidence === 'none' ? 'low' : field.confidence,
    needsReview: field.confidence === 'low' || field.confidence === 'none',
  }
}

function filterStates(raw: string[]): AustralianState[] {
  return raw.filter((s): s is AustralianState => VALID_STATES.has(s as AustralianState))
}

function fieldPath(fieldName: string): string {
  return fieldName
}

// ─── Main mapper ──────────────────────────────

export function mapExtractedSchemaToCampaignDraftSeed(
  schema: ExtractedCampaignSchema
): CampaignDraftSeed {
  const { core, timing, eligibilityAndEntry: elig, prizeModel, compliance, meta } = schema

  const lowConfidenceFields: string[] = []
  const missingFields: string[] = []

  // Helper to track field quality
  function track<T>(
    fieldName: string,
    field: ExtractedField<T>
  ): SeedField<T> | undefined {
    if (field.confidence === 'none' || field.value === null) {
      missingFields.push(fieldName)
      return undefined
    }
    if (field.confidence === 'low') {
      lowConfidenceFields.push(fieldName)
    }
    return {
      value: field.value as T,
      confidence: field.confidence,
      needsReview: field.confidence === 'low',
    }
  }

  // ── Prizes ────────────────────────────────────
  const prizes: SeedPrize[] = prizeModel.prizes
    .filter((p) => p.description.confidence !== 'none')
    .map((p) => ({
      description: {
        value: p.description.value ?? '',
        confidence: p.description.confidence,
        needsReview: p.description.confidence === 'low',
      },
      quantity: {
        value: p.quantity.value ?? 1,
        confidence: p.quantity.confidence,
        needsReview: p.quantity.confidence === 'low' || p.quantity.confidence === 'none',
      },
      valueIncGst: {
        value: p.valueIncGst.value ?? 0,
        confidence: p.valueIncGst.confidence,
        needsReview: p.valueIncGst.confidence !== 'high',
      },
      prizeTypes: {
        value: p.prizeType.value ?? ['product'],
        confidence: p.prizeType.confidence,
        needsReview: false,
      },
    }))

  // ── Permit numbers — filter to valid AustralianState keys ──────────
  let permitNumbersSeed: SeedField<Partial<Record<AustralianState, string>>> | undefined
  if (compliance.permitNumbers.value && Object.keys(compliance.permitNumbers.value).length > 0) {
    const validated: Partial<Record<AustralianState, string>> = {}
    for (const [k, v] of Object.entries(compliance.permitNumbers.value)) {
      if (VALID_STATES.has(k as AustralianState)) {
        validated[k as AustralianState] = v
      }
    }
    if (Object.keys(validated).length > 0) {
      permitNumbersSeed = {
        value: validated,
        confidence: compliance.permitNumbers.confidence,
        needsReview: compliance.permitNumbers.confidence !== 'high',
      }
    }
  }

  // ── Permit states ──────────────────────────────
  let permitStatesSeed: SeedField<AustralianState[]> | undefined
  if (compliance.permitStates.value && compliance.permitStates.value.length > 0) {
    const valid = filterStates(compliance.permitStates.value)
    if (valid.length > 0) {
      permitStatesSeed = {
        value: valid,
        confidence: compliance.permitStates.confidence,
        needsReview: compliance.permitStates.confidence === 'low',
      }
    }
  }

  // ── Jurisdiction → states ─────────────────────
  let statesSeed: SeedField<AustralianState[]> | undefined
  if (core.jurisdiction.value && core.jurisdiction.value.length > 0) {
    const valid = filterStates(core.jurisdiction.value)
    if (valid.length > 0) {
      statesSeed = {
        value: valid,
        confidence: core.jurisdiction.confidence,
        needsReview: core.jurisdiction.confidence === 'low',
      }
    }
  }

  // ── GST treatment ──────────────────────────────
  let gstTreatmentSeed: SeedField<'incl' | 'excl'> | undefined
  if (compliance.gstTreatment.value === 'incl' || compliance.gstTreatment.value === 'excl') {
    gstTreatmentSeed = {
      value: compliance.gstTreatment.value,
      confidence: compliance.gstTreatment.confidence,
      needsReview: compliance.gstTreatment.confidence === 'low',
    }
  }

  // ── Notification method ────────────────────────
  let notificationMethodSeed: SeedField<string[]> | undefined
  if (compliance.notificationMethod.value && compliance.notificationMethod.value.length > 0) {
    notificationMethodSeed = {
      value: compliance.notificationMethod.value,
      confidence: compliance.notificationMethod.confidence,
      needsReview: compliance.notificationMethod.confidence === 'low',
    }
  }

  return {
    sourceFilename: meta.filename,
    sourceWordCount: meta.wordCount,
    extractedAt: meta.extractedAt,

    campaignName:       track('campaignName', core.campaignName),
    promoterName:       track('promoterName', core.promoterName),
    promoterAbn:        track('promoterAbn', core.promoterAbn),
    promoterAddress:    track('promoterAddress', core.promoterAddress),
    website:            track('website', core.website),
    promotionType:      track('promotionType', core.promotionType),
    states:             statesSeed,

    promoStart:         track('promoStart', timing.promotionStart),
    promoEnd:           track('promoEnd', timing.promotionEnd),
    drawDate:           track('drawDate', timing.drawDate),
    drawTime:           track('drawTime', timing.drawTime),
    drawLocation:       track('drawLocation', timing.drawLocation),
    claimDeadline:      track('claimDeadline', timing.claimDeadline),

    minAge:             track('minAge', elig.ageMinimum),
    minorsCanEnter:     track('minorsCanEnter', elig.minorsPermitted),
    residencyRequirement: track('residencyRequirement', elig.residencyRequirement),
    loyaltyRequired:    track('loyaltyRequired', elig.loyaltyRequired),
    loyaltyProgramName: track('loyaltyProgramName', elig.loyaltyProgramName),

    entryMechanic:      track('entryMechanic', elig.entryMechanic),
    purchaseRequired:   track('purchaseRequired', elig.purchaseRequired),
    purchaseThreshold:  track('purchaseThreshold', elig.purchaseThreshold),
    entryLimit:         track('entryLimit', elig.entryLimit),

    prizes,
    totalPrizePoolIncGst: track('totalPrizePoolIncGst', prizeModel.totalPrizePool),
    numberOfWinners:      track('numberOfWinners', prizeModel.numberOfWinners),
    hasTravelPrize:       prizeModel.hasTravelPrize,
    hasEventPrize:        prizeModel.hasEventPrize,

    permitNumbers:               permitNumbersSeed,
    permitStates:                permitStatesSeed,
    privacyPolicyUrl:            track('privacyPolicyUrl', compliance.privacyPolicyUrl),
    notificationMethod:          notificationMethodSeed,
    notificationDaysAfterDraw:   track('notificationDaysAfterDraw', compliance.notificationDaysAfterDraw),
    gstTreatment:                gstTreatmentSeed,

    lowConfidenceFields,
    missingFields,
  }
}
