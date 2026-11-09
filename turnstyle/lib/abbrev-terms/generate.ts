/**
 * Shared abbreviated T&Cs generator.
 * Source of truth for wording used by Campaign Manager and Intake Packet emails.
 * Do not introduce alternate legal templates here.
 */

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

export type AbbrevPrize = {
  description: string
  qty: number
  unitValue: number | null
}

export type AbbrevCampaignInput = {
  promoStart: string | null
  promoEnd: string | null
  /** Sweepstakes | Limited Offer | Other */
  drawMechanic: string
  /** at_conclusion | instant_win | ... */
  drawFrequency: string
  entryMechanic: string | null
  regions: string[]
  prizes: AbbrevPrize[]
  promoterName: string | null
}

export function formatAbbrevDateLong(d: string | null): string {
  if (!d) return 'TBC'
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return 'TBC'
  return parsed.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatAbbrevMoney(n: number): string {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })
}

export function formatAbbrevRegions(regions: string[]): string {
  if (regions.includes('national_au') || regions.includes('AU') || regions.includes('Australia')) {
    return 'Australia'
  }
  const states = regions.filter((r) => AU_STATES.includes(r))
  const parts: string[] = []
  if (states.length) parts.push(states.join(', '))
  if (regions.includes('NZ') || regions.includes('New Zealand')) parts.push('New Zealand')
  if (regions.includes('USA')) parts.push('United States')
  if (regions.includes('EU')) parts.push('Europe')
  return parts.join(', ') || 'TBC'
}

export function generateDrawDateText(promoEnd: string | null, drawFrequency: string): string {
  if (!promoEnd) return 'TBC'
  const end = new Date(promoEnd)
  if (Number.isNaN(end.getTime())) return 'TBC'

  const freq = drawFrequency.toLowerCase()
  if (freq === 'at_conclusion' || freq === 'single_draw_at_conclusion' || freq === 'single_draw') {
    const draw = new Date(end)
    let added = 0
    while (added < 5) {
      draw.setDate(draw.getDate() + 1)
      if (draw.getDay() !== 0 && draw.getDay() !== 6) added++
    }
    return draw.toLocaleDateString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  if (freq.includes('instant')) return 'instantly'
  return 'as per schedule'
}

/**
 * Exact abbreviated terms wording used by Campaign Manager.
 */
export function generateAbbreviatedTerms(campaign: AbbrevCampaignInput): string {
  const prizePoolTotal = campaign.prizes.reduce(
    (s, p) => s + (p.unitValue != null ? p.qty * p.unitValue : 0),
    0
  )
  const isLimitedOffer = campaign.drawMechanic === 'Limited Offer'
  const regions = formatAbbrevRegions(campaign.regions)
  const drawDate = generateDrawDateText(campaign.promoEnd, campaign.drawFrequency)

  const prizeDesc = campaign.prizes
    .map((p) => {
      const qtyPrefix = p.qty === 1 ? '' : `${p.qty} x `
      const valueText =
        p.unitValue != null ? formatAbbrevMoney(p.unitValue) : 'TBC'
      return `${qtyPrefix}${p.description} valued at ${valueText} incl GST`
    })
    .join(', ')

  const entry = campaign.entryMechanic || '[entry mechanic to be confirmed]'
  const promoterName = campaign.promoterName || '[Promoter]'
  const poolText =
    prizePoolTotal > 0 ? formatAbbrevMoney(prizePoolTotal) : 'TBC'

  if (isLimitedOffer) {
    return `Commences 12:00am ${formatAbbrevDateLong(campaign.promoStart)} and ends 11:59pm ${formatAbbrevDateLong(campaign.promoEnd)} AEST, see website via the attached QR Code for full terms and conditions, entry requirements, participating retailers and prize details. Please review to determine whether you are eligible to participate. ${entry}. ${prizeDesc}. Total prize pool in ${regions} is ${poolText} incl GST. Promoter is ${promoterName}.`
  }

  return `Commences 12:00am ${formatAbbrevDateLong(campaign.promoStart)} and ends 11:59pm ${formatAbbrevDateLong(campaign.promoEnd)} AEST, see website via the attached QR Code for full terms and conditions, entry requirements, participating retailers, prize details and State permit numbers where applicable. Please review to determine whether you are eligible to participate. ${entry}. ${prizeDesc}. Prize drawn ${drawDate} at Flow Marketing, 11 Lomandra Pl, Coolum Beach QLD 4573, Australia. Winners notified via the website or the QR code. Total prize pool in ${regions} is ${poolText} incl GST. Promoter is ${promoterName}.`
}

export type AbbrevGenerateResult =
  | { ok: true; text: string }
  | { ok: false; reason: string }

/**
 * Only generate when enough prize substance exists to avoid empty/nonsensical terms.
 */
export function tryGenerateAbbreviatedTerms(campaign: AbbrevCampaignInput): AbbrevGenerateResult {
  const usablePrizes = campaign.prizes.filter((p) => p.description?.trim())
  if (!usablePrizes.length) {
    return {
      ok: false,
      reason: 'Prize details are required before draft abbreviated terms can be prepared.',
    }
  }

  return {
    ok: true,
    text: generateAbbreviatedTerms({ ...campaign, prizes: usablePrizes }),
  }
}
