// ─────────────────────────────────────────────
// Turnstyle Preflight Extraction — Field Extractors
//
// One exported function per logical field group.
// All functions accept the raw document text (post-normalisation)
// and return typed ExtractedField<T> values.
//
// Extractor philosophy:
//   - Try the most specific pattern first (high confidence)
//   - Fall back to looser patterns (medium / low)
//   - Never throw — always return fieldAbsent() on failure
//   - Capture verbatim snippets as evidence
// ─────────────────────────────────────────────

import type {
  ExtractedField,
  ExtractedCampaignCore,
  ExtractedCampaignTiming,
  ExtractedEligibilityAndEntry,
  ExtractedPrize,
  ExtractedPrizeModel,
  ExtractedCompliance,
} from './types'

import {
  findFirst,
  findAll,
  getSectionBody,
  extractDollarAmount,
  extractAllDates,
  extractAbn,
  extractUrls,
  extractPrivacyUrl,
  extractPermitNumbers,
  isPermitPlaceholder,
  fieldOf,
  fieldAbsent,
  findAfterLabel,
  sentencesContaining,
} from './helpers'

// ─── Core identity extractors ─────────────────

export function extractCampaignName(text: string, filename: string | null): ExtractedField<string> {
  // Try: first line if it looks like a campaign/promotion title
  const firstLine = text.split('\n').find((l) => l.trim().length > 10)?.trim()
  if (firstLine && /promotion|competition|giveaway|prize|sweepstake|contest/i.test(firstLine) && firstLine.length < 120) {
    return fieldOf(firstLine, 'medium', firstLine)
  }
  // Try: "Terms and Conditions – [Campaign Name]" pattern
  const titleMatch = findFirst(/terms?\s+(?:and\s+)?conditions?\s*[–—-]\s*(.+?)(?:\n|$)/i, text)
  if (titleMatch?.groups) {
    const candidate = titleMatch.match.replace(/^terms?\s+(?:and\s+)?conditions?\s*[–—-]\s*/i, '').trim()
    if (candidate.length > 5 && candidate.length < 150) {
      return fieldOf(candidate, 'medium', titleMatch.match, titleMatch.offset)
    }
  }
  // Fall back to filename without extension
  if (filename) {
    const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim()
    if (name.length > 3) return fieldOf(name, 'low', `[from filename: ${filename}]`)
  }
  return fieldAbsent()
}

