import type { ExtractedCampaignIntake, ExtractedPrize, ExtractedRegion } from './types'
import { generateSummary } from './generateSummary'

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

function parseDateDMY(s: string): string | null {
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parsePrizeLine(line: string): { qty: number; unit: number; desc: string } | null {
  const m = line.match(/(\d+)\s*x\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(.+)/i)
  if (!m) return null
  return {
    qty: parseInt(m[1], 10),
    unit: parseFloat(m[2].replace(/,/g, '')),
    desc: m[3].trim(),
  }
}

function prizeFromLine(line: string, type: 'major' | 'minor'): ExtractedPrize | null {
  const p = parsePrizeLine(line)
  if (!p) return null
  return {
    type,
    description: p.desc,
    quantity: p.qty,
    unit_value: p.unit,
    total_value: p.qty * p.unit,
  }
}

function parseRegionBlock(block: string, regionName: string): Partial<ExtractedRegion> {
  const lower = block.toLowerCase()
  const dateRange = block.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*[–\-—to]+\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
  const start = dateRange ? parseDateDMY(dateRange[1]) : null
  const end = dateRange ? parseDateDMY(dateRange[2]) : null

  let threshold: number | null = null
  const spend = block.match(/\$\s*(\d+(?:\.\d+)?)\s*or more/i)
  if (spend) threshold = parseFloat(spend[1])

  const loyalty = /rewards only|loyalty|members only|member(s)? only/i.test(block)
  const subsequent = /subsequent entries:\s*yes/i.test(lower)

  const brands: string[] = []
  const brandLine = block.match(/participating brands?[\/\s]*suppliers?[:\s]+([^\n]+)/i)
  if (brandLine) {
    brandLine[1].split(/[,;&]/).forEach(b => {
      const t = b.trim()
      if (t) brands.push(t)
    })
  }

  const prizes: ExtractedPrize[] = []
  const majorLine = block.match(/major prize[:\s]+([^\n]+)/i)
  if (majorLine) {
    const p = prizeFromLine(majorLine[1], 'major')
    if (p) prizes.push(p)
  }

  let totalPool: number | null = null
  const poolLine = block.match(/total prize value[^0-9]*([\d,]+)\s*k?/i)
  if (poolLine) {
    const raw = poolLine[1].replace(/,/g, '')
    totalPool = parseFloat(raw)
    if (/k/i.test(poolLine[0]) && totalPool < 1000) totalPool *= 1000
  }
  if (totalPool == null && prizes.length) {
    totalPool = prizes.reduce((s, p) => s + (p.total_value ?? 0), 0)
  }

  const entryLine = block.match(/entry mechanics?[:\s]+([^\n]+)/i)

  return {
    region_name: regionName,
    country: regionName === 'AU' ? 'Australia' : regionName === 'NZ' ? 'New Zealand' : null,
    start_date: start,
    end_date: end,
    entry_mechanic: entryLine?.[1]?.trim() ?? (threshold ? `Spend $${threshold} or more in a single transaction` : null),
    entry_threshold: threshold,
    purchase_requirement: 'single transaction',
    loyalty_required: regionName === 'AU' ? loyalty : null,
    participating_brands: brands,
    subsequent_entries_allowed: subsequent,
    prizes,
    major_prizes: prizes.filter(p => p.type === 'major'),
    minor_prizes: [],
    draw_type: 'random_draw',
    draw_frequency: null,
    draw_date: null,
    winner_publication_date: null,
    total_prize_value: totalPool,
    permit_flags: [],
  }
}

function splitAuNzBlocks(raw: string): { au: string; nz: string } {
  const nzIdx = raw.search(/\bNZ\b/i)
  if (nzIdx === -1) return { au: raw, nz: '' }
  const auIdx = raw.search(/\bAU\b/i)
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
  const assumptions: string[] = ['Heuristic extraction used — review all fields carefully.']

  let campaignName: string | null = null
  if (/filtration/i.test(raw)) campaignName = 'Repco Filtration Competition'
  else {
    const nameMatch = raw.match(/(?:running a|campaign)[:\s]+([^\n.]+)/i)
    if (nameMatch) campaignName = nameMatch[1].trim()
  }

  let retailer: string | null = null
  if (/repco/i.test(raw)) retailer = 'Repco'

  const { au: auBlock, nz: nzBlock } = splitAuNzBlocks(raw)
  const hasAu = /\bAU\b|australia/i.test(raw)
  const hasNz = /\bNZ\b|new zealand/i.test(raw)
  const regions: ExtractedRegion[] = []

  if (hasAu || (!hasAu && !hasNz)) {
    const partial = parseRegionBlock(hasAu ? auBlock : raw, 'AU')
    regions.push({
      region_name: 'AU',
      country: 'Australia',
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
      minor_prizes: [],
      draw_type: 'random_draw',
      draw_frequency: null,
      draw_date: null,
      winner_publication_date: null,
      total_prize_value: partial.total_prize_value ?? null,
      permit_flags: [],
    })
  }

  if (hasNz) {
    const partial = parseRegionBlock(nzBlock, 'NZ')
    regions.push({
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
      minor_prizes: [],
      draw_type: 'random_draw',
      draw_frequency: null,
      draw_date: null,
      winner_publication_date: null,
      total_prize_value: partial.total_prize_value ?? null,
      permit_flags: ['NONE_REQUIRED'],
    })
    if (regions.length > 1) {
      assumptions.push('AU and NZ split into separate region sections due to different prize pools.')
    }
  }

  const intake: ExtractedCampaignIntake = {
    raw_input: raw,
    campaign_name: campaignName,
    promoter_name: retailer,
    brand: retailer,
    retailer,
    regions,
    notes: null,
    assumptions,
    missing_fields: [],
    confidence_scores: {
      campaign_name: campaignName ? 0.65 : 0.25,
      promoter_name: retailer ? 0.75 : 0.25,
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
