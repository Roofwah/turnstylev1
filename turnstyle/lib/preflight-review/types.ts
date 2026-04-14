// ─────────────────────────────────────────────
// Turnstyle Preflight Review — Type Definitions
//
// The review layer sits above raw extraction and answers
// the question: "Is the substantive compliance content
// actually present — and is it good enough to use?"
//
// Rather than binary present/absent, each concept gets a
// nuanced PresenceState that drives scoring and recommendations.
// ─────────────────────────────────────────────

/**
 * How well a required concept is represented in the document.
 *
 *   strong   — explicitly stated, clearly worded, no gaps
 *   embedded — present but buried in non-standard location or phrasing
 *   partial  — mentioned but incomplete (e.g. draw date but no draw method)
 *   absent   — not detectable by any means
 */
export type PresenceState = 'strong' | 'embedded' | 'partial' | 'absent'

/** A single keyword cluster hit within the document */
export interface ConceptHit {
  keyword: string
  snippet: string
  offset?: number
}

/** Review result for one compliance concept */
export interface ConceptReview {
  /** Unique concept identifier */
  conceptId: string
  /** Human-readable name */
  label: string
  /** How well is the concept represented? */
  presence: PresenceState
  /** All keyword hits that contributed to this assessment */
  hits: ConceptHit[]
  /** Specific gaps identified within a partial/absent concept */
  gaps: string[]
  /** Notes surfaced to the user about this concept */
  notes: string[]
  /** Is this concept required for a compliant promotion? */
  required: boolean
  /** Is this concept conditionally required (e.g. only if travel prize)? */
  conditional: boolean
  conditionMet?: boolean
}

// ─── Composite score model ────────────────────

export interface CompositeScore {
  /**
   * Component Completeness (60%)
   * — Are all required concepts present at strong or embedded level?
   */
  componentCompleteness: number
  /**
   * Drafting Quality (25%)
   * — Are present concepts well-drafted with specific dates, values,
   *   methods and plain language?
   */
  draftingQuality: number
  /**
   * Commercial Clarity (15%)
   * — Can a consumer understand how to enter, what they win and how
   *   winners are notified?
   */
  commercialClarity: number
  /**
   * Weighted total (0–100)
   */
  total: number
  /**
   * Component-level breakdown for UI display
   */
  breakdown: {
    label: string
    weight: number
    raw: number
    weighted: number
  }[]
}

// ─── Recommendation ───────────────────────────

export type RecommendationCode =
  | 'refine_existing_terms'
  | 'normalize_into_turnstyle'
  | 'complete_rebuild_recommended'

export interface ReviewRecommendation {
  code: RecommendationCode
  headline: string
  rationale: string
  /** Bullet-point actions for the user */
  actions: string[]
  /** Is the document close enough to use with minor edits? */
  usableAsIs: boolean
}

// ─── Full document review ─────────────────────

export interface DocumentReview {
  /** All concept reviews, including conditional ones */
  concepts: ConceptReview[]
  /** Strong + embedded counts / total required */
  presenceSummary: {
    strong: number
    embedded: number
    partial: number
    absent: number
    totalRequired: number
    totalConditional: number
  }
  compositeScore: CompositeScore
  recommendation: ReviewRecommendation
  /** Is the document structurally parseable by Turnstyle? */
  isNormalisable: boolean
  /** Can a campaign be pre-seeded from this document? */
  isSeedable: boolean
  reviewedAt: Date
}
