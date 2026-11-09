import type { ExtractedCampaignIntake } from './types'
import type { PacketDisplayField, PacketPresentation, PacketSource } from './packet-types'
import { extractFromNaturalLanguage } from './nl-extract'

function money(n: number | null | undefined): string | null {
  if (n == null) return null
  return '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function inferPromotionType(concept: string): { value: string; confirmed: boolean } {
  const lower = concept.toLowerCase()
  if (/\btrade\s+account\b|\btrade\b.*customers?|tradie|b2b|wholesaler/i.test(lower)) {
    return { value: 'Trade promotion', confirmed: true }
  }
  if (/\bconsumer\b|customer|shopper/i.test(lower)) {
    return { value: 'Consumer promotion', confirmed: true }
  }
  return { value: 'Consumer promotion', confirmed: false }
}

function inferMechanic(concept: string, drawType: string | null): { value: string; confirmed: boolean } {
  const lower = concept.toLowerCase()
  if (/instant(?:ly)?\s+win/i.test(lower)) {
    return { value: 'Instant win', confirmed: true }
  }
  if (/win\s+(your|their|a)?\s*purchase\s+back|cashback|money\s+back|purchase\s+back/i.test(lower)) {
    return { value: 'Purchase-linked sweepstakes (win purchase back)', confirmed: true }
  }
  if (/game\s+of\s+skill|skill\s+based|essay|caption/i.test(lower)) {
    return { value: 'Game of skill', confirmed: true }
  }
  if (/limited\s+offer|gift\s+with\s+purchase|gwp/i.test(lower)) {
    return { value: 'Limited offer / GWP', confirmed: true }
  }
  if (
    /purchase.*chance\s+to\s+win|chance\s+to\s+win.*purchase|customers?\s+who\s+purchase/i.test(lower)
  ) {
    return { value: 'Purchase-to-enter sweepstakes', confirmed: true }
  }
  if (/sweepstake|prize\s+draw|chance\s+to\s+win|win\s+a\b/i.test(lower) || drawType === 'random_draw') {
    return {
      value: 'Consumer sweepstakes',
      confirmed: /sweepstake|prize\s+draw|chance\s+to\s+win/i.test(lower),
    }
  }
  return { value: 'Sweepstakes (assumed)', confirmed: false }
}

