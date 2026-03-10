/**
 * Turnstyle Quote Engine v0.1.5 — TypeScript port
 *
 * Exact parity with turnstyle-quote-engine.php
 * All pricing rules extracted and tested.
 *
 * Usage:
 *   import { calculateQuote } from './quote-engine'
 *   const quote = calculateQuote(input)
 */

export const ENGINE_VERSION = '0.1.5'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MechanicType = 'sweepstakes' | 'limited' | 'instant_win' | 'game_of_skill' | 'other' | 'draw_only'
export type DrawFrequency =
  | 'at_conclusion'
  | 'daily'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'hourly'

export interface PrizeTier {
  tier: string
  description: string
  qty: number
  unitValue: number
}

export interface QuoteInput {
  campaignId: string
  tsCode: string           // 5-char routing code e.g. "NEWCF"
  campaignName: string
  promoterName?: string
  contactName?: string
  contactEmail?: string
  promoStart: string       // ISO date string "YYYY-MM-DD"
  promoEnd: string         // ISO date string "YYYY-MM-DD"
  drawMechanic: string     // raw string from form e.g. "Sweepstakes - Random Draw"
  drawFrequency: string    // raw string from form e.g. "Weekly"
  overrideDrawCount?: number
  prizes: PrizeTier[]
  // Computed from prizes:
  prizePoolTotal?: number  // if not provided, computed from prizes array
}

export interface QuoteLine {
  label: string
  amount: number
  note: string
}

export interface QuoteResult {
  quoteNumber: string      // e.g. "TS25NEWCF"
  quoteHash: string        // SHA-1 fingerprint for change detection
  engineVersion: string

  promoType: MechanicType
  promoTypeLabel: string

  prizePoolTotal: number
  drawCount: number
  promoStartFormatted: string
  promoEndFormatted: string
  finalDrawDate: string
  showDrawWindow: boolean  // false when "at conclusion"

  lines: QuoteLine[]
  termsFee: number
  mgmtFee: number
  permitFee: number
  drawFee: number
  totalExGst: number
  gstAmount: number
  totalIncGst: number

