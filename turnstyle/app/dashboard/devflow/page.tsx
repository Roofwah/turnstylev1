'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createCampaign, createDrawOnlyCampaign } from '@/app/actions/campaigns'
import {
  calculateQuote,
  calculateDrawCount,
  calcDrawFee,
  calcTermsFee,
  calcMgmtFee,
  calcPermitFee,
  resolvePromoType,
  parseDate,
  diffDaysInclusive,
  formatMoney,
} from '@/lib/quote-engine'
import { searchPromoters, type PromoterRecord } from '@/lib/promoter-lookup'
import DatePickerField from '@/components/DatePickerField'
import PrizeEntryDialog from '@/components/PrizeEntryDialog'

/**
 * Devflow — streamlined campaign creation (airline-booking style).
 * Captures all key inputs with progressive disclosure. No wizards or heavy calculators.
 * Existing /dashboard/new is unchanged.
 */

const AU_REGIONS_COMBINED = ['NSW/ACT', 'VIC/TAS', 'SA/NT', 'QLD/NT', 'WA/SA/NT']
const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

function expandRegionsToStateCodes(selected: string[]): string[] {
  const combinedToStates: Record<string, string[]> = {
    'NSW/ACT': ['NSW', 'ACT'],
    'VIC/TAS': ['VIC', 'TAS'],
    'SA/NT': ['SA', 'NT'],
    'QLD/NT': ['QLD', 'NT'],
    'WA/SA/NT': ['WA', 'SA', 'NT'],
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of selected) {
    const states = combinedToStates[r]
    if (states) for (const s of states) if (!seen.has(s)) { seen.add(s); out.push(s) }
    else if (!seen.has(r)) { seen.add(r); out.push(r) }
  }
  return out
}

const MECHANICS = [
  { value: 'Sweepstakes', label: 'Sweepstakes' },
  { value: 'Instant Win', label: 'Instant Win' },
  { value: 'Limited Offer', label: 'Limited Offer' },
  { value: 'Game of Skill', label: 'Game of Skill' },
  { value: 'Draw Only', label: 'Draw Only' },
]

const ENTRY_OPTIONS = [
  { value: 'Account Based Purchases', label: 'Account Purchase' },
  { value: 'Purchase & Show Loyalty Card', label: 'Loyalty Card Purchase' },
  { value: 'Online - Purchase Required', label: 'Online & Purchase' },
  { value: 'Online - No Purchase', label: 'Online No Purchase' },
]

const DRAW_STRUCTURE = [
  { value: 'at_conclusion', label: 'At Conclusion' },
  { value: 'minor_and_final', label: 'Minor Draws Prior to Major Draw' },
  { value: 'minor_only', label: 'Minor Draws Only' },
]

const DRAW_FREQUENCY = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]

function tsCodeFromName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5).padEnd(5, 'X')
}

