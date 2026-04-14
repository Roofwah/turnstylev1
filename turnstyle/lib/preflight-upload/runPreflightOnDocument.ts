// ─────────────────────────────────────────────
// Turnstyle Preflight Upload — Document Wrapper
//
// Runs the existing runPreflight() engine against an
// uploaded document without a campaign in the wizard.
//
// Strategy:
//   - Build a minimal stub CampaignBuilderInput so the
//     function signature is satisfied
//   - Pass documentOnly: true so only text-safe rules run
//     (DATE, PRIZE pool, BUILDER mismatch rules are skipped)
//   - Detect travel/event prize presence from the raw text
//     so structural missing-clause checks remain useful
//   - AI review is off by default; callers may opt in
//
// The existing runPreflight() and all wizard-based flows
// are completely unaffected by this wrapper.
// ─────────────────────────────────────────────

import { randomUUID } from 'crypto'
import { runPreflight } from '../preflight/index'
import { normaliseForClassifier } from './normaliseForClassifier'
import type { CampaignBuilderInput, PreflightReport } from '../preflight/types'

export interface DocumentPreflightOptions {
  /** Original filename — used as the campaign name in the stub */
  filename?: string
  /**
   * Skip AI review.  Defaults to true for the upload path
   * because the stub builder provides no campaign context that
   * would make AI qualitative review meaningful in v1.
   */
  skipAiReview?: boolean
}

// ─── Text-based heuristics ────────────────────
// These replace the builder flags that we cannot know from
// an external document alone.

function detectHasTravelPrize(text: string): boolean {
  return /\b(flight|airfare|air\s+travel|accommodation|hotel|resort|cruise|travel\s+prize)\b/i.test(
    text
  )
}

function detectHasEventPrize(text: string): boolean {
  return /\b(concert\s+ticket|event\s+ticket|festival\s+ticket|show\s+ticket|venue\s+ticket)\b/i.test(
    text
  )
}

// ─── Stub builder ─────────────────────────────
// All builder-dependent rule checks are disabled via
// documentOnly:true.  These values are never evaluated.

function buildStubBuilder(
  uploadId: string,
  filename: string,
  rawText: string
): CampaignBuilderInput {
  const now = new Date()
  const future = new Date(now.getTime() + 86_400_000 * 60) // 60 days

  return {
    campaignId: uploadId,
    promoter: filename,
    promoterAbn: '',
    website: '',
    promotionType: 'chance',
    isTradePromotion: false,
    promoStart: now,
    promoEnd: future,
    states: [],
    minorsCanEnter: false,
    guardianConsentRequired: false,
    loyaltyMembershipRequired: false,
    entrantType: 'individual',
    entryMechanic: '',
    purchaseRequired: false,
    prizes: [],
    totalPrizePoolIncGst: 0,
    numberOfWinners: 0,
    gstTreatment: 'incl',
    hasTravelPrize: detectHasTravelPrize(rawText),
    hasEventPrize: detectHasEventPrize(rawText),
    hasInstantWin: false,
    notificationMethod: [],
    notificationDaysAfterDraw: 7,
    publicationRequired: false,
    permitStates: [],
    permitNumbers: {},
    privacyPolicyUrl: '',
    winnersAreIndividuals: true,
  }
}

// ─── Main export ──────────────────────────────

export async function runPreflightOnDocument(
  rawText: string,
  uploadId: string,
  options: DocumentPreflightOptions = {}
): Promise<PreflightReport> {
  const filename = options.filename ?? 'Uploaded document'

  // Normalise external document format (table-extracted, heading-based)
  // into the \n---\n section format the classifier expects.
  // Turnstyle-generated terms pass through unchanged.
  const normalisedText = normaliseForClassifier(rawText)

  const builder = buildStubBuilder(uploadId, filename, normalisedText)

  const report = await runPreflight(builder, normalisedText, {
    skipAiReview: options.skipAiReview ?? true,
    documentOnly: true,
  })

  // Ensure the reportId traces back to the upload record
  return {
    ...report,
    campaignId: uploadId,
  }
}