function formatDrawFrequency(freq: string | null, concept: string): { value: string; confirmed: boolean } | null {
  if (/one\s+major\s+(?:prize\s+)?draw\s+at\s+the\s+end|at\s+the\s+end\s+of\s+the\s+promotion/i.test(concept)) {
    return {
      value: 'One major draw at the conclusion of the promotion',
      confirmed: true,
    }
  }
  if (freq === 'instant_win' || /instant/i.test(freq ?? '')) {
    return { value: 'Instant win', confirmed: true }
  }
  if (freq === 'single_draw_at_conclusion' || freq === 'single_draw') {
    return {
      value: 'One draw at conclusion',
      confirmed: freq === 'single_draw_at_conclusion',
    }
  }
  if (freq) return { value: freq.replace(/_/g, ' '), confirmed: false }
  return null
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
  const nl = extractFromNaturalLanguage(concept)
  const promoType = inferPromotionType(concept)
  const mechanic = inferMechanic(concept, region?.draw_type ?? null)

  const fields: PacketDisplayField[] = []

  const campaignName = intake.campaign_name ?? nl.campaignName
  fields.push({
    label: 'Campaign',
    value: campaignName ?? 'To be confirmed',
    confirmed: !!(intake.campaign_name || nl.campaignName) && !nl.campaignNameSuggested,
  })
  if (nl.campaignNameSuggested && campaignName) {
    // Mark suggested name clearly without burying it as "Untitled"
    const campaignField = fields[fields.length - 1]
    campaignField.value = campaignName
    campaignField.confirmed = false
  }

  fields.push({ label: 'Promotion type', value: promoType.value, confirmed: promoType.confirmed })
  fields.push({ label: 'Likely mechanic', value: mechanic.value, confirmed: mechanic.confirmed })

  const brand = intake.brand ?? nl.brand
  const retailer = intake.retailer ?? nl.retailer
  fields.push({
    label: 'Brand',
    value: brand ?? 'Not specified',
    confirmed: !!brand,
  })
  fields.push({
    label: 'Retailer',
    value: retailer ?? 'Not specified',
    confirmed: !!retailer,
  })

  const storeCount = nl.storeCount
  if (storeCount != null) {
    const label =
      nl.storeRetailer || retailer
        ? `${storeCount} ${nl.storeRetailer ?? retailer} stores`
        : `${storeCount} stores`
    fields.push({ label: 'Participating locations', value: label, confirmed: true })
  }

  const prize = region?.prizes?.[0] ?? region?.major_prizes?.[0] ?? nl.prizes[0] ?? null
  if (prize?.description) {
    fields.push({ label: 'Prize', value: prize.description, confirmed: true })
    if (prize.quantity != null) {
      fields.push({ label: 'Prize quantity', value: String(prize.quantity), confirmed: true })
    }
    if (prize.unit_value != null) {
      fields.push({
        label: 'Approximate prize value',
        value: `AUD ${money(prize.unit_value)}`,
        confirmed: true,
      })
    }
  } else {
    fields.push({ label: 'Prize', value: 'To be confirmed', confirmed: false })
  }

  if (nl.periodLabel || (region?.start_date && region?.end_date)) {
    fields.push({
      label: 'Campaign dates',
      value: nl.periodLabel ?? `${region!.start_date} → ${region!.end_date}`,
      confirmed: true,
    })
  } else {
    fields.push({ label: 'Campaign dates', value: 'To be confirmed', confirmed: false })
  }

  if (region?.entry_mechanic || nl.entryMechanic) {
    fields.push({
      label: 'Entry requirement',
      value: region?.entry_mechanic ?? nl.entryMechanic!,
      confirmed: true,
    })
  } else {
    fields.push({ label: 'Entry requirement', value: 'Not specified', confirmed: false })
  }

  fields.push({
    label: 'Entry method',
    value: 'Not specified',
    confirmed: false,
  })

  const draw = formatDrawFrequency(region?.draw_frequency ?? nl.drawFrequency, concept)
  if (draw) {
    fields.push({ label: 'Draw frequency', value: draw.value, confirmed: draw.confirmed })
  }

  const geo =
    region?.country ||
    (region?.region_name === 'AU'
      ? 'Australia'
      : region?.region_name === 'NZ'
        ? 'New Zealand'
        : region?.region_name) ||
    (nl.geography === 'AU' ? 'Australia' : nl.geography === 'NZ' ? 'New Zealand' : null)
  if (geo) {
    fields.push({ label: 'Geography', value: geo, confirmed: !!nl.geography || !!region })
  }

  const unresolved: string[] = []
  if (!brand) unresolved.push('Confirm brand (if distinct from retailer)')
  if (!region?.entry_mechanic && !nl.entryMechanic) unresolved.push('Confirm entry method / digital channel')
  if (!prize?.unit_value && prize?.description && !/refunded/i.test(prize.description)) {
    unresolved.push('Confirm prize value')
  }
  if (!nl.periodLabel && !region?.start_date) unresolved.push('Confirm promotional dates')

  // Filter noisy assumption lines for display
  const displayAssumptions = intake.assumptions.filter(
    (a) =>
      !/^Heuristic extraction/i.test(a) &&
      !/Draw frequency assumed/i.test(a) &&
      !/standard extraction/i.test(a)
  )

  return {
    packetRef: params.packetRef,
    campaignName: campaignName ?? 'Untitled promotion',
    promotionType: promoType.value,
    likelyMechanic: mechanic.value,
    summary: intake.generated_summary,
    fields,
    assumptions: displayAssumptions,
    unresolved: [...new Set(unresolved)],
    originalConcept: concept,
    submitterName: params.submitterName,
    submitterEmail: params.submitterEmail,
    submitterCompany: params.submitterCompany,
    partnerId: params.partnerId,
    source: params.source,
    createdAt: params.createdAt,
  }
}
