/**
 * Natural-language promotional concept extraction.
 * Extracts explicitly stated facts; inferences go into assumptions only.
 */

import type { ExtractedPrize, ExtractedRegion } from './types'

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export type NlExtraction = {
  campaignName: string | null
  /** true = user stated a name; false = suggested from prize/mechanic */
  campaignNameSuggested: boolean
  brand: string | null
  retailer: string | null
  storeCount: number | null
  storeRetailer: string | null
  geography: 'AU' | 'NZ' | 'US' | null
  periodLabel: string | null
  startDate: string | null
  endDate: string | null
  entryMechanic: string | null
  purchaseRequirement: string | null
  prizes: ExtractedPrize[]
  drawFrequency: string | null
  drawType: string | null
  assumptions: string[]
  notes: string[]
}

const KNOWN_RETAILERS = [
  'Repco', 'Bunnings', 'Supercheap Auto', 'Autobarn', 'Metcash', 'Tradelink',
  'NAPA', 'BCF', 'Rebel', 'Harvey Norman', 'JB Hi-Fi', 'Woolworths', 'Coles',
  '7 Eleven', '7-Eleven',
]

/** Compact money for campaign titles: 5000 → $5k */
export function formatCompactPrize(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `$${n / 1_000_000}m`
  if (n >= 1000 && n % 1000 === 0) return `$${n / 1000}k`
  if (n >= 1000) {
    const k = Math.round(n / 100) / 10
    if (Math.abs(k * 1000 - n) < 1) return `$${k}k`
  }
  return `$${Math.round(n).toLocaleString('en-AU')}`
}

function parseCompactMoney(amount: string, suffix?: string | null): number | null {
  const n = parseFloat(amount.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const s = (suffix || '').toLowerCase()
  if (s === 'k') return n * 1000
  if (s === 'm') return n * 1_000_000
  return n
}

function extractRetailerAlias(raw: string): string | null {
  if (/7\s*[\/\-]\s*11|7[\-\s]?eleven|seven[\-\s]?eleven/i.test(raw)) return '7 Eleven'
  return null
}

const KNOWN_BRANDS = [
  'Colgate', 'Valvoline', 'Energizer', 'STEDI', 'Rheem', 'Samsung', 'Weber',
  'Ford', 'Toyota', 'Mazda', 'Holden',
]

function findNamedEntity(raw: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(raw)) return name
  }
  return null
}

function extractMonthYearPeriod(raw: string): {
  label: string | null
  start: string | null
  end: string | null
} {
  // during March 2027 / in June 2027 / throughout April 2027
  const my = raw.match(
    /\b(?:during|in|throughout|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i
  )
  if (my) {
    const month = MONTHS[my[1].toLowerCase()]
    const year = parseInt(my[2], 10)
    if (month) {
      const label = `${my[1][0].toUpperCase()}${my[1].slice(1).toLowerCase()} ${year}`
      return {
        label,
        start: `${year}-${pad2(month)}-01`,
        end: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
      }
    }
  }

  // March 2027 alone
  const bare = raw.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i
  )
  if (bare) {
    const month = MONTHS[bare[1].toLowerCase()]
    const year = parseInt(bare[2], 10)
    if (month) {
      const label = `${bare[1][0].toUpperCase()}${bare[1].slice(1).toLowerCase()} ${year}`
      return {
        label,
        start: `${year}-${pad2(month)}-01`,
        end: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
      }
    }
  }

  return { label: null, start: null, end: null }
}

