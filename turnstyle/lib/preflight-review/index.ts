// ─────────────────────────────────────────────
// Turnstyle Preflight Review — Review Engine
//
// reviewDocument(normalisedText, extraction) → DocumentReview
//
// Steps:
//   1. For each applicable concept, scan the text for keyword hits
//   2. Classify PresenceState from hit pattern
//   3. Run completeness checks to identify gaps
//   4. Compute composite score (60/25/15 weighting)
//   5. Generate a recommendation
// ─────────────────────────────────────────────

import type { ExtractedCampaignSchema } from '../preflight-extraction/types'
import type {
  ConceptReview,
  ConceptHit,
  PresenceState,
  CompositeScore,
  ReviewRecommendation,
  RecommendationCode,
  DocumentReview,
} from './types'
import { CONCEPT_DEFINITIONS, getApplicableConcepts, type ConceptDefinition } from './concepts'

// ─── Presence classification ──────────────────

function classifyPresence(
  def: ConceptDefinition,
  text: string
): { presence: PresenceState; hits: ConceptHit[] } {
  const hits: ConceptHit[] = []

  // Check headings
  const headingFound = def.headingPatterns.some((p) => {
    const sections = text.split(/\n\s*---\s*\n/)
    return sections.some((s) => {
      const firstLine = s.trim().split('\n')[0].trim()
      return p.test(firstLine)
    }) || text.split(/\n{2,}/).some((para) => {
      const line = para.trim()
      return line.split('\n').length === 1 && p.test(line)
    })
  })

  // Collect strong hits
  let strongCount = 0
  for (const sp of def.strongPatterns) {
    const re = new RegExp(sp.source, sp.flags.includes('g') ? sp.flags : sp.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      strongCount++
      hits.push({ keyword: m[0].slice(0, 60), snippet: getSnippet(text, m.index), offset: m.index })
      if (re.lastIndex === m.index) re.lastIndex++
    }
  }

  // Collect embedded hits
  let embeddedCount = 0
  for (const ep of def.embeddedPatterns) {
    const re = new RegExp(ep.source, ep.flags.includes('g') ? ep.flags : ep.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      embeddedCount++
      hits.push({ keyword: m[0].slice(0, 60), snippet: getSnippet(text, m.index), offset: m.index })
      if (re.lastIndex === m.index) re.lastIndex++
    }
  }

  // Deduplicate hits by offset proximity
  const deduped = deduplicateHits(hits)

  // Classify
  let presence: PresenceState
  if (headingFound && strongCount >= 1) {
    presence = 'strong'
  } else if (headingFound && embeddedCount >= 1) {
    presence = 'embedded'
  } else if (strongCount >= 2) {
    presence = 'strong'
  } else if (strongCount >= 1 || embeddedCount >= 2) {
    presence = 'embedded'
  } else if (embeddedCount >= 1) {
    presence = 'partial'
  } else {
    presence = 'absent'
  }

  return { presence, hits: deduped.slice(0, 5) }
}

function getSnippet(text: string, offset: number, len = 120): string {
  const start = Math.max(0, offset - 20)
  const end = Math.min(text.length, offset + len)
  return text.slice(start, end).replace(/\n/g, ' ').trim()
}

function deduplicateHits(hits: ConceptHit[]): ConceptHit[] {
  const seen = new Set<number>()
  return hits.filter((h) => {
    const bucket = Math.floor((h.offset ?? 0) / 100)
    if (seen.has(bucket)) return false
    seen.add(bucket)
    return true
  })
}

// ─── Gap detection ────────────────────────────

function detectGaps(
  def: ConceptDefinition,
  text: string,
  presence: PresenceState
): string[] {
  if (presence === 'absent') return []
  const gaps: string[] = []
  for (const check of def.completenessChecks) {
    if (!check.pattern.test(text)) {
      gaps.push(def.gapMessages[check.id] ?? check.label)
    }
  }
  return gaps
}

// ─── Concept review runner ────────────────────

function reviewConcept(
  def: ConceptDefinition,
  text: string,
  conditionMet?: boolean
): ConceptReview {
  const { presence, hits } = classifyPresence(def, text)
  const gaps = detectGaps(def, text, presence)
  const notes: string[] = []

  if (presence === 'partial') {
    notes.push('Concept partially detected — review manually for completeness.')
  }
  if (presence === 'embedded') {
    notes.push('Concept is embedded in body text rather than a dedicated section.')
  }

  return {
    conceptId: def.conceptId,
    label: def.label,
    presence,
    hits,
    gaps,
    notes,
    required: def.required,
    conditional: def.conditional,
    conditionMet,
  }
}

