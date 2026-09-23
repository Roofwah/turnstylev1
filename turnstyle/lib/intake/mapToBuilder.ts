import type { CampaignBuilderPrefill, ExtractedCampaignIntake, ExtractedRegion } from './types'

function regionToBuilderRegions(region: ExtractedRegion): string[] {
  const code = region.region_name.toUpperCase()
  if (code === 'AU' || code === 'AUSTRALIA') return ['national_au']
  if (code === 'NZ') return ['NZ']
  if (code === 'USA') return ['USA']
  if (code === 'EU') return ['EU']
  return ['national_au']
}

function regionPrizes(region: ExtractedRegion) {
  const source = region.prizes.length ? region.prizes : region.major_prizes
  return source.map((p, i) => ({
    tier: i === 0 ? '1st' : `${i + 1}`,
    description: p.description,
    qty: p.quantity ?? 1,
    unitValue: p.unit_value ?? 0,
  }))
}

function buildNotes(intake: ExtractedCampaignIntake, region: ExtractedRegion): string {
  const lines: string[] = []
  lines.push('--- Campaign Intake ---')
  lines.push(intake.generated_summary)
  if (intake.regions.length > 1) {
    lines.push(`\nMapped region: ${region.region_name}`)
    lines.push('Note: Multiple regions detected. Create separate campaigns for AU/NZ if prize pools differ.')
  }
  if (region.draw_date) lines.push(`Suggested draw date: ${region.draw_date}`)
  if (region.winner_publication_date) lines.push(`Suggested winner publication: ${region.winner_publication_date}`)
  const flags = region.permit_flags.filter(f => f !== 'NONE_REQUIRED')
  if (flags.length) lines.push(`Permit flags: ${flags.join(', ')}`)
  if (intake.assumptions.length) {
    lines.push('\nAssumptions:')
    intake.assumptions.forEach(a => lines.push(`• ${a}`))
  }
  return lines.join('\n')
}

/**
 * Map extracted intake to existing campaign builder field names.
 * @param regionKey — which region to map (default AU, or first region)
 */
export function mapIntakeToBuilder(
  intake: ExtractedCampaignIntake,
  regionKey?: string
): CampaignBuilderPrefill {
  const region =
    intake.regions.find(r => r.region_name.toUpperCase() === (regionKey ?? 'AU').toUpperCase()) ??
    intake.regions[0]

  if (!region) {
    return {
      promoterName: intake.promoter_name ?? intake.retailer ?? '',
      campaignName: intake.campaign_name ?? '',
      promoStart: '',
      promoEnd: '',
      drawMechanic: 'Sweepstakes',
      drawFrequency: 'at_conclusion',
      entryMechanic: '',
      regions: [],
      prizes: [{ tier: '1st', description: '', qty: 1, unitValue: 0 }],
      notes: intake.generated_summary,
      intakeSnapshot: intake,
    }
  }

  const brands = region.participating_brands.join(', ')
  const entryMechanic = region.loyalty_required
    ? 'Purchase & Show Loyalty Card'
    : region.entry_threshold != null
      ? 'Online - Purchase Required'
      : ''

  const campaignName =
    intake.regions.length > 1 && region.region_name !== 'AU'
      ? `${intake.campaign_name ?? 'Campaign'} (${region.region_name})`
      : intake.campaign_name ?? ''

  return {
    promoterName: intake.promoter_name ?? intake.retailer ?? '',
    campaignName,
    promoStart: region.start_date ?? '',
    promoEnd: region.end_date ?? '',
    drawMechanic: 'Sweepstakes',
    drawFrequency: region.draw_frequency === 'single_draw' ? 'at_conclusion' : 'at_conclusion',
    entryMechanic,
    regions: regionToBuilderRegions(region),
    prizes: regionPrizes(region).length
      ? regionPrizes(region)
      : [{ tier: '1st', description: '', qty: 1, unitValue: 0 }],
    notes: buildNotes(intake, region),
    mechanicDetails: region.entry_threshold != null
      ? {
          purchaseValue: String(region.entry_threshold),
          gstType: 'incl',
          participatingBrand: brands || 'participating products',
          website: '',
          additionalEntryValue: region.subsequent_entries_allowed ? String(region.entry_threshold) : '',
          additionalEntryGst: 'incl',
        }
      : undefined,
    selectedRegion: region.region_name,
    intakeSnapshot: intake,
  }
}
