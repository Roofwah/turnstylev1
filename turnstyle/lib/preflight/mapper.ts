// ─────────────────────────────────────────────
// Turnstyle Preflight — Campaign Mapper (final)
//
// Maps Prisma Campaign + TermsDraft → CampaignBuilderInput
//
// prize JSON shape:    { qty, tier, type, unitValue, description }
// gapAnswers shape:    { SPEND, BRAND, PRIZE_TYPES, TRAVEL_BOOK_BY_DATE,
//                        UNCLAIMED_DEADLINE, UNCLAIMED_REDRAW }
// system tokens:       resolved from Campaign fields (not gapAnswers)
// ─────────────────────────────────────────────

import { Decimal } from '@prisma/client/runtime/library'
import { CampaignBuilderInput, AustralianState, Prize } from './types'

// ─── Prisma model shapes ──────────────────────

interface PrismaCampaign {
  id: string
  tsCode: string
  name: string
  promoStart: Date | null
  promoEnd: Date | null
  mechanicType: string
  entryMechanic: string | null
  drawSchedule: unknown
  regions: string[]
  prizes: unknown
  prizePoolTotal: Decimal
  permitNSW: string | null
  permitSA: string | null
  permitACT: string | null
  requiredPermits: string[]
  promoter?: { name: string; abn: string | null } | null
}

interface PrismaTermsDraft {
  content: string
  gapAnswers: unknown
}

// ─── Prize JSON shape ─────────────────────────
// Confirmed from Railway DB:
// { qty, tier, type, unitValue, description }

interface PrizeJson {
  qty: number
  tier?: string
  type: string        // "Travel" | "Gift Card" | "Cash" | "Motor vehicle" | "Other"
  unitValue: number
  description: string
}

// ─── GapAnswers shape ─────────────────────────
// Keys match gaps[].key in template files exactly

interface GapAnswers {
  SPEND?: string | number           // qualifying spend per entry
  BRAND?: string                    // participating brand(s)
  PRIZE_TYPES?: string | string[]   // selected prize type(s)
  TRAVEL_BOOK_BY_DATE?: string      // travel sub-template
  UNCLAIMED_DEADLINE?: string       // wizard-editable, overrides derived
  UNCLAIMED_REDRAW?: string         // wizard-editable, overrides derived
  [key: string]: unknown
}

// ─── DrawSchedule JSON shape ──────────────────

interface DrawScheduleJson {
  date?: string
  drawDate?: string
  time?: string
  drawTime?: string
  location?: string
  drawLocation?: string
  unclaimedDate?: string
  unclaimedDrawDate?: string
  unclaimedLocation?: string
  unclaimedDrawLocation?: string
  claimDeadline?: string
}

// ─── Helpers ──────────────────────────────────

function safeJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T } catch { return fallback }
  }
  return fallback
}

function safeDate(value: unknown): Date | undefined {
  if (!value) return undefined
  const d = new Date(value as string)
  return isNaN(d.getTime()) ? undefined : d
}

function safeStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return isNaN(n) ? fallback : n
}

// ─── State mapping ────────────────────────────

const ALL_STATES: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']

const STATE_MAP: Record<string, AustralianState> = {
  NSW: 'NSW', VIC: 'VIC', QLD: 'QLD', SA: 'SA',
  WA: 'WA',  TAS: 'TAS', ACT: 'ACT', NT: 'NT',
  'New South Wales':              'NSW',
  'Victoria':                     'VIC',
  'Queensland':                   'QLD',
  'South Australia':              'SA',
  'Western Australia':            'WA',
  'Tasmania':                     'TAS',
  'Australian Capital Territory': 'ACT',
  'Northern Territory':           'NT',
}

function mapStates(regions: string[]): AustralianState[] {
  // national_au means all Australian states and territories
  if (regions.includes('national_au')) return ALL_STATES
  return regions
    .map((r) => STATE_MAP[r.trim()])
    .filter((s): s is AustralianState => !!s)
}

// ─── Prize type flags ─────────────────────────
// Derived from prize.type — set directly in the form by the user
// This is the single source of truth for sub-template selection