// ─── Composite scoring ────────────────────────

const PRESENCE_SCORES: Record<PresenceState, number> = {
  strong: 100,
  embedded: 75,
  partial: 40,
  absent: 0,
}

function computeCompositeScore(concepts: ConceptReview[]): CompositeScore {
  const required = concepts.filter((c) => c.required || (c.conditional && c.conditionMet))

  // ── Component Completeness (60%) ──────────────
  // Average presence score across required concepts
  const completenessRaw = required.length > 0
    ? required.reduce((sum, c) => sum + PRESENCE_SCORES[c.presence], 0) / required.length
    : 100

  // ── Drafting Quality (25%) ────────────────────
  // Penalise for gaps in strong/embedded concepts
  const present = required.filter((c) => c.presence !== 'absent')
  const gapCount = present.reduce((sum, c) => sum + c.gaps.length, 0)
  const maxPossibleGaps = present.reduce((sum, c) => {
    const def = CONCEPT_DEFINITIONS.find((d) => d.conceptId === c.conceptId)
    return sum + (def?.completenessChecks.length ?? 0)
  }, 0)
  const gapRatio = maxPossibleGaps > 0 ? gapCount / maxPossibleGaps : 0
  const draftingRaw = Math.max(0, 100 - gapRatio * 100)

  // ── Commercial Clarity (15%) ──────────────────
  // Focus on the three consumer-facing concepts
  const consumerConcepts = ['entry_mechanic', 'prize_description', 'winner_notification']
  const consumerReviews = concepts.filter((c) => consumerConcepts.includes(c.conceptId))
  const clarityRaw = consumerReviews.length > 0
    ? consumerReviews.reduce((sum, c) => sum + PRESENCE_SCORES[c.presence], 0) / consumerReviews.length
    : 100

  const total = Math.round(
    completenessRaw * 0.60 +
    draftingRaw * 0.25 +
    clarityRaw * 0.15
  )

  return {
    componentCompleteness: Math.round(completenessRaw),
    draftingQuality: Math.round(draftingRaw),
    commercialClarity: Math.round(clarityRaw),
    total,
    breakdown: [
      { label: 'Component Completeness', weight: 60, raw: Math.round(completenessRaw), weighted: Math.round(completenessRaw * 0.60) },
      { label: 'Drafting Quality', weight: 25, raw: Math.round(draftingRaw), weighted: Math.round(draftingRaw * 0.25) },
      { label: 'Commercial Clarity', weight: 15, raw: Math.round(clarityRaw), weighted: Math.round(clarityRaw * 0.15) },
    ],
  }
}

// ─── Recommendation engine ────────────────────

function generateRecommendation(
  concepts: ConceptReview[],
  score: CompositeScore,
  isNormalisable: boolean
): ReviewRecommendation {
  const required = concepts.filter((c) => c.required || (c.conditional && c.conditionMet))
  const absentRequired = required.filter((c) => c.presence === 'absent')
  const partialRequired = required.filter((c) => c.presence === 'partial')
  const strongOrEmbedded = required.filter((c) => c.presence === 'strong' || c.presence === 'embedded')

  let code: RecommendationCode
  let headline: string
  let rationale: string
  let actions: string[]
  let usableAsIs: boolean

  if (score.total >= 80 && absentRequired.length === 0) {
    // All required concepts present, score high
    code = isNormalisable ? 'refine_existing_terms' : 'normalize_into_turnstyle'
    headline = score.total >= 90
      ? 'Terms are strong — minor refinements only'
      : 'Terms are solid — a few gaps to address'
    rationale = `All required compliance concepts are present. ${
      partialRequired.length > 0
        ? `${partialRequired.length} concept(s) have minor gaps to address.`
        : 'Drafting quality could be improved in some areas.'
    }`
    actions = [
      ...partialRequired.map((c) => `Fill gaps in ${c.label}: ${c.gaps[0] ?? 'review wording'}`),
      ...required.filter((c) => c.gaps.length > 0).flatMap((c) => c.gaps.slice(0, 2).map((g) => `${c.label}: ${g}`)),
    ].slice(0, 6)
    if (actions.length === 0) actions = ['Review permit numbers for accuracy', 'Confirm all dates are correct for this promotion']
    usableAsIs = score.total >= 85
  } else if (score.total >= 55 && absentRequired.length <= 2) {
    // Most concepts present but notable gaps
    code = 'normalize_into_turnstyle'
    headline = 'Terms need work — normalise into Turnstyle for best results'
    rationale = `${strongOrEmbedded.length} of ${required.length} required concepts detected. ${absentRequired.length} required section(s) are absent or undetectable.`
    actions = [
      ...absentRequired.map((c) => `Add missing section: ${c.label}`),
      ...partialRequired.map((c) => `Complete partial section: ${c.label} — ${c.gaps[0] ?? 'review content'}`),
      'Use Turnstyle campaign builder to generate compliant structure',
    ].slice(0, 6)
    usableAsIs = false
  } else {
    // Major structural issues
    code = 'complete_rebuild_recommended'
    headline = 'Significant gaps detected — rebuild recommended'
    rationale = `Only ${strongOrEmbedded.length} of ${required.length} required compliance concepts could be detected. ${absentRequired.length} required section(s) are entirely absent.`
    actions = [
      'Create a new campaign in Turnstyle using the extracted data as a starting point',
      ...absentRequired.map((c) => `Build ${c.label} section from scratch`),
      'Have the resulting terms reviewed by a legal professional before use',
    ].slice(0, 6)
    usableAsIs = false
  }

  return { code, headline, rationale, actions, usableAsIs }
}

