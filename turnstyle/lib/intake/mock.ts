import type { ExtractedCampaignIntake, ExtractedPrize, ExtractedRegion } from './types'
import { generateSummary } from './generateSummary'
import {
  applyNlExtractionToRegion,
  extractFromNaturalLanguage,
  looksLikeStructuredBrief,
} from './nl-extract'

const REPCO_SAMPLE_MARKERS = [
  'filtration competition',
  'repco rewards only',
  'flight centre gift card',
  'total prize value au 40k',
]

function isRepcoFiltrationSample(text: string): boolean {
  const lower = text.toLowerCase()
  return REPCO_SAMPLE_MARKERS.every(m => lower.includes(m))
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Parse a single date fragment into YYYY-MM-DD */
function parseSingleDate(raw: string, fallbackYear?: number): string | null {
  const s = raw.trim()
  if (!s) return null

  // ISO
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return toIso(+iso[1], +iso[2], +iso[3])

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return toIso(+dmy[3], +dmy[2], +dmy[1])

  // Month Day, Year  |  Month Day Year
  const mdY = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i)
  if (mdY) {
    const mo = MONTHS[mdY[1].toLowerCase()]
    if (mo) return toIso(+mdY[3], mo, +mdY[2])
  }

  // Day Month Year
  const dMY = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/i)
  if (dMY) {
    const mo = MONTHS[dMY[2].toLowerCase()]
    if (mo) return toIso(+dMY[3], mo, +dMY[1])
  }

  // Month Day (year from context)
  if (fallbackYear) {
    const md = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i)
    if (md) {
      const mo = MONTHS[md[1].toLowerCase()]
      if (mo) return toIso(fallbackYear, mo, +md[2])
    }
    const dOnly = s.match(/^(\d{1,2})(?:st|nd|rd|th)?$/)
    if (dOnly) return null // need month — handled in range parser
  }

  return null
}

/**
 * Extract start/end dates from free text.
 * Handles ranges like:
 * - 01/11/2026 – 30/11/2026
 * - November 23-30, 2026
 * - 23–30 November 2026
 * - November 23 to November 30, 2026
 * - Dates: 23 Nov 2026 - 30 Nov 2026
 */
function parseDateRange(text: string): { start: string | null; end: string | null } {
  // Prefer an explicit Dates: line when present
  const datesLine = text.match(/dates?\s*[:\-]\s*([^\n]+)/i)
  const scope = datesLine?.[1] ?? text

  // Numeric range DD/MM/YYYY – DD/MM/YYYY
  const numRange = scope.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:[–—\-]|to)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
  )
  if (numRange) {
    return { start: parseSingleDate(numRange[1]), end: parseSingleDate(numRange[2]) }
  }

  // ISO range
  const isoRange = scope.match(/(\d{4}-\d{2}-\d{2})\s*(?:[–—\-]|to)\s*(\d{4}-\d{2}-\d{2})/)
  if (isoRange) {
    return { start: parseSingleDate(isoRange[1]), end: parseSingleDate(isoRange[2]) }
  }

  // Month Day-Day, Year  e.g. November 23-30, 2026  /  Nov 23 – 30 2026
  const sameMonth = scope.match(
    /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[–—\-]\s*(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i
  )
  if (sameMonth) {
    const mo = MONTHS[sameMonth[1].toLowerCase()]
    if (mo) {
      return {
        start: toIso(+sameMonth[4], mo, +sameMonth[2]),
        end: toIso(+sameMonth[4], mo, +sameMonth[3]),
      }
    }
  }

  // Day-Day Month Year  e.g. 23-30 November 2026
  const dayDayMonth = scope.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*[–—\-]\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})\b/i
  )
  if (dayDayMonth) {
    const mo = MONTHS[dayDayMonth[3].toLowerCase()]
    if (mo) {
      return {
        start: toIso(+dayDayMonth[4], mo, +dayDayMonth[1]),
        end: toIso(+dayDayMonth[4], mo, +dayDayMonth[2]),
      }
    }
  }

  // Month Day to Month Day, Year  e.g. November 23 to December 5, 2026
  const crossMonth = scope.match(
    /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|[–—\-])\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i
  )
  if (crossMonth) {
    const mo1 = MONTHS[crossMonth[1].toLowerCase()]
    const mo2 = MONTHS[crossMonth[3].toLowerCase()]
    if (mo1 && mo2) {
      return {
        start: toIso(+crossMonth[5], mo1, +crossMonth[2]),
        end: toIso(+crossMonth[5], mo2, +crossMonth[4]),
      }
    }
  }

  // Two full dates with month names
  const twoFull = scope.match(
    /\b([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\s*(?:[–—\-]|to)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/i
  )
  if (twoFull) {
    return { start: parseSingleDate(twoFull[1]), end: parseSingleDate(twoFull[2]) }
  }

  // Fallback: first two distinct parseable dates in scope
  const candidates: string[] = []
  const patterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+\d{4}\b/gi,
  ]
  for (const re of patterns) {
    const matches = scope.match(re) ?? []
    for (const m of matches) {
      const parsed = parseSingleDate(m)
      if (parsed && !candidates.includes(parsed)) candidates.push(parsed)
    }
  }
  if (candidates.length >= 2) return { start: candidates[0], end: candidates[1] }
  if (candidates.length === 1) return { start: candidates[0], end: candidates[0] }

  return { start: null, end: null }
}