export function extractPromoterName(text: string): ExtractedField<string> {
  // Most reliable: explicit Promoter section
  const body = getSectionBody(/^promoter$/i, text)
  if (body) {
    // First sentence / line before any comma is the company name
    const line = body.split('\n').find((l) => l.trim().length > 3)?.trim()
    if (line) {
      const name = line.split(/,|\(ABN/i)[0].trim()
      if (name.length > 2 && name.length < 200) {
        return fieldOf(name, 'high', line)
      }
    }
  }

  // Try inline patterns: "Promoter: XYZ Pty Ltd"
  const inlineMatch = findFirst(/(?:^|\n)Promoter[:\s]+(.+?)(?:\n|$)/i, text)
  if (inlineMatch) {
    const val = inlineMatch.match.replace(/^Promoter[:\s]+/i, '').trim()
    if (val.length > 2 && val.length < 200) {
      return fieldOf(val, 'medium', inlineMatch.match, inlineMatch.offset)
    }
  }

  // Try: "Promoted by XYZ"
  const promoBy = findFirst(/\bpromoted\s+by\s+([A-Z][^,.!\n]{3,80})/i, text)
  if (promoBy) {
    const val = promoBy.groups[0] ?? promoBy.match.replace(/^promoted\s+by\s+/i, '')
    return fieldOf(val.trim(), 'medium', promoBy.match, promoBy.offset)
  }

  return fieldAbsent()
}

export function extractPromoterAbn(text: string): ExtractedField<string> {
  const abn = extractAbn(text)
  if (!abn) return fieldAbsent()
  const m = findFirst(/ABN[:\s#]*\d[\d\s]+/i, text)
  return fieldOf(abn, 'high', m?.match ?? abn, m?.offset)
}

export function extractPromoterAddress(text: string): ExtractedField<string> {
  const body = getSectionBody(/^promoter$/i, text)
  const searchIn = body ?? text.slice(0, 2000)

  // Look for address patterns: street number, suburb, state, postcode
  const addrMatch = findFirst(
    /\d+\s+[A-Z][a-zA-Z\s]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Circuit|Ct)[,\s]+[A-Za-z\s]+(?:NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\s+\d{4}/i,
    searchIn
  )
  if (addrMatch) return fieldOf(addrMatch.match.trim(), 'high', addrMatch.match, addrMatch.offset)

  // Looser: PO Box pattern
  const poMatch = findFirst(/(?:PO|P\.O\.)\s*Box\s+\d+[,\s]+[A-Za-z\s]+(?:NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\s*\d{4}/i, searchIn)
  if (poMatch) return fieldOf(poMatch.match.trim(), 'high', poMatch.match, poMatch.offset)

  return fieldAbsent()
}

export function extractPromotionType(text: string): ExtractedField<'chance' | 'skill' | 'instant_win'> {
  const lower = text.toLowerCase()

  if (/instant\s+win|scratch\s+(?:and\s+)?win|reveal\s+(?:and\s+)?win/.test(lower)) {
    const m = findFirst(/instant\s+win|scratch\s+(?:and\s+)?win/i, text)
    return fieldOf('instant_win', 'high', m?.match ?? 'instant win', m?.offset)
  }

  if (/game\s+of\s+skill|skill[\s-]based|judges?\s+decision|most\s+creative/.test(lower)) {
    const m = findFirst(/game\s+of\s+skill|skill[\s-]based/i, text)
    return fieldOf('skill', 'high', m?.match ?? 'skill', m?.offset)
  }

  // Default: chance (draw, lottery, random)
  const chanceM = findFirst(/\b(prize\s+draw|random\s+draw|drawn\s+at\s+random|lucky\s+draw|sweepstake)\b/i, text)
  if (chanceM) return fieldOf('chance', 'high', chanceM.match, chanceM.offset)

  // Has a draw date → probably chance
  const drawM = findFirst(/\bdraw\s+(?:date|will\s+(?:be\s+)?(?:held|conducted|take\s+place))/i, text)
  if (drawM) return fieldOf('chance', 'medium', drawM.match, drawM.offset)

  return fieldOf('chance', 'low', '[assumed chance — no contrary signal]')
}

export function extractWebsite(text: string): ExtractedField<string> {
  // Look for explicit website section
  const body = getSectionBody(/^website$/i, text)
  if (body) {
    const urls = extractUrls(body)
    if (urls.length > 0) return fieldOf(urls[0], 'high', body.slice(0, 150))
  }

  // "available at / visit / at www."
  const siteMatch = findFirst(/(?:available\s+at|visit|at|website[:\s]+)\s+(https?:\/\/[^\s)>\]"']+)/i, text)
  if (siteMatch) {
    const url = siteMatch.groups[0] ?? extractUrls(siteMatch.match)[0]
    if (url) return fieldOf(url.replace(/[.,;:]+$/, ''), 'medium', siteMatch.match, siteMatch.offset)
  }

  // Any URL in the document
  const urls = extractUrls(text)
  const nonPrivacy = urls.find((u) => !/privacy|terms/i.test(u))
  if (nonPrivacy) return fieldOf(nonPrivacy, 'low', nonPrivacy)

  return fieldAbsent()
}

export function extractJurisdiction(text: string): ExtractedField<string[]> {
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']
  const found: string[] = []

  // Explicit state list pattern: "residents of NSW, VIC and QLD"
  const listMatch = findFirst(/(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)(?:[,\s]+(?:and\s+)?(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)){1,7}/i, text)

  for (const s of states) {
    if (new RegExp(`\\b${s}\\b`, 'i').test(text)) found.push(s)
  }

  // "all states and territories of Australia" / "open to all Australians"
  const allAus = /all\s+(?:states?\s+and\s+territories?\s+of\s+)?australia|open\s+to\s+all\s+australian/i.test(text)
  if (allAus && found.length === 0) {
    return fieldOf(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'], 'medium', '[open to all Australia]')
  }

  if (found.length > 0) {
    const snippet = listMatch?.match ?? found.join(', ')
    return fieldOf(found, found.length > 1 ? 'high' : 'medium', snippet, listMatch?.offset)
  }

  return fieldAbsent()
}

export function extractCampaignCore(text: string, filename: string | null): ExtractedCampaignCore {
  return {
    campaignName: extractCampaignName(text, filename),
    promoterName: extractPromoterName(text),
    promoterAbn: extractPromoterAbn(text),
    promoterAddress: extractPromoterAddress(text),
    promotionType: extractPromotionType(text),
    website: extractWebsite(text),
    jurisdiction: extractJurisdiction(text),
  }
}

// ─── Timing extractors ────────────────────────

export function extractCampaignTiming(text: string): import('./types').ExtractedCampaignTiming {
  const allDates = extractAllDates(text)

  // Promotion period section
  const periodBody = getSectionBody(/^promotion(?:al)?\s+period$/i, text) ?? ''

  // Find start / open / commence date
  const startSignals = [
    findFirst(/(?:opens?|commences?|begins?|starts?|entry\s+(?:open|period\s+open))[:\s]+(.{5,60})/i, periodBody || text),
    findFirst(/(?:from|commencing)\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i, periodBody || text),
  ].filter(Boolean)

  let promotionStart: ExtractedField<string> = fieldAbsent()
  for (const m of startSignals) {
    if (!m) continue
    const dates = extractAllDates(m.match)
    if (dates.length > 0) {
      promotionStart = fieldOf(dates[0].iso ?? dates[0].raw, 'high', m.match, m.offset)
      break
    }
  }
  // Fallback: first date found in period section
  if (promotionStart.confidence === 'none' && periodBody) {
    const d = extractAllDates(periodBody)
    if (d.length > 0) promotionStart = fieldOf(d[0].iso ?? d[0].raw, 'medium', d[0].raw)
  }

  // Close / end date
  const endSignals = [
    findFirst(/(?:closes?|ends?|concludes?|closing|entry\s+(?:close|period\s+close))[:\s]+(.{5,60})/i, periodBody || text),
    findFirst(/(?:until|to|through)\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i, periodBody || text),
  ].filter(Boolean)

  let promotionEnd: ExtractedField<string> = fieldAbsent()
  for (const m of endSignals) {
    if (!m) continue
    const dates = extractAllDates(m.match)
    if (dates.length > 0) {
      promotionEnd = fieldOf(dates[0].iso ?? dates[0].raw, 'high', m.match, m.offset)
      break
    }
  }
  if (promotionEnd.confidence === 'none' && periodBody) {
    const d = extractAllDates(periodBody)
    // Take last date in period section as close date (if more than one)
    const last = d.length > 1 ? d[d.length - 1] : null
    if (last) promotionEnd = fieldOf(last.iso ?? last.raw, 'medium', last.raw)
  }

  // Draw date
  const drawBody = getSectionBody(/^draw\s+(?:method|mechanic|date|detail|schedule)|^(number\s+of\s+winners|winner\s+selection)/i, text) ?? text
  const drawSignal = findFirst(/draw\s+(?:will\s+(?:be\s+)?(?:held|conducted|take\s+place)|date|on)[:\s]+(.{5,80})/i, drawBody)
  let drawDate: ExtractedField<string> = fieldAbsent()
  if (drawSignal) {
    const dates = extractAllDates(drawSignal.match)
    if (dates.length > 0) drawDate = fieldOf(dates[0].iso ?? dates[0].raw, 'high', drawSignal.match, drawSignal.offset)
  }

  // Draw time
  const timeMatch = findFirst(/\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i, drawBody)
  const drawTime: ExtractedField<string> = timeMatch
    ? fieldOf(timeMatch.match.trim(), 'medium', timeMatch.match, timeMatch.offset)
    : fieldAbsent()

  // Draw location
  const locMatch = findFirst(/drawn\s+(?:at|in|by)[:\s]+(.{5,100}?)(?:\.|,|\n)/i, drawBody)
  const drawLocation: ExtractedField<string> = locMatch
    ? fieldOf(locMatch.match.replace(/^drawn\s+(?:at|in|by)[:\s]+/i, '').trim(), 'medium', locMatch.match, locMatch.offset)
    : fieldAbsent()

  // Claim deadline — "must be claimed within X days" / specific date
  const claimBody = getSectionBody(/^unclaimed\s+prize/i, text) ?? text
  const claimDeadlineMatch = findFirst(
    /(?:claim(?:ed)?\s+(?:by|before|within)|must\s+be\s+claimed\s+(?:by|within))[:\s]+(.{5,80})/i,
    claimBody
  )
  let claimDeadline: ExtractedField<string> = fieldAbsent()
  if (claimDeadlineMatch) {
    const dates = extractAllDates(claimDeadlineMatch.match)
    const val = dates.length > 0 ? (dates[0].iso ?? dates[0].raw) : claimDeadlineMatch.match.replace(/^.+?[:\s]+/, '').trim().slice(0, 80)
    claimDeadline = fieldOf(val, dates.length > 0 ? 'high' : 'medium', claimDeadlineMatch.match, claimDeadlineMatch.offset)
  }

  // Unclaimed draw date
  const unclaimedMatch = findFirst(/unclaimed\s+(?:prize\s+)?draw[:\s]+(.{5,80})/i, claimBody)
  let unclaimedDrawDate: ExtractedField<string> = fieldAbsent()
  if (unclaimedMatch) {
    const dates = extractAllDates(unclaimedMatch.match)
    const val = dates.length > 0 ? (dates[0].iso ?? dates[0].raw) : unclaimedMatch.match.slice(0, 80)
    unclaimedDrawDate = fieldOf(val, dates.length > 0 ? 'high' : 'medium', unclaimedMatch.match, unclaimedMatch.offset)
  }

  return {
    promotionStart,
    promotionEnd,
    drawDate,
    drawTime,
    drawLocation,
    claimDeadline,
    unclaimedDrawDate,
  }
}

// ─── Eligibility & entry extractors ──────────

export function extractEligibilityAndEntry(text: string): ExtractedEligibilityAndEntry {
  const eligBody = getSectionBody(/^(who\s+can\s+enter|eligibilit|participant\s+eligibility)/i, text) ?? text
  const entryBody = getSectionBody(/^(how\s+to\s+enter|entry\s+method|entry\s+mechanic)/i, text) ?? text

  // Age minimum
  let ageMinimum: ExtractedField<number> = fieldAbsent()
  const ageMatch = findFirst(/\b(\d{2})\s*(?:years?\s+of\s+age|years?\s+old|yo)\b|aged?\s+(\d{2})\s*(?:years?|or\s+over)/i, eligBody)
  if (ageMatch) {
    const age = parseInt(ageMatch.groups[0] ?? ageMatch.groups[1] ?? ageMatch.match.match(/\d+/)?.[0] ?? '')
    if (!isNaN(age) && age >= 13 && age <= 25) {
      ageMinimum = fieldOf(age, 'high', ageMatch.match, ageMatch.offset)
    }
  }
  // "18+" shorthand
  if (ageMinimum.confidence === 'none') {
    const shortMatch = findFirst(/\b18\+|\b18\s+(?:years?\s+)?(?:and\s+)?over\b/i, eligBody)
    if (shortMatch) ageMinimum = fieldOf(18, 'high', shortMatch.match, shortMatch.offset)
  }
  // "open to minors" / "children"
  let minorsPermitted: ExtractedField<boolean> = fieldAbsent()
  if (/\bminors?\b|\bunder\s+18\b|\bchildren\b/i.test(eligBody)) {
    const m = findFirst(/\bminors?\b|\bunder\s+18\b/i, eligBody)
    minorsPermitted = fieldOf(true, 'medium', m?.match ?? 'minor', m?.offset)
  } else if (ageMinimum.value !== null && ageMinimum.value >= 18) {
    minorsPermitted = fieldOf(false, 'high', `age requirement: ${ageMinimum.value}`)
  }

  // Residency
  let residencyRequirement: ExtractedField<string> = fieldAbsent()
  const resMatch = findFirst(
    /(?:resident(?:s)?\s+of|open\s+to|must\s+be\s+(?:a\s+)?(?:permanent\s+)?resident)[:\s]+(.{5,100}?)(?:\.|,\s+(?:aged|who)|\n)/i,
    eligBody
  )
  if (resMatch) {
    const val = resMatch.match.replace(/^[^:]+[:\s]+/, '').replace(/[.,]\s*$/, '').trim()
    residencyRequirement = fieldOf(val, 'medium', resMatch.match, resMatch.offset)
  } else if (/australian\s+resident/i.test(eligBody)) {
    const m = findFirst(/australian\s+(?:permanent\s+)?resident/i, eligBody)
    residencyRequirement = fieldOf('Australian resident', 'medium', m?.match ?? 'Australian resident', m?.offset)
  }

  // Excluded occupations
  const excludedOccupations: ExtractedField<string[]> = fieldAbsent()
  const ineligBody = getSectionBody(/^who\s+is\s+ineligible|ineligible/i, text)
  if (ineligBody) {
    const occupations: string[] = []
    if (/employee/i.test(ineligBody)) occupations.push('employees of the promoter')
    if (/agency|agencies/i.test(ineligBody)) occupations.push('agency staff')
    if (/immediate\s+family/i.test(ineligBody)) occupations.push('immediate family members')
    if (occupations.length > 0) {
      Object.assign(excludedOccupations, fieldOf(occupations, 'medium', ineligBody.slice(0, 150)))
    }
  }

  // Entry mechanic
  let entryMechanic: ExtractedField<string> = fieldAbsent()
  if (entryBody && entryBody.length > 10) {
    // First substantial sentence
    const firstSentence = entryBody.split(/[.!?]\s+/)[0]?.trim()
    if (firstSentence && firstSentence.length > 10) {
      entryMechanic = fieldOf(firstSentence.slice(0, 300), 'medium', firstSentence)
    }
  }

  // Purchase required
  let purchaseRequired: ExtractedField<boolean> = fieldAbsent()
  let purchaseThreshold: ExtractedField<number> = fieldAbsent()
  const purchaseMatch = findFirst(
    /(?:purchase|buy|spend)\s+(?:a\s+|any\s+)?(?:qualifying\s+)?(?:product|item|gift\s+card|qualifying|minimum)/i,
    entryBody
  )
  if (purchaseMatch) {
    purchaseRequired = fieldOf(true, 'high', purchaseMatch.match, purchaseMatch.offset)
    const amt = extractDollarAmount(entryBody)
    if (amt !== null) purchaseThreshold = fieldOf(amt, 'medium', `$${amt}`)
  } else if (/no\s+purchase\s+(?:is\s+)?(?:necessary|required)/i.test(entryBody)) {
    const m = findFirst(/no\s+purchase\s+(?:is\s+)?(?:necessary|required)/i, entryBody)
    purchaseRequired = fieldOf(false, 'high', m?.match ?? 'no purchase required', m?.offset)
  }

  // Entry limit
  let entryLimit: ExtractedField<number | 'unlimited'> = fieldAbsent()
  const unlimitedMatch = /unlimited\s+entr(?:ies|y)|as\s+many\s+(?:times|entries)|no\s+limit/i.test(entryBody)
  if (unlimitedMatch) {
    entryLimit = fieldOf('unlimited', 'medium', '[unlimited entries]')
  } else {
    const limitMatch = findFirst(/(?:limited\s+to|maximum\s+(?:of\s+)?|up\s+to|only\s+)(\d+)\s+entr(?:ies|y)/i, entryBody)
    if (limitMatch) {
      const n = parseInt(limitMatch.groups[0] ?? limitMatch.match.match(/\d+/)?.[0] ?? '')
      if (!isNaN(n)) entryLimit = fieldOf(n, 'high', limitMatch.match, limitMatch.offset)
    }
  }

  // Loyalty
  let loyaltyRequired: ExtractedField<boolean> = fieldAbsent()
  let loyaltyProgramName: ExtractedField<string> = fieldAbsent()
  const loyaltyMatch = findFirst(/(?:must\s+be\s+a\s+)?(?:member|membership|loyalty\s+member|rewards?\s+member)[:\s]+(.{3,60})/i, eligBody)
  if (loyaltyMatch) {
    loyaltyRequired = fieldOf(true, 'medium', loyaltyMatch.match, loyaltyMatch.offset)
    const nameMatch = findFirst(/([A-Z][a-zA-Z\s]+(?:Rewards?|Loyalty|Club|Member|Program))/i, eligBody)
    if (nameMatch) loyaltyProgramName = fieldOf(nameMatch.match.trim(), 'medium', nameMatch.match, nameMatch.offset)
  }

  return {
    ageMinimum,
    minorsPermitted,
    residencyRequirement,
    excludedOccupations,
    entryMechanic,
    purchaseRequired,
    purchaseThreshold,
    entryLimit,
    loyaltyRequired,
    loyaltyProgramName,
  }
}

// ─── Prize model extractors ───────────────────

function detectPrizeTypes(desc: string): string[] {
  const types: string[] = []
  if (/\b(flight|airfare|air\s+travel|return\s+(?:flights?|airfares?))\b/i.test(desc)) types.push('travel')
  if (/\b(hotel|resort|accommodation|motel|villa|lodge)\b/i.test(desc)) types.push('accommodation')
  if (/\b(concert|festival|event|show|gig|game|match|race)\s+ticket/i.test(desc)) types.push('event')
  if (/\b(gift\s+card|voucher|e-voucher)\b/i.test(desc)) types.push('gift_card')
  if (/\bcash\b|\bcheque\b|\bbank\s+transfer\b/i.test(desc)) types.push('cash')
  if (/\bcar\b|\bvehicle\b|\bmotorcycle\b/i.test(desc)) types.push('vehicle')
  if (/\bholiday\b|\bvacation\b|\bgetaway\b|\btrip\b/i.test(desc)) types.push('holiday')
  if (types.length === 0) types.push('product')
  return types
}

export function extractPrizeModel(text: string): ExtractedPrizeModel {
  const prizeBody = getSectionBody(/^(prize|prizes|what\s+you\s+could\s+win|total\s+prize\s+pool|prize\s+(?:detail|description|structure))/i, text) ?? ''

  const prizes: ExtractedPrize[] = []

  // ── Total prize pool ──────────────────────
  let totalPrizePool: ExtractedField<number> = fieldAbsent()
  let totalPrizePoolRaw: ExtractedField<string> = fieldAbsent()
  const poolMatch = findFirst(
    /total\s+(?:prize\s+)?(?:pool|value)[:\s]+\$?([\d,]+(?:\.\d{1,2})?)/i,
    text
  )
  if (poolMatch) {
    const val = extractDollarAmount(poolMatch.match)
    totalPrizePoolRaw = fieldOf(poolMatch.match.trim().slice(0, 100), 'high', poolMatch.match, poolMatch.offset)
    if (val !== null) totalPrizePool = fieldOf(val, 'high', poolMatch.match, poolMatch.offset)
  } else {
    // Scan all dollar amounts in prize section, take the largest as pool
    const amounts = findAll(/\$[\d,]+(?:\.\d{1,2})?/g, prizeBody || text.slice(0, 3000))
    const values = amounts.map((m) => ({ raw: m.match, val: extractDollarAmount(m.match) ?? 0 }))
    const largest = values.sort((a, b) => b.val - a.val)[0]
    if (largest && largest.val > 100) {
      totalPrizePool = fieldOf(largest.val, 'low', largest.raw)
      totalPrizePoolRaw = fieldOf(largest.raw, 'low', largest.raw)
    }
  }

  // ── Number of winners ─────────────────────
  let numberOfWinners: ExtractedField<number> = fieldAbsent()
  const winnersMatch = findFirst(
    /(?:(\d+)\s+(?:winner|prize)[s]?\s+(?:will\s+be\s+)?(?:drawn|selected|awarded)|(?:drawn|select|award)\s+(\d+)\s+winner)/i,
    text
  )
  if (winnersMatch) {
    const n = parseInt(winnersMatch.groups[0] ?? winnersMatch.groups[1] ?? winnersMatch.match.match(/\d+/)?.[0] ?? '')
    if (!isNaN(n)) numberOfWinners = fieldOf(n, 'high', winnersMatch.match, winnersMatch.offset)
  } else {
    // "one (1) winner" pattern
    const oneMatch = findFirst(/one\s+\(1\)\s+(?:lucky\s+)?winner|one\s+winner/i, text)
    if (oneMatch) numberOfWinners = fieldOf(1, 'high', oneMatch.match, oneMatch.offset)
  }

  // ── Individual prizes ─────────────────────
  // Prize 1 / Prize 2 / First prize / Major prize patterns
  const prizePatterns = [
    /(?:^|\n)(?:prize\s+)?(?:1|one|first|major|grand)[:\s]+(.{10,300}?)(?=\n|prize\s+[2-9]|$)/gi,
    /(?:^|\n)(?:prize\s+)?(?:2|two|second)[:\s]+(.{10,300}?)(?=\n|prize\s+[3-9]|$)/gi,
    /(?:^|\n)(?:prize\s+)?(?:3|three|third)[:\s]+(.{10,300}?)(?=\n|prize\s+[4-9]|$)/gi,
  ]

  const prizeSearchText = prizeBody || text
  let rank = 1
  for (const pattern of prizePatterns) {
    const matches = findAll(pattern, prizeSearchText)
    for (const m of matches.slice(0, 1)) {
      const desc = m.match.replace(/^[^\n]*\n?/, '').trim() || m.match.trim()
      const val = extractDollarAmount(desc)
      const types = detectPrizeTypes(desc)
      prizes.push({
        rank,
        description: fieldOf(desc.slice(0, 300), 'medium', desc.slice(0, 150)),
        quantity: fieldOf(1, 'low', '1'),
        valueIncGst: val !== null ? fieldOf(val, 'medium', `$${val}`) : fieldAbsent(),
        valueRaw: fieldOf(desc.slice(0, 100), 'medium', desc.slice(0, 100)),
        prizeType: fieldOf(types, 'medium', types.join(', ')),
        inclusions: fieldAbsent(),
        hasTravelComponent: types.includes('travel') || types.includes('accommodation') || types.includes('holiday'),
        hasEventComponent: types.includes('event'),
      })
      rank++
    }
  }

  // If no structured prizes found, try to extract from prize body as single prize
  if (prizes.length === 0 && prizeBody && prizeBody.length > 10) {
    const val = extractDollarAmount(prizeBody)
    const types = detectPrizeTypes(prizeBody)
    prizes.push({
      rank: 1,
      description: fieldOf(prizeBody.slice(0, 300), 'low', prizeBody.slice(0, 150)),
      quantity: numberOfWinners.value ? fieldOf(numberOfWinners.value, 'low', String(numberOfWinners.value)) : fieldAbsent(),
      valueIncGst: val !== null ? fieldOf(val, 'medium', `$${val}`) : fieldAbsent(),
      valueRaw: fieldOf(prizeBody.slice(0, 100), 'low', prizeBody.slice(0, 100)),
      prizeType: fieldOf(types, 'medium', types.join(', ')),
      inclusions: fieldAbsent(),
      hasTravelComponent: types.includes('travel') || types.includes('accommodation') || types.includes('holiday'),
      hasEventComponent: types.includes('event'),
    })
  }

  const hasTravelPrize = prizes.some((p) => p.hasTravelComponent) ||
    /\b(flight|airfare|air\s+travel|accommodation|hotel|resort|cruise|travel\s+prize)\b/i.test(text)
  const hasEventPrize = prizes.some((p) => p.hasEventComponent) ||
    /\b(concert\s+ticket|event\s+ticket|festival\s+ticket|show\s+ticket|venue\s+ticket)\b/i.test(text)

  return {
    prizes,
    totalPrizePool,
    totalPrizePoolRaw,
    numberOfWinners,
    hasTravelPrize,
    hasEventPrize,
  }
}

// ─── Compliance extractors ────────────────────

export function extractCompliance(text: string): ExtractedCompliance {
  // Permit numbers
  const rawPermits = extractPermitNumbers(text)
  const permitNumbers: ExtractedField<Record<string, string>> = Object.keys(rawPermits).length > 0
    ? fieldOf(rawPermits, 'high', Object.entries(rawPermits).map(([k, v]) => `${k}: ${v}`).join(', '))
    : fieldAbsent()

  const permitStates: ExtractedField<string[]> = Object.keys(rawPermits).length > 0
    ? fieldOf(Object.keys(rawPermits), 'high', Object.keys(rawPermits).join(', '))
    : fieldAbsent()

  // Privacy policy URL
  const privacyBody = getSectionBody(/^(privacy|personal\s+information|privacy\s+policy)/i, text) ?? text
  const privacyUrl = extractPrivacyUrl(privacyBody)
  const privacyPolicyUrl: ExtractedField<string> = privacyUrl
    ? fieldOf(privacyUrl, 'high', privacyUrl)
    : fieldAbsent()

  // Notification method
  const notifBody = getSectionBody(/^winner\s+notification|^(how\s+will\s+the\s+winner|contacting\s+the\s+winner)/i, text) ?? text
  const notifMethods: string[] = []
  if (/\bemail\b/i.test(notifBody)) notifMethods.push('email')
  if (/\bphone\b|\bcall\b|\btelephone\b/i.test(notifBody)) notifMethods.push('phone')
  if (/\bmail\b|\bpost\b|\bletter\b/i.test(notifBody)) notifMethods.push('mail')
  if (/\bsms\b|\btext\s+message\b/i.test(notifBody)) notifMethods.push('sms')
  const notificationMethod: ExtractedField<string[]> = notifMethods.length > 0
    ? fieldOf(notifMethods, 'high', notifMethods.join(', '))
    : fieldAbsent()

  // Notification days
  let notificationDaysAfterDraw: ExtractedField<number> = fieldAbsent()
  const daysMatch = findFirst(
    /(?:within|no\s+later\s+than)\s+(\d+)\s+(?:business\s+)?days?\s+(?:of|after|following)\s+(?:the\s+)?draw/i,
    notifBody
  )
  if (daysMatch) {
    const n = parseInt(daysMatch.groups[0] ?? daysMatch.match.match(/\d+/)?.[0] ?? '')
    if (!isNaN(n)) notificationDaysAfterDraw = fieldOf(n, 'high', daysMatch.match, daysMatch.offset)
  }

  // Publication required
  let publicationRequired: ExtractedField<boolean> = fieldAbsent()
  const pubMatch = findFirst(
    /(?:published?|publish(?:ed)?\s+(?:on|at))\s+(?:at\s+)?(?:the\s+)?(?:website|online|turnstyle)/i,
    text
  )
  if (pubMatch) publicationRequired = fieldOf(true, 'medium', pubMatch.match, pubMatch.offset)

  // GST treatment
  let gstTreatment: ExtractedField<'incl' | 'excl' | 'unknown'> = fieldAbsent()
  if (/(?:including|inc\.?)\s+gst|\(inc\s+gst\)/i.test(text)) {
    const m = findFirst(/including\s+gst|inc\.?\s+gst|\(inc\s+gst\)/i, text)
    gstTreatment = fieldOf('incl', 'high', m?.match ?? 'inc GST', m?.offset)
  } else if (/(?:excluding|excl\.?)\s+gst|\(excl\s+gst\)/i.test(text)) {
    const m = findFirst(/excluding\s+gst|excl\.?\s+gst/i, text)
    gstTreatment = fieldOf('excl', 'high', m?.match ?? 'excl GST', m?.offset)
  } else if (/\bgst\b/i.test(text)) {
    gstTreatment = fieldOf('unknown', 'low', 'GST mentioned but treatment unclear')
  }

  return {
    permitNumbers,
    permitStates,
    privacyPolicyUrl,
    notificationMethod,
    notificationDaysAfterDraw,
    publicationRequired,
    gstTreatment,
  }
}