function formatLongDate(yyyyMmDd: string): string {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd
  const d = new Date(yyyyMmDd + 'T12:00:00')
  if (isNaN(d.getTime())) return yyyyMmDd
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' })
  const day = d.getDate()
  const n = day % 100
  const suffix = n >= 11 && n <= 13 ? 'th' : (day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th')
  const month = d.toLocaleDateString('en-AU', { month: 'long' })
  const year = d.getFullYear()
  return `${weekday} ${day}${suffix} ${month} ${year}`
}

export default function DevflowPage() {
  const [saving, setSaving] = useState(false)

  const [promoterName, setPromoterName] = useState('')
  const [promoterAbn, setPromoterAbn] = useState('')
  const [promoterAddress, setPromoterAddress] = useState('')
  const [promoterSuggestions, setPromoterSuggestions] = useState<PromoterRecord[]>([])
  const [promoterLocked, setPromoterLocked] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [campaignName, setCampaignName] = useState('')
  const [drawMechanic, setDrawMechanic] = useState('Sweepstakes')
  const [entryMechanic, setEntryMechanic] = useState('')
  const [drawStructure, setDrawStructure] = useState('at_conclusion')
  const [drawFrequency, setDrawFrequency] = useState('weekly')
  const [nationalOrState, setNationalOrState] = useState<'national' | 'state'>('national')
  const [stateRegions, setStateRegions] = useState<string[]>([])

  const [promoStart, setPromoStart] = useState('')
  const [promoEnd, setPromoEnd] = useState('')
  const [draws, setDraws] = useState<{ date: string; time: string; winners: number }[]>([{ date: '', time: '12:00', winners: 1 }])
  const [overrideMinorDraws, setOverrideMinorDraws] = useState<string>('')

  const [prizes, setPrizes] = useState([
    { tier: '1', description: '', type: '', qty: 1, unitValue: 0 },
  ])
  const [editingPrizeIndex, setEditingPrizeIndex] = useState<number | null>(null)
  const isDrawOnly = drawMechanic === 'Draw Only'
  const isSweepstakes = drawMechanic === 'Sweepstakes'
  const showEntry = !isDrawOnly
  const showDrawSection = drawMechanic === 'Sweepstakes'

  const STEP_LABELS = ['Contact & promoter', 'Campaign', 'Dates', 'Draw structure', 'Prizes', 'Review']
  const stepLabel = (i: number) =>
    isDrawOnly && i === 4 ? 'Review' : (i === 3 && isDrawOnly ? 'Terms & conditions' : STEP_LABELS[i])
  const TOTAL_STEPS = isDrawOnly ? 5 : 6
  const [step, setStep] = useState(0)
  const [drawOnlyTermsFile, setDrawOnlyTermsFile] = useState<File | null>(null)
  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const regions = nationalOrState === 'national' ? ['national_au'] : stateRegions.length ? expandRegionsToStateCodes(stateRegions) : ['national_au']

  const toggleState = (state: string) => {
    setStateRegions(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    )
  }

  const addPrize = () => {
    setPrizes(prev => [...prev, { tier: String(prev.length + 1), description: '', type: '', qty: 1, unitValue: 0 }])
  }
  const updatePrize = (i: number, field: string, value: string | number) => {
    setPrizes(prev => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
  }

  const addDraw = () => setDraws(prev => [...prev, { date: prev[0]?.date ?? '', time: '12:00', winners: 1 }])
  const updateDraw = (i: number, field: 'date' | 'time' | 'winners', value: string | number) => {
    setDraws(prev => prev.map((d, j) => (j === i ? { ...d, [field]: value } : d)))
  }
  const removeDraw = (i: number) => setDraws(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)

  const prizePoolTotal = prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)

  // Live calculations for diagnostics (dates, draw structure, prizes, permits)
  const diagnostics = useMemo(() => {
    const promoType = resolvePromoType(drawMechanic)
    const prizePool = prizePoolTotal
    const noPermit = ['draw_only', 'limited', 'game_of_skill', 'other'].includes(promoType)
    const noDrawFee = ['limited', 'game_of_skill', 'other'].includes(promoType)

    if (isDrawOnly) {
      const drawCount = draws.filter(d => d.date && d.time).length
      const termsFee = 0
      const mgmtFee = 100
      const permitFee = 0
      const drawFee = calcDrawFee(drawCount)
      const totalExGst = termsFee + mgmtFee + permitFee + drawFee
      const gstAmount = Math.round(totalExGst * 0.1 * 100) / 100
      const totalIncGst = Math.round((totalExGst + gstAmount) * 100) / 100
      const totalWinners = draws.reduce((s, d) => s + (Number(d.winners) || 0), 0)
      const promoLabel = drawCount === 0
        ? 'Set draw date(s)'
        : drawCount === 1 && draws[0]?.date
          ? `1 draw: ${formatLongDate(draws[0].date)}`
          : `${drawCount} draws`
      return {
        promoDays: 0,
        promoLabel,
        drawCount,
        totalWinners,
        baseDrawCount: drawCount,
        calculatedFromDates: drawCount,
        structureDrawCount: drawCount,
        structureLabel: 'At Conclusion',
        regionCount: 1,
        regionLabel: 'National (1 region)',
        prizePool,
        termsFee,
        mgmtFee,
        permitFee,
        drawFee,
        totalExGst,
        gstAmount,
        totalIncGst,
        permitsSelected: [] as string[],
      }
    }

    if (!promoStart || !promoEnd) {
      return null
    }
    const start = parseDate(promoStart)
    const end = parseDate(promoEnd)
    const promoDays = diffDaysInclusive(start, end)
    const calculatedFromDates = calculateDrawCount(drawFrequency, start, end)
    const overrideNum = overrideMinorDraws !== '' && /^\d+$/.test(overrideMinorDraws) ? Math.max(1, parseInt(overrideMinorDraws, 10)) : null
    const baseDrawCount = overrideNum ?? calculatedFromDates
    const structureDrawCount =
      drawStructure === 'at_conclusion'
        ? 1
        : drawStructure === 'minor_and_final'
          ? baseDrawCount + 1
          : baseDrawCount // minor_only or other
    // Draw count uses number of selected region options (e.g. 5 chosen = 5 draws), not expanded state codes
    const regionCount =
      nationalOrState === 'national' ? 1 : Math.max(0, stateRegions.length)
    const effectiveRegions = regionCount > 0 ? regionCount : 1
    const drawCount = structureDrawCount * effectiveRegions
    const termsFee = calcTermsFee(promoType, prizePool)
    const mgmtFee = calcMgmtFee(promoType, prizePool)
    const permitFee = noPermit ? 0 : calcPermitFee(prizePool)
    const drawFee = noDrawFee ? 0 : calcDrawFee(drawCount)
    const totalExGst = termsFee + mgmtFee + permitFee + drawFee
    const gstAmount = Math.round(totalExGst * 0.1 * 100) / 100
    const totalIncGst = Math.round((totalExGst + gstAmount) * 100) / 100
    const structureLabel =
      drawStructure === 'at_conclusion'
        ? 'At Conclusion'
        : drawStructure === 'minor_and_final'
          ? 'Minor prior to major'
          : 'Minor only'
    const regionLabel =
      nationalOrState === 'national'
        ? 'National (1 region)'
        : regionCount > 0
          ? `State based (${regionCount} region${regionCount !== 1 ? 's' : ''})`
          : 'State based (select regions)'

    const noDraws = noDrawFee
    const outDrawCount = noDraws ? 0 : drawCount
    const outStructureLabel = noDraws ? 'No draws' : structureLabel
    const outStructureDrawCount = noDraws ? 0 : structureDrawCount
    const outBaseDrawCount = noDraws ? 0 : baseDrawCount
    const outCalculatedFromDates = noDraws ? 0 : calculatedFromDates
    const outRegionCount = noDraws ? 1 : effectiveRegions
    const outRegionLabel = noDraws ? 'National' : regionLabel

    return {
      promoDays,
      promoLabel: `${promoStart} → ${promoEnd} (${promoDays} day${promoDays !== 1 ? 's' : ''})`,
      drawCount: outDrawCount,
      baseDrawCount: outBaseDrawCount,
      calculatedFromDates: outCalculatedFromDates,
      structureDrawCount: outStructureDrawCount,
      structureLabel: outStructureLabel,
      regionCount: outRegionCount,
      regionLabel: outRegionLabel,
      prizePool,
      termsFee,
      mgmtFee,
      permitFee,
      drawFee,
      totalExGst,
      gstAmount,
      totalIncGst,
      permitsSelected: [] as string[],
    }
  }, [
    isDrawOnly,
    drawMechanic,
    drawFrequency,
    drawStructure,
    nationalOrState,
    stateRegions,
    promoStart,
    promoEnd,
    draws,
    prizePoolTotal,
    overrideMinorDraws,
  ])

  // Permit readiness: can permits be acquired in time for promo start?
  const PERMIT_LEAD_DAYS: Record<string, number> = { ACT: 5.5, NSW: 2.5, SA: 10.5 }
  const permitReadiness = useMemo(() => {
    if (drawMechanic !== 'Sweepstakes' && drawMechanic !== 'Instant Win') return null
    const startDateStr = isDrawOnly ? (draws[0]?.date ?? '') : promoStart
    if (!startDateStr) return null
    const r = regions
    const totalPool = prizePoolTotal
    const isStateBased = !r.includes('national_au') && stateRegions.length > 0
    const regionCount = isStateBased ? stateRegions.length : 1
    const prizeForPermit = regionCount <= 1 ? totalPool : totalPool / regionCount
    const required: string[] = []
    if ((r.includes('national_au') || r.includes('ACT')) && prizeForPermit > 3000) required.push('ACT')
    if ((r.includes('national_au') || r.includes('SA')) && prizeForPermit > 5000) required.push('SA')
    if ((r.includes('national_au') || r.includes('NSW')) && prizeForPermit > 10000) required.push('NSW')
    if (required.length === 0) return { required: [], businessDaysUntilStart: null, rows: [], prizeForPermit, regionCount, permitIssuePossible: true, saRushFeeAmount: 0 }

    const startDate = new Date(startDateStr)
    let businessDaysUntilStart = 0
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const end = new Date(startDate)
    end.setHours(0, 0, 0, 0)
    while (d < end) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) businessDaysUntilStart++
    }

    const saRushFee = (p: number) => (p <= 10000 ? 270 : p <= 50000 ? 955 : p <= 100000 ? 1650 : 2800)
    const days = businessDaysUntilStart
    const saRushOnly = required.includes('SA') && days >= 5.5 && days < 10.5
    const saRushFeeAmount = saRushOnly ? saRushFee(prizeForPermit) : 0

    const rows = required.map(state => {
      const lead = PERMIT_LEAD_DAYS[state]
      let icon = '✅'
      let msg = ''
      let color = 'text-emerald-400'
      const estDate = new Date()
      let bd = 0
      while (bd < lead) {
        estDate.setDate(estDate.getDate() + 1)
        if (estDate.getDay() !== 0 && estDate.getDay() !== 6) bd++
      }
      const estStr = estDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      if (days < 5.5) {
        icon = '❌'
        msg = `Too late — starts in ${days} business day${days === 1 ? '' : 's'}`
        color = 'text-red-400'
      } else if (state === 'SA' && days < 10.5) {
        icon = '⚠️'
        msg = `Rush only* · est. issue ${estStr} (+$${saRushFee(prizeForPermit).toLocaleString()})`
        color = 'text-amber-400'
      } else {
        const rush = state === 'SA' ? ` · Rush available* (+$${saRushFee(prizeForPermit).toLocaleString()})` : ''
        icon = '✅'
        msg = `Ready — est. issue ${estStr}${rush}`
        color = 'text-emerald-400'
      }
      return { state, icon, msg, color, estStr, tooLate: days < 5.5 }
    })

    const permitIssuePossible = !rows.some(r => r.tooLate)
    return { required, businessDaysUntilStart, rows, prizeForPermit, regionCount, permitIssuePossible, saRushFeeAmount }
  }, [isDrawOnly, drawMechanic, draws, promoStart, regions, stateRegions.length, prizePoolTotal])

  const permitBlock = permitReadiness && permitReadiness.required.length > 0 && !permitReadiness.permitIssuePossible
  const canSubmit =
    !permitBlock &&
    promoterName.trim() &&
    contactName.trim() &&
    contactEmail.trim() &&
    campaignName.trim() &&
    (isDrawOnly ? draws.some(d => d.date && d.time && (Number(d.winners) || 0) >= 1) : (promoStart && promoEnd && regions.length)) &&
    (isDrawOnly || prizes.every(p => p.description && p.qty >= 1 && p.unitValue > 0))

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const prizePayload = prizes.map((p, i) => ({
        tier: String(i + 1),
        description: p.description,
        qty: Number(p.qty),
        unitValue: Number(p.unitValue),
        ...(('type' in p && p.type) ? { type: p.type } : {}),
      }))
      if (isDrawOnly) {
        await createDrawOnlyCampaign({
          promoterName: promoterName.trim(),
          promoterAbn: promoterAbn.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          promoterAddress: promoterAddress.trim(),
          campaignName: campaignName.trim(),
          draws: draws.filter(d => d.date && d.time).map(d => ({ drawDate: d.date, drawTime: d.time, winners: Number(d.winners) || 1 })),
          prizes: prizePayload,
        })
        return
      }
      const tsCode = tsCodeFromName(campaignName)
      await createCampaign({
        promoterName: promoterName.trim(),
        promoterAbn: promoterAbn.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        promoterAddress: promoterAddress.trim(),
        campaignName: campaignName.trim(),
        tsCode,
        promoStart,
        promoEnd,
        notes: '',
        drawMechanic,
        drawFrequency: showDrawSection ? drawFrequency : 'at_conclusion',
        entryMechanic: drawMechanic === 'Game of Skill' ? 'Online - No Purchase' : (showEntry ? entryMechanic : ''),
        regions: (drawMechanic === 'Limited Offer' || drawMechanic === 'Game of Skill') ? ['national_au'] : regions,
        prizes: prizePayload,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30'
  const labelClass = 'block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5'

  // Start/draw: no dates before tomorrow. End >= start. Default end to last day of following month.
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  })()
  const minStartDate = tomorrow
  const minEndDate = promoStart || minStartDate

  function lastDayOfNextMonth(startYyyyMmDd: string): string {
    const [y, m] = startYyyyMmDd.split('-').map(Number) // m 1-12
    const nextYear = m === 12 ? y + 1 : y
    const nextMonth0 = m === 12 ? 0 : m // 0-based next month (April = 3 when m=3)
    const last = new Date(nextYear, nextMonth0 + 1, 0) // day 0 = last day of month nextMonth0
    return last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden w-full">
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm">← Dashboard</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Devflow</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 min-w-0 w-full">
        {/* Step progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Step {step + 1} of {TOTAL_STEPS}</span>
            <span className="text-white/70 text-sm">{stepLabel(step)}</span>
          </div>
          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-white/90 rounded-full transition-all duration-300 ease-out" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <section>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Name</label>
                  <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your name" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@company.com" className={inputClass} />
                </div>
              </div>
            </section>
            <section>
              <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Promoter</h2>
              <div className="space-y-3">
                <div className="relative">
                  <label className={labelClass}>Promoter name {!promoterLocked && <span className="text-amber-400/70 normal-case font-normal">(type to search)</span>}</label>
                  <input
                    type="text"
                    value={promoterName}
                    onChange={e => {
                      setPromoterName(e.target.value)
                      setPromoterLocked(false)
                      setPromoterSuggestions(e.target.value.length >= 3 ? searchPromoters(e.target.value) : [])
                    }}
                    placeholder="e.g. Repco, Woolworths..."
                    className={inputClass}
                  />
                  {promoterSuggestions.length > 0 && !promoterLocked && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/[0.12] rounded-xl overflow-hidden shadow-xl">
                      {promoterSuggestions.map(p => (
                        <button
                          key={p.abn}
                          type="button"
                          onClick={() => {
                            setPromoterName(p.name)
                            setPromoterAbn(p.abn)
                            setPromoterAddress(p.address)
                            setPromoterSuggestions([])
                            setPromoterLocked(true)
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-all border-b border-white/[0.06] last:border-0"
                        >
                          <div className="text-white text-sm font-semibold">{p.name}</div>
                          <div className="text-white/40 text-xs mt-0.5">ABN {p.abn} · {p.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>ABN {!promoterLocked && <span className="text-amber-400/70 normal-case font-normal">(auto-filled when promoter selected)</span>}</label>
                  <input type="text" value={promoterAbn} onChange={e => setPromoterAbn(e.target.value)} placeholder="e.g. 12 345 678 901" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <input type="text" value={promoterAddress} onChange={e => setPromoterAddress(e.target.value)} placeholder="Full address" className={inputClass} />
                </div>
              </div>
            </section>
          </div>
        )}

        {step === 1 && (
          <div className="animate-in fade-in duration-200">
            <section>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Campaign</h2>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Campaign name</label>
              <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Summer 2026" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Promotion type</label>
              <div className="flex flex-wrap gap-2">
                {MECHANICS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      setDrawMechanic(m.value)
                      if (m.value === 'Draw Only') setEntryMechanic('')
                      if (m.value === 'Game of Skill') setEntryMechanic('Online - No Purchase')
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      drawMechanic === m.value ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {showEntry && (
              <div>
                <label className={labelClass}>Entry method</label>
                <div className="flex flex-wrap gap-2">
                  {(drawMechanic === 'Game of Skill'
                    ? ENTRY_OPTIONS.filter(o => o.value === 'Online - No Purchase')
                    : ENTRY_OPTIONS
                  ).map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setEntryMechanic(o.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        entryMechanic === o.value ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in duration-200">
        {/* ─── Dates ─── */}
        {isDrawOnly ? (
          <section>
            <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Draw schedule</h2>
            <div className="space-y-4">
              {draws.map((d, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex-1 min-w-0 sm:min-w-[140px]">
                    <DatePickerField
                      label="Date"
                      value={d.date}
                      onChange={v => updateDraw(i, 'date', v)}
                      minDate={minStartDate}
                      placeholder="Pick date"
                      inputClassName={inputClass}
                      labelClassName={labelClass}
                      formatDisplay={formatLongDate}
                    />
                  </div>
                  <div className="flex gap-3 sm:gap-3">
                    <div className="w-28 sm:w-32 shrink-0">
                      <label className={labelClass}>Time</label>
                      <input type="time" value={d.time} onChange={e => updateDraw(i, 'time', e.target.value)} className={inputClass} />
                    </div>
                    <div className="w-20 shrink-0">
                      <label className={labelClass}>Winners</label>
                      <input type="number" min={1} value={d.winners} onChange={e => updateDraw(i, 'winners', Number(e.target.value) || 1)} className={inputClass} />
                    </div>
                    {draws.length > 1 && (
                      <button type="button" onClick={() => removeDraw(i)} className="shrink-0 p-2 text-white/40 hover:text-red-400 transition-colors self-end" aria-label="Remove draw">×</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button type="button" onClick={addDraw} className="px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] transition-all border border-white/[0.08]">
                  + Add draw
                </button>
                <span className="text-white/50 text-sm">Number of draws: {draws.filter(d => d.date && d.time).length || 0}</span>
              </div>
              <p className="text-white/40 text-xs mt-3">Data will need to be uploaded 2 hrs before scheduled draw; missed draws must be rescheduled.</p>
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Dates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <DatePickerField
                  label="Promo start"
                  value={promoStart}
                  onChange={v => {
                    setPromoStart(v)
                    if (!promoEnd || promoEnd < v) setPromoEnd(lastDayOfNextMonth(v))
                  }}
                  minDate={minStartDate}
                  placeholder="Pick start date"
                  inputClassName={inputClass}
                  labelClassName={labelClass}
                />
              </div>
              <div>
                <DatePickerField
                  label="Promo end"
                  value={promoEnd}
                  onChange={setPromoEnd}
                  minDate={minEndDate}
                  placeholder="Pick end date"
                  inputClassName={inputClass}
                  labelClassName={labelClass}
                />
              </div>
            </div>
          </section>
        )}
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in duration-200">
        {isDrawOnly ? (
          <section>
            <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Terms & conditions (audit trail)</h2>
            <p className="text-white/60 text-sm mb-4">Draw-only draws must link back to verifiable entry. Upload terms and conditions for Turnstyle&apos;s audit trail.</p>
            <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-4">
              <label className={labelClass}>Upload terms & conditions (optional)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => setDrawOnlyTermsFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-white/70 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/[0.1] file:text-white file:font-semibold file:cursor-pointer hover:file:bg-white/[0.15]"
              />
              {drawOnlyTermsFile && (
                <p className="text-white/50 text-xs mt-2 flex items-center gap-2">
                  <span>{drawOnlyTermsFile.name}</span>
                  <button type="button" onClick={() => setDrawOnlyTermsFile(null)} className="text-white/40 hover:text-red-400 text-sm">Remove</button>
                </p>
              )}
            </div>
            <p className="text-white/40 text-xs mt-3">In development, upload is not required. Use <strong className="text-white/60">Next</strong> to continue to Prizes and Review.</p>
          </section>
        ) : showDrawSection ? (
          <section>
            <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Draw structure</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Draw structure</label>
                <div className="flex flex-wrap gap-2">
                  {DRAW_STRUCTURE.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDrawStructure(d.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        drawStructure === d.value ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              {drawStructure !== 'at_conclusion' && (
                <div>
                  <label className={labelClass}>Draw frequency</label>
                  <div className="flex flex-wrap gap-2">
                    {DRAW_FREQUENCY.map(f => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setDrawFrequency(f.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                          drawFrequency === f.value ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <label className={labelClass}>Override number of minor draws (optional)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 9 if dates give 10 but you only run 9"
                      value={overrideMinorDraws}
                      onChange={e => setOverrideMinorDraws(e.target.value.replace(/[^0-9]/, ''))}
                      className={inputClass + ' max-w-[8rem]'}
                    />
                  </div>
                </div>
              )}
              {promoStart && promoEnd && diagnostics ? (
                <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm space-y-1.5">
                  <p className="text-white/50 font-medium uppercase tracking-wider">Calculation</p>
                  <p className="text-white/80">
                    <span className="text-white/50">Structure: </span>
                    <span className="font-semibold text-white">{diagnostics.structureLabel}</span>
                    {diagnostics.structureDrawCount !== undefined && (
                      <span className="text-white/50"> → {diagnostics.structureDrawCount} draw{diagnostics.structureDrawCount !== 1 ? 's' : ''} per region</span>
                    )}
                  </p>
                  {drawStructure !== 'at_conclusion' && (
                    <p className="text-white/80">
                      <span className="text-white/50">Frequency: </span>
                      <span className="font-semibold text-white capitalize">{drawFrequency}</span>
                      {diagnostics.calculatedFromDates !== undefined && (
                        <span className="text-white/50">
                          {' '}→ {diagnostics.baseDrawCount} minor draw{diagnostics.baseDrawCount !== 1 ? 's' : ''}
                          {overrideMinorDraws !== '' && /^\d+$/.test(overrideMinorDraws) ? ` (override; ${diagnostics.calculatedFromDates} from dates)` : ` (${diagnostics.calculatedFromDates} from dates)`}
                        </span>
                      )}
                    </p>
                  )}
                  <p className="text-white/80">
                    <span className="text-white/50">Regions: </span>
                    <span className="font-semibold text-white">{diagnostics.regionLabel}</span>
                  </p>
                  <p className="pt-1.5 border-t border-white/[0.08] text-white font-semibold">
                    Total draws: {diagnostics.drawCount} draw{diagnostics.drawCount !== 1 ? 's' : ''}
                    {diagnostics.regionCount > 1 && (
                      <span className="text-white/60 font-normal"> ({diagnostics.structureDrawCount} × {diagnostics.regionCount} regions)</span>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/40">Set promo start and end dates above to calculate number of draws.</p>
              )}
              <div>
                <label className={labelClass}>Draw type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNationalOrState('national')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      nationalOrState === 'national' ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'
                    }`}
                  >
                    National
                  </button>
                  <button
                    type="button"
                    onClick={() => setNationalOrState('state')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                      nationalOrState === 'state' ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'
                    }`}
                  >
                    State based
                  </button>
                </div>
              </div>
              {nationalOrState === 'state' && (
                <div>
                  <label className={labelClass}>Number of regions</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AU_REGIONS_COMBINED.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleState(r)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                          stateRegions.includes(r) ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                    {AU_STATES.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleState(s)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                          stateRegions.includes(s) ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {stateRegions.length > 0 && (
                    <p className="text-white/40 text-xs mt-1.5">{stateRegions.length} region{stateRegions.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section>
            <p className="text-white/50 text-sm">Draw structure only applies to Sweepstakes. Use <strong className="text-white/70">Next</strong> to continue.</p>
          </section>
        )}
          </div>
        )}

        {step === 4 && !isDrawOnly && (
          <div className="animate-in fade-in duration-200">
        {/* ─── Prizes ─── */}
        <section className="w-full">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-5">Prizes</h2>
          <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] p-5 w-full">
            <div className="space-y-3 w-full">
              {prizes.map((p, i) => (
                <div key={i} className="flex items-center gap-3 w-full group">
                  <div className="flex items-center justify-center w-8 h-9 rounded-lg bg-white/[0.06] text-white/60 text-sm font-medium shrink-0">
                    {i + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPrizeIndex(i)}
                    className="flex-1 min-w-0 text-left rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 hover:border-white/[0.18] hover:bg-white/[0.06] transition-all"
                  >
                    <span className="text-white/90 text-sm block truncate">
                      {p.description || 'Tap to add description, type, qty & value'}
                    </span>
                    <span className="text-white/40 text-xs mt-0.5">
                      {('type' in p && (p as { type: string }).type) || '—'} · Qty {p.qty} · ${(p.qty * (p.unitValue || 0)).toLocaleString('en-AU')}
                    </span>
                  </button>
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    {prizes.length > 1 ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setPrizes(prev => prev.filter((_, j) => j !== i)); if (editingPrizeIndex === i) setEditingPrizeIndex(null); }}
                        className="text-white/40 hover:text-red-400 text-lg leading-none p-1"
                        aria-label="Remove prize"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-3">
              <button type="button" onClick={addPrize} className="text-white/60 hover:text-white text-sm font-semibold transition-colors">+ Add prize</button>
              <p className="text-white/50 text-sm">Total prize pool: ${prizePoolTotal.toLocaleString('en-AU')}</p>
            </div>
          </div>
        </section>

        {editingPrizeIndex !== null && (
          <PrizeEntryDialog
            open={editingPrizeIndex !== null}
            prizeIndex={editingPrizeIndex}
            prize={prizes[editingPrizeIndex] as { tier: string; description: string; type: string; qty: number; unitValue: number }}
            onSave={updated => {
              setPrizes(prev => prev.map((p, j) => (j === editingPrizeIndex ? { ...p, ...updated } : p)))
              setEditingPrizeIndex(null)
            }}
            onClose={() => setEditingPrizeIndex(null)}
            inputClassName={inputClass}
            labelClassName={labelClass}
          />
        )}
          </div>
        )}

        {((step === 5 && !isDrawOnly) || (step === 4 && isDrawOnly)) && (
          <div className="space-y-8 animate-in fade-in duration-200">
        {/* ─── Live calculations (diagnostics) ─── */}
        <section>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Campaign Summary</h2>
          <div className="bg-white/[0.04] border border-white/[0.12] rounded-xl overflow-hidden">
            {diagnostics ? (
              <>
                {permitBlock && (
                  <div className="px-4 py-3 bg-red-500/15 border-b border-red-500/30">
                    <p className="text-red-400 font-bold text-sm uppercase tracking-wide">
                      Permit issue not possible – please revise start date
                    </p>
                    <p className="text-red-300/80 text-xs mt-1">One or more required permits cannot be issued in time. Change promo start to allow enough business days.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 border-b border-white/[0.08] text-sm">
                  <div>
                    <span className="text-white/40">Campaign name</span>
                    <p className="text-white font-medium">{campaignName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Promoter</span>
                    <p className="text-white font-medium">{promoterName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Promotion type</span>
                    <p className="text-white font-medium">{drawMechanic}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Dates / period</span>
                    <p className="text-white font-medium">{diagnostics.promoLabel}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Structure</span>
                    <p className="text-white font-medium">{isDrawOnly ? 'As per schedule' : diagnostics.structureLabel}</p>
                  </div>
                  {drawStructure !== 'at_conclusion' && !isDrawOnly && (
                    <div>
                      <span className="text-white/40">Frequency</span>
                      <p className="text-white font-medium capitalize">{drawFrequency}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-white/40">Regions</span>
                    <p className="text-white font-medium">{isDrawOnly ? 'As per terms' : diagnostics.regionLabel}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Total draws</span>
                    <p className="text-white font-medium">{diagnostics.drawCount} draw{diagnostics.drawCount !== 1 ? 's' : ''}{diagnostics.regionCount > 1 ? ` (${diagnostics.structureDrawCount} × ${diagnostics.regionCount})` : ''}</p>
                  </div>
                  {isDrawOnly && draws.filter(d => d.date && d.time).length > 0 && (
                    <div className="col-span-2">
                      <span className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-1.5">Draw schedule</span>
                      <ul className="space-y-1 text-sm">
                        {draws.filter(d => d.date && d.time).map((d, i) => (
                          <li key={i} className="text-white/80 flex flex-wrap gap-x-3 gap-y-0">
                            <span>{formatLongDate(d.date)}</span>
                            <span className="text-white/50">{d.time}</span>
                            <span className="text-white/50">{d.winners} winner{d.winners !== 1 ? 's' : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {isDrawOnly && 'totalWinners' in diagnostics && (
                    <div>
                      <span className="text-white/40">Total winners</span>
                      <p className="text-white font-medium">{(diagnostics as { totalWinners?: number }).totalWinners ?? 0}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-white/40">{isDrawOnly ? 'Terms & conditions' : 'Prize pool'}</span>
                    <p className="text-white font-medium">{isDrawOnly ? (drawOnlyTermsFile?.name ?? '—') : formatMoney(diagnostics.prizePool)}</p>
                  </div>
                </div>
                {permitReadiness && (
                  <div className="px-4 py-3 border-b border-white/[0.08]">
                    <div className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Permit readiness</div>
                    {permitReadiness.required.length > 0 ? (
                      <>
                        {permitReadiness.regionCount > 1 && (
                          <p className="text-white/40 text-xs mb-2">
                            State-based: permit thresholds use per-region pool ({formatMoney(permitReadiness.prizeForPermit)} = total ÷ {permitReadiness.regionCount} regions).
                          </p>
                        )}
                        <p className="text-white/40 text-xs mb-2">
                          {permitReadiness.businessDaysUntilStart != null
                            ? `${permitReadiness.businessDaysUntilStart} business day${permitReadiness.businessDaysUntilStart === 1 ? '' : 's'} until start — can permits be acquired in time?`
                            : 'Set promo start to see readiness.'}
                        </p>
                        <div className="space-y-1.5">
                          {permitReadiness.rows.map(({ state, icon, msg, color }) => (
                            <div key={state} className="flex items-center gap-3">
                              <span className="text-sm">{icon}</span>
                              <span className="text-xs font-normal text-white/70">{state}</span>
                              <span className={`text-xs font-normal ${color}`}>{msg}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-white/40 text-xs">No permits required for this prize pool and region selection.</p>
                    )}
                    <p className="text-white/30 text-xs mt-3 italic">Permit issue is best case scenario and is subject to final application date and regulatory approval.</p>
                  </div>
                )}
                <div className="px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-white/70">
                    <span>Terms fee</span>
                    <span>{formatMoney(diagnostics.termsFee)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Management fee</span>
                    <span>{formatMoney(diagnostics.mgmtFee)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Permit fee{diagnostics.permitFee === 0 ? ' (0 permits)' : ''}</span>
                    <span>{formatMoney(diagnostics.permitFee)}</span>
                  </div>
                  {permitReadiness && permitReadiness.saRushFeeAmount > 0 && (
                    <div className="flex justify-between text-amber-400/90">
                      <span>SA rush fee</span>
                      <span>{formatMoney(permitReadiness.saRushFeeAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white/70">
                    <span>Draw fee ({diagnostics.drawCount} draw{diagnostics.drawCount !== 1 ? 's' : ''})</span>
                    <span>{formatMoney(diagnostics.drawFee)}</span>
                  </div>
                  {(() => {
                    const saRush = permitReadiness?.saRushFeeAmount ?? 0
                    const saRushGst = Math.round(saRush * 0.1 * 100) / 100
                    const subtotalExGst = diagnostics.totalExGst + saRush
                    const totalGst = diagnostics.gstAmount + saRushGst
                    const totalIncGst = diagnostics.totalIncGst + saRush + saRushGst
                    return (
                      <>
                        <div className="flex justify-between text-white/90 pt-2 border-t border-white/[0.08]">
                          <span>Subtotal (ex GST)</span>
                          <span>{formatMoney(subtotalExGst)}</span>
                        </div>
                        <div className="flex justify-between text-white/70">
                          <span>GST</span>
                          <span>{formatMoney(totalGst)}</span>
                        </div>
                        <div className="flex justify-between text-white font-semibold pt-1">
                          <span>Total (inc GST)</span>
                          <span>{formatMoney(totalIncGst)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </>
            ) : (
              <div className="px-4 py-6 text-center text-white/40 text-sm">
                Set dates (promo start & end) to see live quote calculations.
              </div>
            )}
          </div>
        </section>

        <section className="pt-4 border-t border-white/[0.08]">
          {permitBlock && (
            <p className="text-red-400/90 text-xs mb-3">Quote cannot proceed until permit readiness is OK. Revise promo start date so required permits can be issued in time.</p>
          )}
          <p className="text-white/30 text-xs">After create you’ll land on the campaign page → Quote → Download → Approve & build terms.</p>
        </section>
          </div>
        )}

        {/* Step navigation */}
        <footer className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-12 flex items-center justify-between gap-4 border-t border-white/[0.08] mt-10">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            Back
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button type="button" onClick={goNext} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-[#0a0a0f] hover:bg-white/90 transition-all">
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating…' : 'Create campaign'}
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}