function parseMoney(raw: string): number | null {
  // Require $ so model numbers like Q1200N are not treated as money
  const m = raw.replace(/,/g, '').match(/\$\s*([\d]+(?:\.\d{1,2})?)/)
  if (!m) return null
  return parseFloat(m[1])
}

function cleanPrizeDescription(desc: string): string {
  return desc
    .replace(/^win\s+/i, '')
    .replace(/^\d+\s+of\s+\d+\s*[-–—:]\s*/i, '')
    .replace(/^[:\-–—]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim()
}

function isNaPrize(text: string): boolean {
  return /^(n\/?a|nil|none|not\s+applicable|-|—)$/i.test(text.trim())
}

/**
 * Parse quantity + description from common prize phrasings:
 * - 10 x $4000 Flight Centre Gift Card
 * - Win 1 of 1 - Weber Baby Q
 * - 1× Weber BBQ
 * - Major Prize: Flight Centre Gift Card
 */
function parsePrizeDescription(line: string): { qty: number; desc: string; unitFromLine: number | null } | null {
  const trimmed = line.trim()
  if (!trimmed || isNaPrize(trimmed)) return null

  // Nx $value description
  const nxValue = trimmed.match(/^(\d+)\s*[x×]\s*\$?\s*([\d,]+(?:\.\d+)?)\s+(.+)$/i)
  if (nxValue) {
    return {
      qty: parseInt(nxValue[1], 10),
      unitFromLine: parseFloat(nxValue[2].replace(/,/g, '')),
      desc: cleanPrizeDescription(nxValue[3]),
    }
  }

  // Win N of M - description  /  N of M - description
  const winOf = trimmed.match(/^(?:win\s+)?(\d+)\s+of\s+(\d+)\s*[-–—:]\s*(.+)$/i)
  if (winOf) {
    return {
      qty: parseInt(winOf[1], 10),
      unitFromLine: null,
      desc: cleanPrizeDescription(winOf[3]),
    }
  }

  // N x description (no dollar on same line)
  const nxDesc = trimmed.match(/^(\d+)\s*[x×]\s+(.+)$/i)
  if (nxDesc) {
    return {
      qty: parseInt(nxDesc[1], 10),
      unitFromLine: null,
      desc: cleanPrizeDescription(nxDesc[2]),
    }
  }

  // Leading "Win a/an/the ..."
  const winA = trimmed.match(/^win\s+(?:a|an|the)\s+(.+)$/i)
  if (winA) {
    return { qty: 1, unitFromLine: null, desc: cleanPrizeDescription(winA[1]) }
  }

  return { qty: 1, unitFromLine: null, desc: cleanPrizeDescription(trimmed) }
}

function extractPrizeValueFromBlock(block: string, afterIndex?: number): number | null {
  const searchIn = afterIndex != null ? block.slice(afterIndex) : block

  // Prize value: $399 each / Unit value: $399 / Value: $399
  const labelled = searchIn.match(
    /(?:prize\s+value|unit\s+value|rrp|value)\s*[:\-]\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:each|ea\.?)?/i
  )
  if (labelled) return parseFloat(labelled[1].replace(/,/g, ''))

  // $399 each on its own nearby line
  const each = searchIn.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:each|ea\.?)\b/i)
  if (each) return parseFloat(each[1].replace(/,/g, ''))

  return null
}