function derivePrizeFlags(prizes: PrizeJson[]) {
  const types = prizes.map((p) => p.type.toLowerCase())
  return {
    hasTravelPrize: types.some((t) => t.includes('travel') || t.includes('event')),
    hasEventPrize:  types.some((t) => t.includes('travel') || t.includes('event')),
  }
}

// ─── Normalise prizes ─────────────────────────

function normalisePrizes(raw: unknown): Prize[] {
  const arr = safeJson<PrizeJson[]>(raw, [])
  if (!Array.isArray(arr) || arr.length === 0) {
    console.warn('[mapper] campaign.prizes is empty or unreadable')
    return []
  }
  return arr.map((p) => ({
    description: safeStr(p.description),
    quantity:    safeNum(p.qty, 1),
    valueIncGst: safeNum(p.unitValue, 0),
  }))
}

// ─── Prize pool ───────────────────────────────
// Always calculated — never trusted from the DB column

function calculatePrizePool(prizes: PrizeJson[]): number {
  return prizes.reduce(
    (sum, p) => sum + safeNum(p.qty) * safeNum(p.unitValue),
    0
  )
}

// ─── Winner count ─────────────────────────────
// Sum of all prize quantities

function calculateWinners(prizes: PrizeJson[]): number {
  return prizes.reduce((sum, p) => sum + safeNum(p.qty), 0)
}

// ─── Draw date calculation ────────────────────
// Matches frontend calcDrawDate() — 5 business days after promo end
// Used when drawSchedule is null (most campaigns)

