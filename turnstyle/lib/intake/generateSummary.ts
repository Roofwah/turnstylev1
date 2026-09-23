import type { ExtractedCampaignIntake } from './types'

function formatDisplayDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

export function generateSummary(intake: ExtractedCampaignIntake): string {
  const name = intake.campaign_name ?? intake.retailer ?? 'The promoter'
  const retailer = intake.retailer ?? intake.promoter_name ?? 'the retailer'

  if (intake.regions.length === 0) {
    return `${name}: insufficient detail extracted to generate a summary. Please review and complete missing fields.`
  }

  const parts: string[] = []
  const regionNames = intake.regions.map(r => r.region_name).join(' and ')
  const first = intake.regions[0]
  const dates =
    first.start_date && first.end_date
      ? `from ${formatDisplayDate(first.start_date)} to ${formatDisplayDate(first.end_date)}`
      : 'during the promotional period'

  parts.push(`${retailer} is running ${intake.campaign_name ?? 'a promotion'} across ${regionNames} ${dates}.`)

  for (const r of intake.regions) {
    const threshold = r.entry_threshold != null ? `$${r.entry_threshold}` : 'the qualifying spend amount'
    const brands = r.participating_brands.length > 0 ? r.participating_brands.join(', ') : 'participating branded products'

    parts.push(
      `In ${r.region_name}, eligible customers who spend ${threshold} or more in a single transaction on ${brands} during the promotional period will receive an entry into the draw.`
    )

    if (r.loyalty_required) parts.push(`${r.region_name}: loyalty membership is required for entry.`)

    const major = r.major_prizes.length ? r.major_prizes : r.prizes.filter(p => p.type === 'major')
    if (major.length > 0) {
      const prizeParts = major.map(p => {
        const q = p.quantity ?? '?'
        const u = p.unit_value != null ? formatMoney(p.unit_value) : '?'
        const t = p.total_value != null ? formatMoney(p.total_value) : '?'
        return `${q} x ${u} ${p.description}, total value ${t}`
      })
      parts.push(`The ${r.region_name} prize pool comprises ${prizeParts.join('; ')}.`)
    } else if (r.total_prize_value != null) {
      parts.push(`The ${r.region_name} total prize pool is ${formatMoney(r.total_prize_value)}.`)
    }
  }

  return parts.join(' ')
}