// ─── Normalisability check ────────────────────

function checkIsNormalisable(rawText: string, sectionCount: number): boolean {
  // Normalisable if we found at least 5 recognisable sections after normalisation
  return sectionCount >= 5
}

function checkIsSeedable(extraction: ExtractedCampaignSchema): boolean {
  // Seedable if we have promoter name + at least one date + prize info
  return (
    extraction.core.promoterName.confidence !== 'none' &&
    (extraction.timing.promotionStart.confidence !== 'none' || extraction.timing.promotionEnd.confidence !== 'none') &&
    extraction.prizeModel.prizes.length > 0
  )
}

// ─── Main export ──────────────────────────────

export interface ReviewOptions {
  hasTravelPrize?: boolean
  hasEventPrize?: boolean
  isChance?: boolean
  hasPermitObligations?: boolean
}

export function reviewDocument(
  normalisedText: string,
  extraction: ExtractedCampaignSchema,
  options: ReviewOptions = {}
): DocumentReview {
  const opts = {
    hasTravelPrize: options.hasTravelPrize ?? extraction.prizeModel.hasTravelPrize,
    hasEventPrize: options.hasEventPrize ?? extraction.prizeModel.hasEventPrize,
    isChance: options.isChance ?? (extraction.core.promotionType.value !== 'skill'),
    hasPermitObligations: options.hasPermitObligations ?? (extraction.compliance.permitStates.value?.length ?? 0) > 0,
  }

  const applicableDefs = getApplicableConcepts(opts)

  const concepts: ConceptReview[] = applicableDefs.map((def) => {
    let conditionMet: boolean | undefined
    if (def.conditional) {
      if (def.conceptId === 'travel_conditions') conditionMet = opts.hasTravelPrize
      else if (def.conceptId === 'event_conditions') conditionMet = opts.hasEventPrize
      else if (def.conceptId === 'permits') conditionMet = opts.hasPermitObligations
    }
    return reviewConcept(def, normalisedText, conditionMet)
  })

  // Presence summary
  const required = concepts.filter((c) => c.required || (c.conditional && c.conditionMet))
  const conditional = concepts.filter((c) => c.conditional)
  const presenceSummary = {
    strong:         concepts.filter((c) => c.presence === 'strong').length,
    embedded:       concepts.filter((c) => c.presence === 'embedded').length,
    partial:        concepts.filter((c) => c.presence === 'partial').length,
    absent:         concepts.filter((c) => c.presence === 'absent').length,
    totalRequired:  required.length,
    totalConditional: conditional.length,
  }

  const compositeScore = computeCompositeScore(concepts)
  const isNormalisable = checkIsNormalisable(normalisedText, extraction.meta.sectionCount)
  const isSeedable = checkIsSeedable(extraction)
  const recommendation = generateRecommendation(concepts, compositeScore, isNormalisable)

  return {
    concepts,
    presenceSummary,
    compositeScore,
    recommendation,
    isNormalisable,
    isSeedable,
    reviewedAt: new Date(),
  }
}