  validUntil: string       // ISO date string (+7 days from today)
  snapshotJson: object     // full input snapshot for audit
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculateQuote(input: QuoteInput): QuoteResult {
  const prizePoolTotal =
    input.prizePoolTotal ??
    input.prizes.reduce((sum, p) => sum + p.qty * p.unitValue, 0)

  const promoType = resolvePromoType(input.drawMechanic)
  const promoTypeLabel = promoTypeLabels[promoType]

  const start = parseDate(input.promoStart)
  const end   = parseDate(input.promoEnd)

  const drawCount    = input.overrideDrawCount ?? calculateDrawCount(input.drawFrequency, start, end)
  const isConclusion = isAtConclusionFrequency(input.drawFrequency)

  const termsFee  = calcTermsFee(promoType, prizePoolTotal)
  const mgmtFee   = calcMgmtFee(promoType, prizePoolTotal)
  const noPermit = ['draw_only', 'limited', 'game_of_skill', 'other'].includes(promoType)
  const permitFee = noPermit ? 0 : calcPermitFee(prizePoolTotal)
  const noDrawFee = ['limited', 'game_of_skill', 'other'].includes(promoType)
  const drawFee   = noDrawFee ? 0 : calcDrawFee(drawCount)

  const totalExGst  = termsFee + mgmtFee + permitFee + drawFee
  const gstAmount   = Math.round(totalExGst * 0.1 * 100) / 100
  const totalIncGst = Math.round((totalExGst + gstAmount) * 100) / 100

  const quoteNumber = buildQuoteNumber(input.tsCode)
  const quoteHash   = buildQuoteHash({
    engineVersion:  ENGINE_VERSION,
    drawMechanic:   input.drawMechanic,
    drawFrequency:  input.drawFrequency,
    promoStart:     input.promoStart,
    promoEnd:       input.promoEnd,
    prizePoolTotal: String(prizePoolTotal),
  })

  const lines: QuoteLine[] = [
    {
      label:  'Terms & Conditions (draft)',
      amount: termsFee,
      note:   termsFeeNote(promoType, prizePoolTotal),
    },
    {
      label:  'Campaign Management',
      amount: mgmtFee,
      note:   mgmtFeeNote(promoType, prizePoolTotal),
    },
    {
      label:  'Permit Fees (estimate)',
      amount: permitFee,
      note:   permitFeeNote(promoType, prizePoolTotal),
    },
    {
      label:  'Draw Administration',
      amount: drawFee,
      note:   noDrawFee ? 'Not applicable' : `${drawCount} draw(s) · frequency: ${input.drawFrequency || 'At conclusion'}`,
    },
  ]

  const validUntil = addDays(new Date(), 7).toISOString().split('T')[0]

  return {
    quoteNumber,
    quoteHash,
    engineVersion: ENGINE_VERSION,

    promoType,
    promoTypeLabel,

    prizePoolTotal,
    drawCount,
    promoStartFormatted: formatDate(start),
    promoEndFormatted:   formatDate(end),
    finalDrawDate:       formatDate(addDays(end, 5)),
    showDrawWindow:      !isConclusion,

    lines,
    termsFee,
    mgmtFee,
    permitFee,
    drawFee,
    totalExGst,
    gstAmount,
    totalIncGst,

    validUntil,
    snapshotJson: {
      engineVersion:  ENGINE_VERSION,
      drawMechanic:   input.drawMechanic,
      drawFrequency:  input.drawFrequency,
      promoStart:     input.promoStart,
      promoEnd:       input.promoEnd,
      prizePoolTotal,
      prizes:         input.prizes,
    },
  }
}

// ─── Promo type resolution ────────────────────────────────────────────────────

const promoTypeLabels: Record<MechanicType, string> = {
  sweepstakes: 'Sweepstakes',
  limited:     'Limited offer',
  instant_win: 'Sweepstakes',  // treated same as sweepstakes for pricing
  game_of_skill: 'Game of Skill',
  other:       'Other / unsure',
  draw_only:   'Draw Only',
}

export function resolvePromoType(drawMechanic: string): MechanicType {
  const m = drawMechanic.toLowerCase()
  if (m.includes('draw only') || m.includes('draw_only')) return 'draw_only'
  if (m.includes('limited'))    return 'limited'
  if (m.includes('sweep'))      return 'sweepstakes'
  if (m.includes('instant'))    return 'instant_win'
  if (m.includes('skill'))      return 'game_of_skill'
  return 'other'
}

// ─── Terms fee ────────────────────────────────────────────────────────────────

export function calcTermsFee(promoType: MechanicType, prizePool: number): number {
  if (promoType === 'draw_only') return 0
  if (promoType === 'limited') return 450
  return prizePool < 10_000 ? 450 : 550
}

function termsFeeNote(promoType: MechanicType, prizePool: number): string {
  if (promoType === 'limited') return 'Limited offer rate'
  if (promoType === 'draw_only') return 'Not Applicable'
  if (promoType === 'game_of_skill') return 'Game of Skill rate'
  if (promoType === 'other') return 'Other rate'
  return prizePool < 10_000
    ? 'Sweepstakes (< $10k prize pool)'
    : 'Sweepstakes (≥ $10k prize pool)'
}

// ─── Management fee ───────────────────────────────────────────────────────────

export function calcMgmtFee(promoType: MechanicType, prizePool: number): number {
  if (promoType === 'draw_only') return 100
  if (promoType === 'limited') return 100
  if (promoType === 'game_of_skill') return 100
  if (promoType === 'other') return 100
  if (prizePool < 5_000)  return 250
  if (prizePool < 10_000) return 450
  return 550
}

function mgmtFeeNote(promoType: MechanicType, prizePool: number): string {
  if (promoType === 'limited') return 'Limited offer management'
  if (promoType === 'draw_only') return 'Draw Only management'
  if (promoType === 'game_of_skill') return 'Game of Skill management'
  if (promoType === 'other') return 'Other management'
  if (prizePool < 5_000)  return 'Sweepstakes (< $5k prize pool)'
  if (prizePool < 10_000) return 'Sweepstakes ($5k – $9,999)'
  return 'Sweepstakes (≥ $10k prize pool)'
}

// ─── Permit fee ───────────────────────────────────────────────────────────────
// State-based threshold logic — NSW, VIC, ACT, SA require permits above $5,000
// Current engine uses total prize pool as proxy (state-level breakdown in v2)

export function calcPermitFee(prizePool: number): number {
  if (prizePool < 3_000)   return 0
  if (prizePool < 5_000)   return 275
  if (prizePool < 10_000)  return 675
  if (prizePool < 50_000)  return 2_365
  if (prizePool < 100_000) return 3_505
  if (prizePool < 200_000) return 6_375
  return 11_305
}

function permitFeeNote(promoType: MechanicType, prizePool: number): string {
  if (['limited', 'game_of_skill', 'other', 'draw_only'].includes(promoType)) return 'Not applicable'
  if (prizePool < 3_000)   return 'Prize pool < $3,000 — no permit required'
  if (prizePool < 5_000)   return '$3,000 – $4,999'
  if (prizePool < 10_000)  return '$5,000 – $9,999'
  if (prizePool < 50_000)  return '$10,000 – $49,999'
  if (prizePool < 100_000) return '$50,000 – $99,999'
  if (prizePool < 200_000) return '$100,000 – $199,999'
  return '$200,000+'
}

// ─── Draw fee ─────────────────────────────────────────────────────────────────
// Base: $275 for draw 1
// Draws 2–4: +$125 each
// Draws 5+:  +$95 each

export function calcDrawFee(draws: number): number {
  const n = Math.max(1, draws)
  if (n === 1) return 275
  if (n <= 4)  return 275 + (n - 1) * 125
  return 275 + 3 * 125 + (n - 4) * 95
}

// ─── Draw count calculation ───────────────────────────────────────────────────

export function isAtConclusionFrequency(freq: string): boolean {
  const f = freq.toLowerCase().trim()
  if (f === '')                      return true
  if (f === 'at_conclusion')         return true
  if (f.includes('conclusion'))      return true
  if (f.includes('unsure'))          return true
  return false
}

export function calculateDrawCount(
  drawFrequency: string,
  start: Date,
  end: Date,
): number {
  if (isAtConclusionFrequency(drawFrequency)) return 1

  const f    = drawFrequency.toLowerCase().trim()
  const days = diffDaysInclusive(start, end)

  if (f === 'daily'       || f.includes('daily'))       return days
  if (f === 'weekly'      || f.includes('weekly'))      return Math.floor((days - 1) / 7) + 1
  if (f === 'fortnightly' || f.includes('fortnight'))   return Math.floor((days - 1) / 14) + 1
  if (f === 'hourly'      || f.includes('hourly')) {
    const hours = Math.floor((end.getTime() - start.getTime()) / 3_600_000) + 1
    return Math.max(1, Math.min(10_000, hours))
  }
  if (f === 'monthly' || f.includes('monthly')) {
    let count = 0
    const cur = new Date(start)
    while (cur <= end && count < 240) {
      count++
      cur.setMonth(cur.getMonth() + 1)
    }
    return Math.max(1, count)
  }

  return 1 // fallback
}

// ─── Quote number & hash ──────────────────────────────────────────────────────

export function buildQuoteNumber(tsCode: string): string {
  const yy = new Date().getFullYear().toString().slice(-2)
  return `TS${yy}${tsCode.toUpperCase()}`
}

export function buildQuoteHash(inputs: Record<string, string>): string {
  // Simple deterministic hash — in Node.js use crypto.createHash('sha1')
  // This version works in both Node and Edge environments
  const str = JSON.stringify(inputs)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// For Node.js environments, use this instead (more collision-resistant):
// import { createHash } from 'crypto'
// export function buildQuoteHash(inputs: Record<string, string>): string {
//   return createHash('sha1').update(JSON.stringify(inputs)).digest('hex')
// }

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0)
}

export function diffDaysInclusive(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(),   end.getMonth(),   end.getDate())
  return Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
