// ─────────────────────────────────────────────
// Turnstyle Preflight Extraction — Type Definitions
//
// Structured extraction of campaign fundamentals from
// arbitrary uploaded terms documents.
//
// Design principles:
//   - Every extracted field carries a confidence level and
//     verbatim evidence snippets from the source text.
//   - Null value + confidence 'none' means the field was not
//     detected, not that it doesn't exist in the document.
//   - Confidence levels:
//       high   — exact regex match with specific format
//       medium — inferred from surrounding context
//       low    — best guess / partial match
//       none   — not found
// ─────────────────────────────────────────────

export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'none'

export interface EvidenceRef {
  /** Verbatim extract from the source text — max ~200 chars */
  snippet: string
  /** Approximate character offset in rawText */
  offset?: number
}

export interface ExtractedField<T> {
  value: T | null
  confidence: ExtractionConfidence
  evidence: EvidenceRef[]
  /** True when multiple conflicting values were found */
  ambiguous?: boolean
  ambiguityNote?: string
}

// ─── Source document metadata ─────────────────

export type DetectedDocumentFormat =
  | 'turnstyle_native'  // already has \n---\n separators
  | 'word_table'        // two-column Word table flattened by mammoth
  | 'free_form'         // headings in body text
  | 'unknown'

export interface SourceDocumentMeta {
  filename: string | null
  wordCount: number
  charCount: number
  /** Detected structural format of the uploaded document */
  detectedFormat: DetectedDocumentFormat
  /** Number of recognisable sections detected after normalisation */
  sectionCount: number
  extractedAt: Date
}

// ─── Campaign core identity ────────────────────

export interface ExtractedCampaignCore {
  campaignName: ExtractedField<string>
  promoterName: ExtractedField<string>
  promoterAbn: ExtractedField<string>
  promoterAddress: ExtractedField<string>
  promotionType: ExtractedField<'chance' | 'skill' | 'instant_win'>
  website: ExtractedField<string>
  jurisdiction: ExtractedField<string[]>
}

// ─── Timing & dates ───────────────────────────

export interface ExtractedCampaignTiming {
  /** Promotion open date — stored as ISO string or raw found text */
  promotionStart: ExtractedField<string>
  /** Promotion close date */
  promotionEnd: ExtractedField<string>
  drawDate: ExtractedField<string>
  drawTime: ExtractedField<string>
  drawLocation: ExtractedField<string>
  claimDeadline: ExtractedField<string>
  unclaimedDrawDate: ExtractedField<string>
}

// ─── Eligibility & entry ──────────────────────

export interface ExtractedEligibilityAndEntry {
  ageMinimum: ExtractedField<number>
  minorsPermitted: ExtractedField<boolean>
  residencyRequirement: ExtractedField<string>
  excludedOccupations: ExtractedField<string[]>
  entryMechanic: ExtractedField<string>
  purchaseRequired: ExtractedField<boolean>
  purchaseThreshold: ExtractedField<number>
  entryLimit: ExtractedField<number | 'unlimited'>
  loyaltyRequired: ExtractedField<boolean>
  loyaltyProgramName: ExtractedField<string>
}

// ─── Prize ────────────────────────────────────

export interface ExtractedPrize {
  /** Ordinal position in the document (1-based) */
  rank: number
  description: ExtractedField<string>
  quantity: ExtractedField<number>
  valueIncGst: ExtractedField<number>
  /** Raw prize value text as found in the document */
  valueRaw: ExtractedField<string>
  prizeType: ExtractedField<string[]>
  inclusions: ExtractedField<string[]>
  hasTravelComponent: boolean
  hasEventComponent: boolean
}

export interface ExtractedPrizeModel {
  prizes: ExtractedPrize[]
  totalPrizePool: ExtractedField<number>
  /** Raw total prize pool text as found in the document */
  totalPrizePoolRaw: ExtractedField<string>
  numberOfWinners: ExtractedField<number>
  hasTravelPrize: boolean
  hasEventPrize: boolean
}

// ─── Compliance ───────────────────────────────

export interface ExtractedCompliance {
  /** e.g. { NSW: 'TP26/1234', SA: 'T26/5678' } */
  permitNumbers: ExtractedField<Record<string, string>>
  permitStates: ExtractedField<string[]>
  privacyPolicyUrl: ExtractedField<string>
  notificationMethod: ExtractedField<string[]>
  notificationDaysAfterDraw: ExtractedField<number>
  publicationRequired: ExtractedField<boolean>
  gstTreatment: ExtractedField<'incl' | 'excl' | 'unknown'>
}

// ─── Diagnostics ──────────────────────────────

export interface ExtractionDiagnostics {
  totalFieldsAttempted: number
  highConfidenceCount: number
  mediumConfidenceCount: number
  lowConfidenceCount: number
  noneCount: number
  /** Field paths where ambiguous values were detected */
  ambiguousFields: string[]
  /** Non-fatal warnings generated during extraction */
  warnings: string[]
}

// ─── Top-level schema ─────────────────────────

export interface ExtractedCampaignSchema {
  schemaVersion: '1.0'
  meta: SourceDocumentMeta
  core: ExtractedCampaignCore
  timing: ExtractedCampaignTiming
  eligibilityAndEntry: ExtractedEligibilityAndEntry
  prizeModel: ExtractedPrizeModel
  compliance: ExtractedCompliance
  diagnostics: ExtractionDiagnostics
}