function extractPrize(raw: string): ExtractedPrize | null {
  // win purchase back / instantly win their purchase back, up to $250
  if (/win\s+(?:your|their|a)?\s*purchase\s+back|purchase\s+back/i.test(raw)) {
    const cap = raw.match(/up\s+to\s+\$?\s*([\d,]+)\s*([kKmM])?/i)
    const unit = cap ? parseCompactMoney(cap[1], cap[2]) : null
    return {
      type: 'major',
      description: unit != null ? `Purchase value refunded (up to $${unit.toLocaleString('en-AU')})` : 'Purchase value refunded',
      quantity: null,
      unit_value: unit,
      total_value: unit,
    }
  }

  // chance to win / win a|an X valued at $Y
  const winMatch =
    raw.match(
      /(?:chance\s+to\s+win|win)\s+(?:a|an)\s+(.+?)(?:\s+valued\s+at|\s+worth|\s+approximately\s+valued|\.|$)/i
    ) ||
    raw.match(/win\s+\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?\b/i)

  let description: string | null = null
  let quantity: number | null = 1
  let unit_value: number | null = null

  if (winMatch && winMatch[1] && !/^[\d,]+$/.test(winMatch[1]) && !/^[kKmM]$/.test(winMatch[1])) {
    description = winMatch[1]
      .replace(/\s+valued\s+at.*$/i, '')
      .replace(/\s+worth.*$/i, '')
      .trim()
  }

  // cash prize: win $10,000 / win $5k
  const cash = raw.match(/win\s+\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?\b/i)
  if (cash && !description) {
    unit_value = parseCompactMoney(cash[1], cash[2])
    if (unit_value != null) {
      description = `$${unit_value.toLocaleString('en-AU')} cash`
    }
  }

  // prize of 5k / prize of $5,000 / a prize of 5000
  const prizeOf = raw.match(
    /prize\s+of\s+\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?\b/i
  )
  if (prizeOf) {
    const v = parseCompactMoney(prizeOf[1], prizeOf[2])
    if (v != null) {
      unit_value = unit_value ?? v
      if (!description) description = `$${v.toLocaleString('en-AU')} cash`
    }
  }

  const valueMatch =
    raw.match(/valued\s+at\s+(?:approximately\s+)?(?:AUD\s*|USD\s*)?\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/i) ||
    raw.match(/worth\s+(?:approximately\s+)?(?:AUD\s*|USD\s*)?\$?\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/i) ||
    raw.match(/approximately\s+\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/i)
  if (valueMatch) {
    unit_value = parseCompactMoney(valueMatch[1], valueMatch[2]) ?? unit_value
  }

  // bare $5k / 5k near prize/instant win context
  if (unit_value == null && /prize|instant|win/i.test(raw)) {
    const bare = raw.match(/\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])\b/) || raw.match(/\b([\d,]+)\s*([kK])\b/)
    if (bare) {
      unit_value = parseCompactMoney(bare[1], bare[2])
      if (!description && unit_value != null) {
        description = `$${unit_value.toLocaleString('en-AU')} cash`
      }
    }
  }

  // one major prize / 1 of 1
  if (/one\s+major\s+prize|1\s+of\s+1|a\s+single\s+prize/i.test(raw)) {
    quantity = 1
  }

  if (!description) return null

  // Clean trailing junk
  description = description
    .replace(/\s+will\s+have.*$/i, '')
    .replace(/\s+when\s+they.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    type: 'major',
    description,
    quantity,
    unit_value,
    total_value: unit_value != null && quantity != null ? unit_value * quantity : unit_value,
  }
}

/**
 * Build a customer-facing campaign title from extracted facts.
 * Prefer "{Retailer/Brand} {$value} {Mechanic} promotion" when enough signal exists.
 */