function calcDrawDate(promoEnd: Date): Date {
  const d = new Date(promoEnd)
  let added = 0
  while (added < 5) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

// ─── Unclaimed date calculation ───────────────
// 60 days after promo end — matches frontend calcUnclaimed()

function calcUnclaimedDeadline(promoEnd: Date): Date {
  const d = new Date(promoEnd)
  d.setDate(d.getDate() + 60)
  return d
}

function calcUnclaimedRedraw(promoEnd: Date): Date {
  const d = calcUnclaimedDeadline(promoEnd)
  d.setDate(d.getDate() + 1)
  return d
}

function mapPromotionType(mechanicType: string): 'chance' | 'skill' | 'instant_win' {
  if (mechanicType === 'INSTANT_WIN')   return 'instant_win'
  if (mechanicType === 'GAME_OF_SKILL') return 'skill'
  return 'chance'
}

// ─── Permits ──────────────────────────────────

function buildPermitNumbers(
  campaign: PrismaCampaign
): Partial<Record<AustralianState, string>> {
  const out: Partial<Record<AustralianState, string>> = {}
  if (campaign.permitNSW) out.NSW = campaign.permitNSW
  if (campaign.permitSA)  out.SA  = campaign.permitSA
  if (campaign.permitACT) out.ACT = campaign.permitACT
  return out
}

function buildPermitStates(campaign: PrismaCampaign): AustralianState[] {
  // requiredPermits is the source of truth — set by Devflow and updateCampaign
  if (campaign.requiredPermits?.length) {
    return mapStates(campaign.requiredPermits)
  }
  // Fallback: only include states with actual permit numbers entered
  const states: AustralianState[] = []
  if (campaign.permitNSW) states.push('NSW')
  if (campaign.permitSA)  states.push('SA')
  if (campaign.permitACT) states.push('ACT')
  return states
}

// ─── Main mapper ───────────────────────────────

export function mapCampaignToBuilder(
  campaign: PrismaCampaign,
  termsDraft: PrismaTermsDraft
): CampaignBuilderInput {

  const gap       = safeJson<GapAnswers>(termsDraft.gapAnswers, {})
  const ds        = safeJson<DrawScheduleJson>(campaign.drawSchedule, {})
  const rawPrizes = safeJson<PrizeJson[]>(campaign.prizes, [])

  const prizes               = normalisePrizes(campaign.prizes)
  const flags                = derivePrizeFlags(rawPrizes)
  const states               = mapStates(campaign.regions)
  const totalPrizePoolIncGst = calculatePrizePool(rawPrizes)
  const numberOfWinners      = calculateWinners(rawPrizes)

  // Draw details — from drawSchedule JSON if available,
  // otherwise calculate from promoEnd (matches frontend behaviour)
  const promoEndDate = campaign.promoEnd ?? new Date()
  const drawDate     = safeDate(ds.drawDate ?? ds.date) ?? calcDrawDate(promoEndDate)
  const drawTime     = safeStr(ds.drawTime  ?? ds.time) || '12:00pm AEST'
  const drawLocation = safeStr(ds.drawLocation ?? ds.location) || 'Flow Marketing, 11 Lomandra Pl, Coolum QLD 4573'

  // Unclaimed dates — gapAnswers override derived defaults
  const unclaimedDrawDate     = safeDate(gap.UNCLAIMED_REDRAW  ?? ds.unclaimedDrawDate)  ?? calcUnclaimedRedraw(promoEndDate)
  const unclaimedDrawLocation = safeStr(ds.unclaimedDrawLocation ?? ds.unclaimedLocation) || drawLocation
  const claimDeadline         = safeDate(gap.UNCLAIMED_DEADLINE ?? ds.claimDeadline)      ?? calcUnclaimedDeadline(promoEndDate)

  return {
    campaignId: campaign.id,

    // Promoter
    promoter:    safeStr(campaign.promoter?.name),
    promoterAbn: safeStr(campaign.promoter?.abn ?? ''),
    website:     `https://turnstylehost.com/campaign/${campaign.tsCode}/`,

    // Promotion
    promotionType:    mapPromotionType(campaign.mechanicType),
    isTradePromotion: ['DRAW_ONLY', 'SWEEPSTAKES'].includes(campaign.mechanicType),

    // Dates
    promoStart: campaign.promoStart ?? new Date(),
    promoEnd:   campaign.promoEnd   ?? new Date(),

    // Draw
    drawDate,
    drawTime:     drawTime     || undefined,
    drawLocation: drawLocation || undefined,

    // Unclaimed
    unclaimedDrawDate,
    unclaimedDrawLocation: unclaimedDrawLocation || undefined,
    claimDeadline,
    claimMethod:  undefined,

    // Geography
    states,

    // Eligibility
    // NOTE: these are currently Repco-template defaults
    // If your schema grows to support per-campaign eligibility config,
    // move these to gapAnswers or a Campaign field
    minAge:                    16,
    minorsCanEnter:            true,
    guardianConsentRequired:   true,
    loyaltyMembershipRequired: true,
    loyaltyProgramName:        'Repco Rewards',
    entrantType:               'individual',

    // Entry
    entryMechanic:           safeStr(campaign.entryMechanic ?? ''),
    purchaseRequired:        !!gap.SPEND,
    purchaseThresholdIncGst: safeNum(gap.SPEND) || undefined,
    entryLimit:              'unlimited',

    // Prizes
    prizes,
    totalPrizePoolIncGst,
    numberOfWinners,
    numberOfReserveEntries: undefined,
    gstTreatment:           'incl',

    // Prize type flags — from prize.type, not gapAnswers
    hasTravelPrize: flags.hasTravelPrize,
    hasEventPrize:  flags.hasEventPrize,
    hasInstantWin:  campaign.mechanicType === 'INSTANT_WIN',

    // Notification
    notificationMethod:        ['email'],
    notificationDaysAfterDraw: 5,
    publicationRequired:       true,
    publicationUrl:            `https://turnstylehost.com/campaign/${campaign.tsCode}/`,
    publicationDurationDays:   28,

    // Permits
    permitStates:  buildPermitStates(campaign),
    permitNumbers: buildPermitNumbers(campaign),

    // Privacy — read from gapAnswers.PRIVACY gap answer
    // This key is used across all templates for the privacy policy URL
    privacyPolicyUrl: safeStr(gap.PRIVACY ?? gap.PRIVACY_URL ?? gap.privacyUrl ?? ''),

    // Misc
    winnersAreIndividuals: true,
  }
}
