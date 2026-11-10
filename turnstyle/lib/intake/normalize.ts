import type {
  ExtractedCampaignIntake,
  ExtractedPrize,
  ExtractedRegion,
  PermitFlag,
} from './types'
import { applyTurnstyleAssumptions, collectMissingFields } from './assumptions'
import { generateSummary } from './generateSummary'
import { extractFromNaturalLanguage, suggestCampaignName } from './nl-extract'

function asString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function asNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$]/g, ''))
  return isNaN(n) ? null : n
}

function asBool(v: unknown): boolean | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase()
  if (['true', 'yes', '1'].includes(s)) return true
  if (['false', 'no', '0', 'n/a'].includes(s)) return false
  return null
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

function normalizeIsoDate(v: unknown): string | null {
  const s = asString(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, mo, y] = dmy
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const mdY = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i)
  if (mdY) {
    const mo = MONTHS[mdY[1].toLowerCase()]
    if (mo) return `${mdY[3]}-${String(mo).padStart(2, '0')}-${mdY[2].padStart(2, '0')}`
  }
  const dMY = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/i)
  if (dMY) {
    const mo = MONTHS[dMY[2].toLowerCase()]
    if (mo) return `${dMY[3]}-${String(mo).padStart(2, '0')}-${dMY[1].padStart(2, '0')}`
  }
  return null
}

function normalizePrize(raw: unknown): ExtractedPrize | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const type = p.type === 'minor' ? 'minor' : 'major'
  const description = asString(p.description)
  if (!description) return null
  const quantity = asNumber(p.quantity)
  const unit_value = asNumber(p.unit_value)
  let total_value = asNumber(p.total_value)
  if (total_value == null && quantity != null && unit_value != null) {
    total_value = quantity * unit_value
  }
  return { type, description, quantity, unit_value, total_value }
}

function normalizePermitFlags(v: unknown): PermitFlag[] {
  if (!Array.isArray(v)) return []
  const allowed: PermitFlag[] = ['ACT_REVIEW', 'SA_REVIEW', 'NSW_REVIEW', 'NONE_REQUIRED']
  return v.filter((f): f is PermitFlag => allowed.includes(f as PermitFlag))
}

function normalizeRegion(raw: unknown): ExtractedRegion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const region_name = asString(r.region_name)
  if (!region_name) return null

  const prizes = Array.isArray(r.prizes)
    ? r.prizes.map(normalizePrize).filter((p): p is ExtractedPrize => p != null)
    : []
  const major_prizes = Array.isArray(r.major_prizes)
    ? r.major_prizes.map(normalizePrize).filter((p): p is ExtractedPrize => p != null)
    : prizes.filter(p => p.type === 'major')
  const minor_prizes = Array.isArray(r.minor_prizes)
    ? r.minor_prizes.map(normalizePrize).filter((p): p is ExtractedPrize => p != null)
    : prizes.filter(p => p.type === 'minor')

  const participating_brands = Array.isArray(r.participating_brands)
    ? r.participating_brands.map(b => String(b).trim()).filter(Boolean)
    : []

  return {
    region_name,
    country: asString(r.country),
    states: Array.isArray(r.states) ? r.states.map(String) : null,
    start_date: normalizeIsoDate(r.start_date),
    end_date: normalizeIsoDate(r.end_date),
    entry_mechanic: asString(r.entry_mechanic),
    entry_threshold: asNumber(r.entry_threshold),
    purchase_requirement: asString(r.purchase_requirement),
    loyalty_required: asBool(r.loyalty_required),
    participating_brands,
    subsequent_entries_allowed: asBool(r.subsequent_entries_allowed),
    prizes: prizes.length ? prizes : [...major_prizes, ...minor_prizes],
    major_prizes,
    minor_prizes,
    draw_type: asString(r.draw_type),
    draw_frequency: asString(r.draw_frequency),
    draw_date: normalizeIsoDate(r.draw_date),
    winner_publication_date: normalizeIsoDate(r.winner_publication_date),
    total_prize_value: asNumber(r.total_prize_value),
    permit_flags: normalizePermitFlags(r.permit_flags),
  }
}

