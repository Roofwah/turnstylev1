// ─────────────────────────────────────────────
// Turnstyle Preflight Engine — Core Types
// ─────────────────────────────────────────────

export type IssueSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'NOTICE'

export type IssueCategory =
  | 'STRUCTURAL'
  | 'DATE_TIMELINE'
  | 'ELIGIBILITY'
  | 'ENTRY_MECHANIC'
  | 'PRIZE'
  | 'DRAW_MECHANICS'
  | 'WINNER_NOTIFICATION'
  | 'UNCLAIMED_PRIZE'
  | 'TRAVEL_PRIZE'
  | 'EVENT_PRIZE'
  | 'PRIVACY_LIABILITY'
  | 'BUILDER_MISMATCH'

export type RiskBand = 'EXCELLENT' | 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' | 'NOT_READY'

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT'

export type PrizeType =
  | 'travel'
  | 'event'
  | 'gift_card'
  | 'cash'
  | 'product'
  | 'experience'
  | 'voucher'

export type ClauseType =
  | 'promoter'
  | 'promotional_period'
  | 'eligibility'
  | 'entry_mechanic'
  | 'prize_description'
  | 'draw_mechanics'
  | 'travel_conditions'
  | 'event_conditions'
  | 'winner_notification'
  | 'unclaimed_prizes'
  | 'privacy'
  | 'liability'
  | 'permits'
  | 'miscellaneous'
  | 'unknown'

export type PrizeComplexityTier = 'trivial' | 'standard' | 'complex'

// ─── Prize ────────────────────────────────────

export interface PrizeTriggers {
  travelClause: boolean
  eventClause: boolean
  airfare300kmRule: boolean
  guardianTravelClause: boolean
}

export interface ParsedPrize {
  name: string
  quantity: number
  recipientCount: number
  valueIncGst: number
  valueQualifier: 'up_to' | 'valued_at' | 'exact'
  inclusions: string[]
  prizeType: PrizeType[]
  triggers: PrizeTriggers
  rawDescription: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Prize {
  description: string
  quantity: number
  valueIncGst: number
  parsedData?: ParsedPrize
}

// ─── Builder Input ────────────────────────────

export interface CampaignBuilderInput {
  campaignId: string
  promoter: string
  promoterAbn: string
  website: string
  promotionType: 'chance' | 'skill' | 'instant_win'
  isTradePromotion: boolean
  promoStart: Date
  promoEnd: Date
  drawDate?: Date
  drawTime?: string
  drawLocation?: string
  unclaimedDrawDate?: Date
  unclaimedDrawLocation?: string
  claimDeadline?: Date
  claimMethod?: string
  states: AustralianState[]
  minAge?: number
  minorsCanEnter: boolean
  guardianConsentRequired: boolean
  loyaltyMembershipRequired: boolean
  loyaltyProgramName?: string
  entrantType: 'individual' | 'business' | 'both'
  entryMechanic: string
  purchaseRequired: boolean
  purchaseThresholdIncGst?: number
  entryLimit?: number | 'unlimited'
  prizes: Prize[]
  totalPrizePoolIncGst: number
  numberOfWinners: number
  numberOfReserveEntries?: number
  gstTreatment: 'incl' | 'excl'
  hasTravelPrize: boolean
  hasEventPrize: boolean
  hasInstantWin: boolean
  notificationMethod: string[]
  notificationDaysAfterDraw: number
  publicationRequired: boolean
  publicationUrl?: string
  publicationDurationDays?: number
  permitStates: AustralianState[]
  permitNumbers: Partial<Record<AustralianState, string>>
  privacyPolicyUrl: string
  winnersAreIndividuals: boolean
}

// ─── Terms Document ───────────────────────────

export interface Clause {
  id: string
  type: ClauseType
  heading: string
  body: string
  startIndex: number
  endIndex: number
}

export interface TermsDocument {
  campaignId: string
  rawText: string
  clauses: Clause[]
  wordCount: number
  generatedAt: Date
}

// ─── Preflight Issues ─────────────────────────

export interface PreflightIssue {
  ruleId: string
  severity: IssueSeverity
  category: IssueCategory
  title: string
  description: string
  affectedClause?: ClauseType
  suggestedFix?: string
  suggestedRewrite?: string
  builderField?: string
  sourceLayer: 'rules' | 'ai'
}

// ─── Scoring ──────────────────────────────────

export interface CategoryScore {
  category: string
  weight: number
  rawScore: number
  weightedScore: number
  issueCount: {
    critical: number
    error: number
    warning: number
    notice: number
  }
}

export interface PreflightScore {
  total: number
  riskBand: RiskBand
  readinessStatus: string
  categoryScores: CategoryScore[]
  penaltyBreakdown: {
    ruleId: string
    severity: IssueSeverity
    penalty: number
  }[]
}

// ─── Full Report ──────────────────────────────

export interface PreflightReport {
  reportId: string
  campaignId: string
  generatedAt: Date
  score: PreflightScore
  issues: PreflightIssue[]
  missingClauses: ClauseType[]
  builderMismatches: PreflightIssue[]
  summary: {
    criticalCount: number
    errorCount: number
    warningCount: number
    noticeCount: number
    isPublishReady: boolean
    topIssues: PreflightIssue[]
  }
  aiReviewUsed: boolean
  aiReviewTokensUsed?: number
}

// ─── Prize Parser ─────────────────────────────

export interface PrizeParseRequest {
  rawDescription: string
  quantity?: number
  valueIncGst?: number
}

export interface PrizeParseResult {
  tier: PrizeComplexityTier
  parsed: ParsedPrize
  usedAi: boolean
  tokensUsed?: number
}