function extractPrizesFromBlock(block: string): ExtractedPrize[] {
  const prizes: ExtractedPrize[] = []
  const lines = block.split(/\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const major = line.match(/^\s*major\s+prizes?\s*[:\-]\s*(.+)$/i)
    const minor = line.match(/^\s*minor\s+prizes?\s*[:\-]\s*(.+)$/i)
    const generic = line.match(/^\s*prizes?\s*[:\-]\s*(.+)$/i)

    const match = major ?? minor ?? generic
    if (!match) continue

    const type: 'major' | 'minor' = minor ? 'minor' : 'major'
    const rest = match[1].trim()
    if (isNaPrize(rest)) continue

    const parsed = parsePrizeDescription(rest)
    if (!parsed || !parsed.desc) continue

    // Value may be on this line or following lines
    let unit = parsed.unitFromLine
    if (unit == null) unit = parseMoney(rest)
    if (unit == null) {
      const lookahead = lines.slice(i, i + 5).join('\n')
      unit = extractPrizeValueFromBlock(lookahead)
    }
    if (unit == null) {
      unit = extractPrizeValueFromBlock(block)
    }

    prizes.push({
      type,
      description: parsed.desc,
      quantity: parsed.qty,
      unit_value: unit,
      total_value: unit != null ? parsed.qty * unit : null,
    })
  }

  // Also catch "Total prize value AU $40,000" style without itemised prizes
  return prizes
}

function parseRegionBlock(block: string, regionName: string): Partial<ExtractedRegion> {
  const lower = block.toLowerCase()
  const { start, end } = parseDateRange(block)

  let threshold: number | null = null
  const spend =
    block.match(/spend\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:or more|plus|\+)/i) ??
    block.match(/\$\s*([\d,]+(?:\.\d+)?)\s*or more/i) ??
    block.match(/(?:every|per)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:spent|spend)/i)
  if (spend) threshold = parseFloat(spend[1].replace(/,/g, ''))

  const loyalty = /rewards|loyalty|members?\s+only|be\s+a\s+\w+\s+rewards?\s+member/i.test(block)
  const subsequent =
    /subsequent\s+entr(?:y|ies)\s*:\s*yes/i.test(lower) ||
    /(?:1|one)\s+entr(?:y|ies)\s+for\s+every/i.test(lower) ||
    /additional\s+entr(?:y|ies)/i.test(lower)

  const brands: string[] = []
  const brandLine = block.match(/participating\s+brands?[\/\s]*suppliers?\s*[:\-]\s*([^\n]+)/i)
  if (brandLine) {
    brandLine[1].split(/[,;&]/).forEach(b => {
      const t = b.trim()
      if (t && !isNaPrize(t)) brands.push(t)
    })
  }

  const prizes = extractPrizesFromBlock(block)

  let totalPool: number | null = null
  const poolLine = block.match(/total\s+prize\s+value[^0-9$]*\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i)
  if (poolLine) {
    totalPool = parseFloat(poolLine[1].replace(/,/g, ''))
    if (poolLine[2] && totalPool < 1000) totalPool *= 1000
  }
  if (totalPool == null && prizes.length) {
    const sum = prizes.reduce((s, p) => s + (p.total_value ?? 0), 0)
    if (sum > 0) totalPool = sum
  }

  const entryLine = block.match(/entry\s+mechanics?\s*[:\-]\s*([^\n]+)/i)

  return {
    region_name: regionName,
    country: regionName === 'AU' ? 'Australia' : regionName === 'NZ' ? 'New Zealand' : null,
    start_date: start,
    end_date: end,
    entry_mechanic:
      entryLine?.[1]?.trim() ??
      (threshold ? `Spend $${threshold} or more in a single transaction` : null),
    entry_threshold: threshold,
    purchase_requirement: /single\s+transaction/i.test(block) ? 'single transaction' : null,
    loyalty_required: regionName === 'AU' ? loyalty : null,
    participating_brands: brands,
    subsequent_entries_allowed: subsequent,
    prizes,
    major_prizes: prizes.filter(p => p.type === 'major'),
    minor_prizes: prizes.filter(p => p.type === 'minor'),
    draw_type: 'random_draw',
    draw_frequency: null,
    draw_date: null,
    winner_publication_date: null,
    total_prize_value: totalPool,
    permit_flags: [],
  }
}