export function suggestCampaignName(params: {
  brand: string | null
  retailer: string | null
  prize: ExtractedPrize | null
  drawFrequency: string | null
  raw: string
}): { name: string | null; suggested: boolean } {
  const entity = params.brand || params.retailer
  const isInstant =
    /instant/i.test(params.drawFrequency ?? '') || /instant(?:ly)?\s+win/i.test(params.raw)
  const prize = params.prize
  const valuePart =
    prize?.unit_value != null && prize.unit_value > 0
      ? formatCompactPrize(prize.unit_value)
      : ''
  const desc = prize?.description?.replace(/\s*\(up to.*$/i, '').trim() || ''
  const isCashOrValuePrize =
    !desc ||
    desc.startsWith('$') ||
    /cash/i.test(desc) ||
    /^\$?\d/i.test(desc)

  if (desc && /purchase\s+value\s+refunded/i.test(desc)) {
    return {
      name: entity ? `${entity} Win Your Purchase Back` : 'Win Your Purchase Back',
      suggested: true,
    }
  }

  // Product prizes: "Win a Ford Ranger Raptor"
  if (desc && !isCashOrValuePrize) {
    const titled = desc.match(/^(a|an)\s+/i) ? `Win ${desc}` : `Win a ${desc}`
    return { name: titled, suggested: true }
  }

  // Cash / value-led: e.g. 7 Eleven $5k Instant Win promotion
  if (entity && valuePart && isInstant) {
    return { name: `${entity} ${valuePart} Instant Win promotion`, suggested: true }
  }

  if (entity && valuePart) {
    return {
      name: `${entity} ${valuePart} ${isInstant ? 'Instant Win' : 'Prize'} promotion`,
      suggested: true,
    }
  }

  if (entity && isInstant) {
    return { name: `${entity} Instant Win promotion`, suggested: true }
  }

  if (valuePart) {
    return {
      name: isInstant
        ? `${valuePart} Instant Win promotion`
        : `Win ${valuePart}`,
      suggested: true,
    }
  }

  if (entity) {
    return { name: `${entity} promotion`, suggested: true }
  }

  if (isInstant) {
    return { name: 'Instant Win promotion', suggested: true }
  }

  return { name: null, suggested: false }
}

function extractStores(raw: string): { count: number | null; retailer: string | null } {
  // 200 Repco stores / 150 stores
  const withRetailer = raw.match(/(\d[\d,]*)\s+([A-Za-z][A-Za-z0-9&' -]{1,40}?)\s+stores?\b/i)
  if (withRetailer) {
    return {
      count: parseInt(withRetailer[1].replace(/,/g, ''), 10),
      retailer: withRetailer[2].trim(),
    }
  }
  const countOnly = raw.match(/(\d[\d,]*)\s+stores?\b/i)
  if (countOnly) {
    return { count: parseInt(countOnly[1].replace(/,/g, ''), 10), retailer: null }
  }
  return { count: null, retailer: null }
}

function extractEntry(raw: string): { mechanic: string | null; purchase: string | null } {
  if (/purchase\s+selected\s+products/i.test(raw)) {
    return {
      mechanic: 'Purchase selected products',
      purchase: 'Purchase selected products',
    }
  }
  if (/purchase\s+concrete/i.test(raw)) {
    return {
      mechanic: 'Purchase concrete (trade account)',
      purchase: 'Purchase concrete',
    }
  }
  if (/customers?\s+(?:who\s+)?purchas/i.test(raw) || /when\s+they\s+purchase/i.test(raw)) {
    const m = raw.match(/(?:who\s+|when\s+they\s+)?purchas(?:e|ing)\s+([^.]+?)(?:\s+will|\s+can|\.|$)/i)
    return {
      mechanic: m ? `Purchase ${m[1].trim()}` : 'Purchase required',
      purchase: m ? `Purchase ${m[1].trim()}` : 'Purchase required',
    }
  }
  if (/spend\s+\$?\s*([\d,]+)/i.test(raw)) {
    const m = raw.match(/spend\s+\$?\s*([\d,]+)/i)
    return {
      mechanic: m ? `Spend $${m[1]} or more` : 'Spend threshold',
      purchase: m ? `Spend $${m[1]}` : null,
    }
  }
  return { mechanic: null, purchase: null }
}

function extractDrawFrequency(raw: string): string | null {
  if (/one\s+major\s+(?:prize\s+)?draw\s+at\s+the\s+end|draw\s+at\s+the\s+(?:end|conclusion)|single\s+draw\s+at\s+(?:the\s+)?end/i.test(raw)) {
    return 'single_draw_at_conclusion'
  }
  if (/instant(?:ly)?\s+win/i.test(raw)) return 'instant_win'
  if (/daily\s+draw/i.test(raw)) return 'daily'
  if (/weekly\s+draw/i.test(raw)) return 'weekly'
  return null
}

export function extractFromNaturalLanguage(raw: string): NlExtraction {
  const assumptions: string[] = []
  const notes: string[] = []

  const stores = extractStores(raw)
  const period = extractMonthYearPeriod(raw)
  const prize = extractPrize(raw)
  const entry = extractEntry(raw)
  const drawFrequency = extractDrawFrequency(raw)

  let geography: 'AU' | 'NZ' | 'US' | null = null
  if (/\baustralia\b|\bAU\b/i.test(raw)) geography = 'AU'
  else if (/\bnew zealand\b|\bNZ\b/i.test(raw)) geography = 'NZ'
  else if (/\bunited states\b|\bUSA\b|\bU\.S\.A\.?\b|\bUS\b|\bhere in the us\b/i.test(raw)) {
    geography = 'US'
  }

  // Retailer: aliases (7/11), "X stores", or known retailer list — not invent brand from retailer
  let retailer =
    extractRetailerAlias(raw) ||
    stores.retailer ||
    findNamedEntity(raw, KNOWN_RETAILERS)

  // Brand: "X customers" or known brand — distinct from retailer
  let brand: string | null = null
  const brandCustomers = raw.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+customers?\b/)
  if (brandCustomers) {
    brand = brandCustomers[1]
  } else {
    brand = findNamedEntity(raw, KNOWN_BRANDS)
    // Don't treat Ford as brand when prize is Ford Ranger (vehicle prize, not brand promo)
    if (brand === 'Ford' && /ford\s+ranger|raptor/i.test(raw)) brand = null
  }

  // If retailer from stores matches a known brand word only used as store chain, keep as retailer
  if (retailer && brand && retailer.toLowerCase() === brand.toLowerCase()) {
    // e.g. only one entity mentioned as stores — treat as retailer, clear brand
    if (/\bstores?\b/i.test(raw)) brand = null
  }

  const suggested = suggestCampaignName({
    brand,
    retailer,
    prize,
    drawFrequency,
    raw,
  })
  const campaignName = suggested.name
  const campaignNameSuggested = suggested.suggested

  if (stores.count != null) {
    notes.push(
      stores.retailer
        ? `Participating locations: ${stores.count} ${stores.retailer} stores`
        : `Participating locations: ${stores.count} stores`
    )
  }
  if (period.label) {
    notes.push(`Promotional period: ${period.label}`)
  }

  const prizes = prize ? [prize] : []

  return {
    campaignName,
    campaignNameSuggested,
    brand,
    retailer,
    storeCount: stores.count,
    storeRetailer: stores.retailer,
    geography,
    periodLabel: period.label,
    startDate: period.start,
    endDate: period.end,
    entryMechanic: entry.mechanic,
    purchaseRequirement: entry.purchase,
    prizes,
    drawFrequency,
    drawType: /instant/i.test(drawFrequency ?? '') ? 'instant_win' : prizes.length ? 'random_draw' : null,
    assumptions,
    notes,
  }
}

export function applyNlExtractionToRegion(
  region: ExtractedRegion,
  nl: NlExtraction
): ExtractedRegion {
  const out: ExtractedRegion = {
    ...region,
    prizes: region.prizes.length ? region.prizes : nl.prizes,
    major_prizes: region.major_prizes.length ? region.major_prizes : nl.prizes.filter((p) => p.type === 'major'),
  }

  if (!out.start_date && nl.startDate) out.start_date = nl.startDate
  if (!out.end_date && nl.endDate) out.end_date = nl.endDate
  if (!out.entry_mechanic && nl.entryMechanic) out.entry_mechanic = nl.entryMechanic
  if (!out.purchase_requirement && nl.purchaseRequirement) {
    out.purchase_requirement = nl.purchaseRequirement
  }
  if (!out.draw_frequency && nl.drawFrequency) out.draw_frequency = nl.drawFrequency
  if (!out.draw_type && nl.drawType) out.draw_type = nl.drawType
  if (out.total_prize_value == null && nl.prizes[0]?.total_value != null) {
    out.total_prize_value = nl.prizes[0].total_value
  }
  if (nl.geography === 'AU') {
    out.region_name = 'AU'
    out.country = 'Australia'
  } else if (nl.geography === 'NZ') {
    out.region_name = 'NZ'
    out.country = 'New Zealand'
  } else if (nl.geography === 'US') {
    out.region_name = 'US'
    out.country = 'United States'
  }

  return out
}

/** Structured brief markers — if present, prefer line parsers over NL enrichment. */
export function looksLikeStructuredBrief(raw: string): boolean {
  return (
    /^\s*major\s+prizes?\s*:/im.test(raw) ||
    /^\s*entry\s+mechanics?\s*:/im.test(raw) ||
    /^\s*dates?\s*:/im.test(raw) ||
    /^\s*prize\s+value\s*:/im.test(raw)
  )
}
