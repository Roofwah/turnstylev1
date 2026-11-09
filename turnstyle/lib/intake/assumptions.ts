import type { ExtractedCampaignIntake, ExtractedRegion, PermitFlag } from './types'

const ACT_THRESHOLD = 3000
const SA_THRESHOLD = 5000
const NSW_THRESHOLD = 10000

function parseIsoDate(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  if (!d) return iso
  d.setDate(d.getDate() + days)
  return formatIso(d)
}

function computePermitFlags(region: ExtractedRegion): PermitFlag[] {
  const pool =
    region.total_prize_value ??
    region.prizes.reduce((s, p) => s + (p.total_value ?? (p.quantity ?? 0) * (p.unit_value ?? 0)), 0)

  const isAu =
    region.region_name.toUpperCase() === 'AU' ||
    region.region_name.toUpperCase() === 'AUSTRALIA' ||
    region.country?.toUpperCase() === 'AU'

  if (!isAu || pool <= 0) return ['NONE_REQUIRED']

  const flags: PermitFlag[] = []
  if (pool >= ACT_THRESHOLD) flags.push('ACT_REVIEW')
  if (pool >= SA_THRESHOLD) flags.push('SA_REVIEW')
  if (pool >= NSW_THRESHOLD) flags.push('NSW_REVIEW')
  return flags.length ? flags : ['NONE_REQUIRED']
}

function applyRegionAssumptions(region: ExtractedRegion, assumptions: string[]): ExtractedRegion {
  const out: ExtractedRegion = {
    ...region,
    prizes: region.prizes.map(p => ({ ...p })),
    major_prizes: region.major_prizes.map(p => ({ ...p })),
    minor_prizes: region.minor_prizes.map(p => ({ ...p })),
  }

  if (!out.draw_date && out.end_date) {
    out.draw_date = addDays(out.end_date, 8)
    assumptions.push(`${out.region_name}: Draw date assumed as end date + 8 days (${out.draw_date}).`)
  }

  if (!out.winner_publication_date && out.draw_date) {
    out.winner_publication_date = addDays(out.draw_date, 3)
    assumptions.push(`${out.region_name}: Winner publication assumed as draw date + 3 days (${out.winner_publication_date}).`)
  }

  if (out.subsequent_entries_allowed === true) {
    assumptions.push(
      `${out.region_name}: Subsequent entries allowed — multiple entries per qualifying transaction assumed unless stated otherwise.`
    )
  }

  if (out.loyalty_required === true) {
    assumptions.push(`${out.region_name}: Loyalty membership required for entry (e.g. Repco Rewards).`)
  }

  for (const p of out.prizes) {
    if (p.quantity != null && p.unit_value != null) {
      const calc = p.quantity * p.unit_value
      if (p.total_value == null) p.total_value = calc
      else if (Math.abs(p.total_value - calc) > 1) {
        assumptions.push(
          `${out.region_name}: Stated total for "${p.description}" (${p.total_value}) differs from qty × value (${calc}).`
        )
      }
    }
  }

  const poolFromPrizes = out.prizes.reduce(
    (s, p) => s + (p.total_value ?? (p.quantity ?? 0) * (p.unit_value ?? 0)),
    0
  )
  if (poolFromPrizes > 0) {
    if (out.total_prize_value == null) out.total_prize_value = poolFromPrizes
    else if (Math.abs(out.total_prize_value - poolFromPrizes) > 1) {
      assumptions.push(
        `${out.region_name}: Stated prize pool (${out.total_prize_value}) differs from calculated (${poolFromPrizes}).`
      )
    }
  }

  out.permit_flags = computePermitFlags(out)
  const reviewFlags = out.permit_flags.filter(f => f !== 'NONE_REQUIRED')
  if (reviewFlags.length) {
    assumptions.push(`${out.region_name}: Permit review flagged — ${reviewFlags.join(', ')}.`)
  }

  if (!out.draw_frequency && out.prizes.length > 0 && out.draw_type === 'random_draw') {
    out.draw_frequency = 'single_draw'
    assumptions.push(`${out.region_name}: Draw frequency not stated — assumed single draw at conclusion.`)
  }

  return out
}

export function applyTurnstyleAssumptions(intake: ExtractedCampaignIntake): ExtractedCampaignIntake {
  const assumptions = [...intake.assumptions]
  const regions = intake.regions.map(r => applyRegionAssumptions(r, assumptions))
  return { ...intake, regions, assumptions: [...new Set(assumptions)] }
}

export function collectMissingFields(intake: ExtractedCampaignIntake): string[] {
  const missing: string[] = []
  if (!intake.campaign_name) missing.push('campaign_name')
  if (!intake.promoter_name && !intake.retailer) missing.push('promoter_name')
  if (intake.regions.length === 0) missing.push('regions')

  for (const r of intake.regions) {
    const prefix = r.region_name
    if (!r.start_date) missing.push(`${prefix}.start_date`)
    if (!r.end_date) missing.push(`${prefix}.end_date`)
    if (!r.entry_mechanic && !r.purchase_requirement) missing.push(`${prefix}.entry_mechanic`)
    // Threshold only required when spend amount is the entry mechanic
    if (r.entry_mechanic && /spend|\$/i.test(r.entry_mechanic) && r.entry_threshold == null) {
      missing.push(`${prefix}.entry_threshold`)
    }
    if (r.prizes.length === 0) missing.push(`${prefix}.prizes`)
  }

  return missing
}