export function normalizeIntake(raw: unknown, rawInput: string): ExtractedCampaignIntake {
  const base: ExtractedCampaignIntake = {
    raw_input: rawInput,
    campaign_name: null,
    promoter_name: null,
    brand: null,
    retailer: null,
    regions: [],
    notes: null,
    assumptions: [],
    missing_fields: [],
    confidence_scores: {},
    generated_summary: '',
  }

  if (!raw || typeof raw !== 'object') return base

  const o = raw as Record<string, unknown>
  const regions = Array.isArray(o.regions)
    ? o.regions.map(normalizeRegion).filter((r): r is ExtractedRegion => r != null)
    : []

  const confidence_scores: Record<string, number> = {}
  if (o.confidence_scores && typeof o.confidence_scores === 'object') {
    for (const [k, v] of Object.entries(o.confidence_scores as Record<string, unknown>)) {
      const n = asNumber(v)
      if (n != null) confidence_scores[k] = Math.min(1, Math.max(0, n))
    }
  }

  const intake: ExtractedCampaignIntake = {
    raw_input: rawInput,
    campaign_name: asString(o.campaign_name),
    promoter_name: asString(o.promoter_name),
    brand: asString(o.brand),
    retailer: asString(o.retailer),
    regions,
    notes: asString(o.notes),
    assumptions: Array.isArray(o.assumptions) ? o.assumptions.map(String) : [],
    missing_fields: Array.isArray(o.missing_fields) ? o.missing_fields.map(String) : [],
    confidence_scores,
    generated_summary: asString(o.generated_summary) ?? '',
  }

  return intake
}

function enrichCampaignNameFromConcept(intake: ExtractedCampaignIntake, rawInput: string): ExtractedCampaignIntake {
  const current = intake.campaign_name?.trim() || ''
  const isPlaceholder =
    !current ||
    /^untitled(\s+promotion)?$/i.test(current) ||
    /^promotion$/i.test(current) ||
    /^tbc$/i.test(current) ||
    /^to be confirmed$/i.test(current)

  if (!isPlaceholder) return intake

  const nl = extractFromNaturalLanguage(rawInput)
  const suggested =
    nl.campaignName ||
    suggestCampaignName({
      brand: intake.brand ?? nl.brand,
      retailer: intake.retailer ?? nl.retailer,
      prize: intake.regions[0]?.prizes?.[0] ?? nl.prizes[0] ?? null,
      drawFrequency: intake.regions[0]?.draw_frequency ?? nl.drawFrequency,
      raw: rawInput,
    }).name

  if (!suggested) return intake

  const next = { ...intake, campaign_name: suggested }
  if (!next.assumptions.some((a) => /Campaign name suggested/i.test(a))) {
    next.assumptions = [`Campaign name suggested from concept: "${suggested}".`, ...next.assumptions]
  }
  if (next.confidence_scores) {
    next.confidence_scores = { ...next.confidence_scores, campaign_name: 0.7 }
  }
  // Prefer NL retailer/brand when AI left them empty
  if (!next.retailer && nl.retailer) next.retailer = nl.retailer
  if (!next.brand && nl.brand) next.brand = nl.brand
  return next
}

/** Full pipeline: normalize → assumptions → missing fields → summary */
export function finalizeIntake(raw: unknown, rawInput: string): ExtractedCampaignIntake {
  let intake = normalizeIntake(raw, rawInput)
  intake = enrichCampaignNameFromConcept(intake, rawInput)
  intake = applyTurnstyleAssumptions(intake)
  intake.missing_fields = collectMissingFields(intake)
  intake.generated_summary = generateSummary(intake)
  return intake
}

export function finalizeMockIntake(rawInput: string, extracted: ExtractedCampaignIntake): ExtractedCampaignIntake {
  let intake = { ...extracted, raw_input: rawInput }
  intake = enrichCampaignNameFromConcept(intake, rawInput)
  intake = applyTurnstyleAssumptions(intake)
  intake.missing_fields = collectMissingFields(intake)
  intake.generated_summary = generateSummary(intake)
  return intake
}
