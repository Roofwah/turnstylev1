import type { ExtractedCampaignIntake } from './types'
import type { PacketDisplayField, PacketPresentation, PacketSource } from './packet-types'

function money(n: number | null | undefined): string | null {
  if (n == null) return null
  return '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function inferPromotionType(intake: ExtractedCampaignIntake, concept: string): { value: string; confirmed: boolean } {
  const lower = concept.toLowerCase()
  if (/\btrade\b|tradie|b2b|wholesaler/i.test(lower)) {
    return { value: 'Trade promotion', confirmed: /trade/i.test(lower) }
  }
  if (/\bconsumer\b|customer|shopper/i.test(lower)) {
    return { value: 'Consumer promotion', confirmed: true }
  }
  return { value: 'Consumer promotion', confirmed: false }
}

function inferMechanic(intake: ExtractedCampaignIntake, concept: string): { value: string; confirmed: boolean } {
  const lower = concept.toLowerCase()
  const region = intake.regions[0]
  const draw = region?.draw_type

  if (/win\s+(your|their|a)?\s*purchase\s+back|cashback|money\s+back|purchase\s+back/i.test(lower)) {
    return { value: 'Purchase-linked sweepstakes (win purchase back)', confirmed: true }
  }
  if (/instant\s+win/i.test(lower)) {
    return { value: 'Instant win', confirmed: true }
  }
  if (/game\s+of\s+skill|skill\s+based|essay|caption/i.test(lower)) {
    return { value: 'Game of skill', confirmed: true }
  }
  if (/limited\s+offer|gift\s+with\s+purchase|gwp/i.test(lower)) {
    return { value: 'Limited offer / GWP', confirmed: true }
  }
  if (/sweepstake|prize\s+draw|chance\s+to\s+win|win\s+a\b/i.test(lower) || draw === 'random_draw') {
    return {
      value: 'Consumer sweepstakes',
      confirmed: /sweepstake|prize\s+draw|chance\s+to\s+win/i.test(lower),
    }
  }
  return { value: 'Sweepstakes (assumed)', confirmed: false }
}

function storeCount(concept: string): { value: string; confirmed: boolean } | null {
  const m = concept.match(/(\d[\d,]*)\s+stores?/i)
  if (!m) return null
  return { value: m[1].replace(/,/g, ''), confirmed: true }
}

export function buildPacketPresentation(params: {
  packetRef: string
  intake: ExtractedCampaignIntake
  concept: string
  submitterName: string
  submitterEmail: string
  submitterCompany: string
  partnerId: string
  source: PacketSource
  createdAt: string
}): PacketPresentation {
  const { intake, concept } = params
  const region = intake.regions[0]
  const promoType = inferPromotionType(intake, concept)
  const mechanic = inferMechanic(intake, concept)
  const stores = storeCount(concept)

  const fields: PacketDisplayField[] = []

  fields.push({
    label: 'Campaign',
    value: intake.campaign_name ?? 'To be confirmed',
    confirmed: !!intake.campaign_name && !/assumed/i.test(intake.campaign_name),
  })
  fields.push({ label: 'Promotion type', value: promoType.value, confirmed: promoType.confirmed })
  fields.push({ label: 'Likely mechanic', value: mechanic.value, confirmed: mechanic.confirmed })

  if (intake.brand || intake.retailer || intake.promoter_name) {
    fields.push({
      label: 'Brand / retailer',
      value: [intake.brand, intake.retailer ?? intake.promoter_name].filter(Boolean).join(' · '),
      confirmed: !!(intake.brand || intake.retailer || intake.promoter_name),
    })
  }

  if (stores) {
    fields.push({ label: 'Participating stores', value: stores.value, confirmed: stores.confirmed })
  }

  const prize =
    region?.prizes?.[0] ??
    region?.major_prizes?.[0] ??
    null
  if (prize?.description) {
    const val = prize.unit_value != null
      ? `${prize.description} (${money(prize.unit_value)}${prize.quantity && prize.quantity > 1 ? ` × ${prize.quantity}` : ''})`
      : prize.description
    fields.push({ label: 'Prize', value: val, confirmed: true })
  } else if (/win\s+(your|their|a)?\s*purchase\s+back|purchase\s+back|money\s+back|cashback/i.test(concept)) {
    fields.push({ label: 'Prize', value: 'Purchase value refunded', confirmed: true })
  } else {
    fields.push({ label: 'Prize', value: 'To be confirmed', confirmed: false })
  }

  if (region?.start_date && region?.end_date) {
    fields.push({
      label: 'Campaign dates',
      value: `${region.start_date} → ${region.end_date}`,
      confirmed: true,
    })
  } else {
    fields.push({ label: 'Campaign dates', value: 'To be confirmed', confirmed: false })
  }

  if (region?.entry_mechanic) {
    fields.push({ label: 'Entry method', value: region.entry_mechanic, confirmed: true })
  } else if (region?.entry_threshold != null) {
    fields.push({
      label: 'Entry method',
      value: `Purchase of $${region.entry_threshold}+ (threshold extracted)`,
      confirmed: true,
    })
  } else {
    fields.push({
      label: 'Entry method',
      value: 'To be determined',
      confirmed: false,
    })
  }

  if (intake.regions.length) {
    fields.push({
      label: 'Geography',
      value: intake.regions.map((r) => r.region_name).join(', '),
      confirmed: intake.regions.length > 0,
    })
  }

  const unresolved = [...intake.missing_fields]
  if (!region?.start_date) unresolved.push('Confirm promotional dates')
  if (!prize?.unit_value && !/purchase\s+back/i.test(concept)) unresolved.push('Establish maximum prize value')
  if (!stores) unresolved.push('Confirm participating locations')
  if (!region?.draw_frequency || region.draw_frequency === 'single_draw') {
    unresolved.push('Determine winner frequency')
  }

  // Dedupe unresolved display messages
  const unresolvedDisplay = [...new Set(unresolved.map((u) => {
    if (u.includes('start_date') || u.includes('end_date')) return 'Confirm promotional dates'
    if (u.includes('prizes')) return 'Confirm prize details and values'
    if (u.includes('entry_')) return 'Confirm entry requirements'
    if (u.includes('campaign_name')) return 'Confirm campaign name'
    if (u.includes('promoter')) return 'Confirm promoter / brand'
    return u
  }))]

  return {
    packetRef: params.packetRef,
    campaignName: intake.campaign_name ?? 'Untitled promotion',
    promotionType: promoType.value,
    likelyMechanic: mechanic.value,
    summary: intake.generated_summary,
    fields,
    assumptions: intake.assumptions,
    unresolved: unresolvedDisplay,
    originalConcept: concept,
    submitterName: params.submitterName,
    submitterEmail: params.submitterEmail,
    submitterCompany: params.submitterCompany,
    partnerId: params.partnerId,
    source: params.source,
    createdAt: params.createdAt,
  }
}