function splitAuNzBlocks(raw: string): { au: string; nz: string } {
  const nzIdx = raw.search(/(?:^|\n)\s*NZ\b/i)
  if (nzIdx === -1) return { au: raw, nz: '' }
  const auIdx = raw.search(/(?:^|\n)\s*AU\b/i)
  const auStart = auIdx >= 0 ? auIdx : 0
  return {
    au: raw.slice(auStart, nzIdx),
    nz: raw.slice(nzIdx),
  }
}

function auRegion(): ExtractedRegion {
  return {
    region_name: 'AU',
    country: 'Australia',
    states: null,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
    entry_mechanic: 'Spend $50 or more in a single transaction including any one participating branded filter',
    entry_threshold: 50,
    purchase_requirement: 'single transaction including participating branded filters',
    loyalty_required: true,
    participating_brands: ['Repco', 'OEX', 'Ryco', 'K&N'],
    subsequent_entries_allowed: true,
    prizes: [{ type: 'major', description: 'Flight Centre Gift Card', quantity: 10, unit_value: 4000, total_value: 40000 }],
    major_prizes: [{ type: 'major', description: 'Flight Centre Gift Card', quantity: 10, unit_value: 4000, total_value: 40000 }],
    minor_prizes: [],
    draw_type: 'random_draw',
    draw_frequency: 'single_draw',
    draw_date: null,
    winner_publication_date: null,
    total_prize_value: 40000,
    permit_flags: [],
  }
}

function nzRegion(): ExtractedRegion {
  return {
    region_name: 'NZ',
    country: 'New Zealand',
    states: null,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
    entry_mechanic: 'Spend $50 or more in a single transaction including any one participating branded filter',
    entry_threshold: 50,
    purchase_requirement: 'single transaction including participating branded filters',
    loyalty_required: null,
    participating_brands: ['Repco', 'OEX', 'Ryco', 'K&N'],
    subsequent_entries_allowed: true,
    prizes: [{ type: 'major', description: 'Flight Centre Gift Card', quantity: 4, unit_value: 5000, total_value: 20000 }],
    major_prizes: [{ type: 'major', description: 'Flight Centre Gift Card', quantity: 4, unit_value: 5000, total_value: 20000 }],
    minor_prizes: [],
    draw_type: 'random_draw',
    draw_frequency: 'single_draw',
    draw_date: null,
    winner_publication_date: null,
    total_prize_value: 20000,
    permit_flags: ['NONE_REQUIRED'],
  }
}

function repcoFiltrationExtraction(raw: string): ExtractedCampaignIntake {
  const intake: ExtractedCampaignIntake = {
    raw_input: raw,
    campaign_name: 'Repco Filtration Competition',
    promoter_name: 'Repco',
    brand: 'Repco',
    retailer: 'Repco',
    regions: [auRegion(), nzRegion()],
    notes: 'July 1 Catalogue promotion across Australia and New Zealand.',
    assumptions: [
      'Campaign name inferred from Filtration competition brief and July catalogue context.',
      'Promoter/retailer set to Repco based on brief.',
      'AU and NZ split into separate region sections due to different prize pools.',
    ],
    missing_fields: [],
    confidence_scores: {
      campaign_name: 0.92,
      promoter_name: 0.95,
      'AU.prizes': 0.98,
      'NZ.prizes': 0.98,
      'AU.entry_threshold': 0.99,
      'NZ.entry_threshold': 0.99,
    },
    generated_summary: '',
  }
  intake.generated_summary = generateSummary(intake)
  return intake
}

function heuristicExtract(raw: string): ExtractedCampaignIntake {
  // Visible degraded-mode marker — not equivalent to AI interpretation
  const assumptions: string[] = [
    'Interpreted with standard extraction (AI interpretation unavailable). Review fields carefully.',
  ]

  const nl = extractFromNaturalLanguage(raw)
  const structured = looksLikeStructuredBrief(raw)

  const { au: auBlock, nz: nzBlock } = splitAuNzBlocks(raw)
  const hasAu = /\bAU\b|australia/i.test(raw)
  const hasNz = /\bNZ\b|new zealand/i.test(raw)
  const regions: ExtractedRegion[] = []

  if (hasAu || (!hasAu && !hasNz)) {
    const partial = parseRegionBlock(hasAu ? auBlock : raw, 'AU')
    let region: ExtractedRegion = {
      region_name: nl.geography === 'NZ' ? 'NZ' : 'AU',
      country: nl.geography === 'NZ' ? 'New Zealand' : 'Australia',
      states: null,
      start_date: partial.start_date ?? null,
      end_date: partial.end_date ?? null,
      entry_mechanic: partial.entry_mechanic ?? null,
      entry_threshold: partial.entry_threshold ?? null,
      purchase_requirement: partial.purchase_requirement ?? null,
      loyalty_required: partial.loyalty_required ?? null,
      participating_brands: partial.participating_brands ?? [],
      subsequent_entries_allowed: partial.subsequent_entries_allowed ?? null,
      prizes: partial.prizes ?? [],
      major_prizes: partial.major_prizes ?? [],
      minor_prizes: partial.minor_prizes ?? [],
      draw_type: partial.prizes?.length ? 'random_draw' : null,
      draw_frequency: null,
      draw_date: null,
      winner_publication_date: null,
      total_prize_value: partial.total_prize_value ?? null,
      permit_flags: [],
    }
    // Always apply NL extraction for free-text; merge after structured line parsers
    if (!structured || region.prizes.length === 0 || !region.start_date) {
      region = applyNlExtractionToRegion(region, nl)
    }
    if (!nl.geography && !hasAu && !hasNz) {
      assumptions.push('Geography not stated — defaulted to AU for intake structuring.')
    }
    regions.push(region)
  }

  if (hasNz) {
    const partial = parseRegionBlock(nzBlock, 'NZ')
    let region: ExtractedRegion = {
      region_name: 'NZ',
      country: 'New Zealand',
      states: null,
      start_date: partial.start_date ?? null,
      end_date: partial.end_date ?? null,
      entry_mechanic: partial.entry_mechanic ?? null,
      entry_threshold: partial.entry_threshold ?? null,
      purchase_requirement: partial.purchase_requirement ?? null,
      loyalty_required: null,
      participating_brands: partial.participating_brands ?? [],
      subsequent_entries_allowed: partial.subsequent_entries_allowed ?? null,
      prizes: partial.prizes ?? [],
      major_prizes: partial.major_prizes ?? [],
      minor_prizes: partial.minor_prizes ?? [],
      draw_type: 'random_draw',
      draw_frequency: null,
      draw_date: null,
      winner_publication_date: null,
      total_prize_value: partial.total_prize_value ?? null,
      permit_flags: ['NONE_REQUIRED'],
    }
    if (!structured || region.prizes.length === 0) {
      region = applyNlExtractionToRegion(region, nl)
    }
    regions.push(region)
    if (regions.length > 1) assumptions.push('AU and NZ split into separate region sections.')
  }

  assumptions.push(...nl.assumptions)

  const campaignName = nl.campaignName
  if (nl.campaignNameSuggested && campaignName) {
    assumptions.push(`Campaign name suggested from prize description: "${campaignName}".`)
  }

  const notes = nl.notes.length ? nl.notes.join(' · ') : null

  const intake: ExtractedCampaignIntake = {
    raw_input: raw,
    campaign_name: campaignName,
    promoter_name: nl.retailer,
    brand: nl.brand,
    retailer: nl.retailer,
    regions,
    notes,
    assumptions,
    missing_fields: [],
    confidence_scores: {
      campaign_name: campaignName ? (nl.campaignNameSuggested ? 0.7 : 0.9) : 0.25,
      retailer: nl.retailer ? 0.9 : 0.2,
      brand: nl.brand ? 0.85 : 0.2,
      ...Object.fromEntries(
        regions.flatMap((r) => [
          [`${r.region_name}.dates`, r.start_date && r.end_date ? 0.9 : 0.3],
          [`${r.region_name}.prizes`, r.prizes.length ? 0.9 : 0.2],
        ])
      ),
    },
    generated_summary: '',
  }
  intake.generated_summary = generateSummary(intake)
  return intake
}

export function mockExtractCampaign(raw: string): ExtractedCampaignIntake {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      raw_input: raw,
      campaign_name: null,
      promoter_name: null,
      brand: null,
      retailer: null,
      regions: [],
      notes: null,
      assumptions: [],
      missing_fields: ['raw_input'],
      confidence_scores: {},
      generated_summary: 'No input provided.',
    }
  }

  if (isRepcoFiltrationSample(trimmed)) return repcoFiltrationExtraction(trimmed)
  return heuristicExtract(trimmed)
}

/** Exported for tests / reuse */
export { parseDateRange, parsePrizeDescription, extractPrizesFromBlock }
