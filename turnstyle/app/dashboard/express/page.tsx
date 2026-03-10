'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { calculateQuote } from '@/lib/quote-engine'
import { searchPromoters, type PromoterRecord } from '@/lib/promoter-lookup'
import { updateCampaign } from '@/app/actions/updateCampaign'
import { generateQuote } from '@/app/actions/generateQuote'
import { confirmQuote } from '@/app/actions/confirmQuote'
import { getTemplatesForCampaign, getAllTemplates, type TemplateEntry } from '@/lib/terms-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromoterData {
  name: string
  abn: string
  address: string
  contactName: string
  contactEmail: string
}

interface PrizeTier {
  tier: string
  description: string
  prizeType: string
  qty: number
  unitValue: number
}

interface DrawEvent {
  id: string
  name: string
  type: 'major' | 'minor' | 'regional'
  drawDate: string
  drawTime: string
  periodStart: string
  periodEnd: string
  prizes: { tier: string; description: string; qty: number }[]
  region?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

const MECHANIC_OPTIONS = [
  { value: 'SWEEPSTAKES',   label: 'Sweepstakes',    sub: 'Random draw at conclusion', hasPrizes: true,  hasDraw: true,  hasTerms: true,  drawMechanic: 'Sweepstakes - Random Draw' },
  { value: 'INSTANT_WIN',   label: 'Instant Win',    sub: 'Winner revealed on entry',  hasPrizes: true,  hasDraw: true,  hasTerms: true,  drawMechanic: 'Sweepstakes - Instant Win' },
  { value: 'LIMITED_OFFER', label: 'Limited Offer',  sub: 'First in, best dressed',    hasPrizes: true,  hasDraw: false, hasTerms: true,  drawMechanic: 'Limited Offer' },
  { value: 'GAME_OF_SKILL', label: 'Game of Skill',  sub: 'Judged on merit',           hasPrizes: true,  hasDraw: false, hasTerms: true,  drawMechanic: 'Game of Skill' },
  { value: 'DRAW_ONLY',     label: 'Draw Only',      sub: "T&Cs already exist",        hasPrizes: false, hasDraw: true,  hasTerms: false, drawMechanic: 'Draw Only' },
  { value: 'OTHER',         label: 'Other / Unsure', sub: "We'll work it out",         hasPrizes: false, hasDraw: false, hasTerms: false, drawMechanic: 'Other' },
]

const PRIZE_TYPES = [
  { value: 'motor_vehicle', label: '🚗 Motor Vehicle' },
  { value: 'travel',        label: '✈️ Travel' },
  { value: 'cash',          label: '💵 Cash' },
  { value: 'gift_card',     label: '🎁 Gift Card' },
  { value: 'other',         label: '📦 Other' },
]

const PRIZE_TIERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']

const DRAW_FREQUENCIES = [
  { value: 'daily',       label: 'Daily' },
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly',     label: 'Monthly' },
]

const PERMIT_THRESHOLDS: Record<string, number> = { NSW: 10000, SA: 5000, ACT: 3500 }
const REGIONAL_GROUPS = ['NSW/ACT', 'SA', 'VIC', 'QLD', 'WA', 'TAS/NT']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateLong(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtRegion(regions: string[]) {
  if (regions.includes('national_au')) return 'throughout Australia'
  const states = regions.filter(r => AU_STATES.includes(r))
  return states.length ? `in ${states.join(', ')}` : 'in selected regions'
}
function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function calcDrawFee(n: number): number {
  const draws = Math.max(1, n)
  if (draws === 1) return 275
  if (draws <= 4) return 275 + (draws - 1) * 125
  return 275 + 3 * 125 + (draws - 4) * 95
}
function calcUnclaimed(promoEnd: string) {
  if (!promoEnd) return { deadline: 'TBC', redraw: 'TBC' }
  const d = new Date(promoEnd)
  const dl = new Date(d); dl.setDate(dl.getDate() + 60)
  const rd = new Date(dl); rd.setDate(rd.getDate() + 1)
  return {
    deadline: dl.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    redraw: rd.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}
function genId() { return Math.random().toString(36).slice(2, 9) }

function generateDrawSchedule(
  promoStart: string, promoEnd: string,
  mode: 'single' | 'multi' | 'regional',
  frequency: string, regionalCount: number, prizes: PrizeTier[],
): DrawEvent[] {
  if (!promoEnd) return []
  const allPrizes = prizes.map(p => ({ tier: p.tier, description: p.description, qty: p.qty }))
  if (mode === 'single') {
    return [{ id: genId(), name: 'Major Draw', type: 'major', drawDate: addDays(promoEnd, 5), drawTime: '14:00', periodStart: promoStart, periodEnd: promoEnd, prizes: allPrizes }]
  }
  if (mode === 'regional') {
    return REGIONAL_GROUPS.slice(0, regionalCount).map((region, i) => ({
      id: genId(), name: `${region} Draw`, type: 'regional' as const,
      drawDate: addDays(promoEnd, 5 + i), drawTime: '14:00',
      periodStart: promoStart, periodEnd: promoEnd, prizes: allPrizes, region,
    }))
  }
  const freqDays: Record<string, number> = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30 }
  const step = freqDays[frequency] ?? 7
  const end = new Date(promoEnd)
  const events: DrawEvent[] = []
  let current = new Date(promoStart)
  current.setDate(current.getDate() + step)
  let idx = 1
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    events.push({ id: genId(), name: `Draw ${idx}`, type: 'minor', drawDate: dateStr, drawTime: '14:00', periodStart: idx === 1 ? promoStart : (events[idx - 2]?.drawDate ?? promoStart), periodEnd: dateStr, prizes: allPrizes })
    current.setDate(current.getDate() + step)
    idx++
  }
  events.push({ id: genId(), name: 'Final Draw', type: 'major', drawDate: addDays(promoEnd, 5), drawTime: '14:00', periodStart: promoStart, periodEnd: promoEnd, prizes: allPrizes })
  return events
}

// ─── UI Components ────────────────────────────────────────────────────────────

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-white/40 text-[11px] font-bold mb-1.5 uppercase tracking-wider">
      {children}{optional && <span className="text-white/20 normal-case tracking-normal font-normal ml-1">optional</span>}
    </label>
  )
}

function TInput({ value, onChange, placeholder, type = 'text', min, autoFocus, onKeyDown, className = '', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  min?: string; autoFocus?: boolean; onKeyDown?: (e: React.KeyboardEvent) => void; className?: string; disabled?: boolean
}) {
  return (
    <input type={type} value={value} min={min} autoFocus={autoFocus} onKeyDown={onKeyDown} disabled={disabled}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c8f135]/50 placeholder-white/20 transition-all disabled:opacity-40 ${className}`} />
  )
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${active ? 'bg-[#c8f135] text-black border-[#c8f135]' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white hover:border-white/20'}`}>
      {children}
    </button>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4 ${className}`}>{children}</div>
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl border transition-all ${checked ? 'bg-[#c8f135]/10 border-[#c8f135]/30' : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20'}`}>
      <div className="text-left">
        <div className={`font-semibold text-sm ${checked ? 'text-[#c8f135]' : 'text-white/70'}`}>{label}</div>
        {sub && <div className="text-white/30 text-xs mt-0.5">{sub}</div>}
      </div>
      <div className={`w-10 h-5 rounded-full transition-all relative shrink-0 ml-4 ${checked ? 'bg-[#c8f135]' : 'bg-white/10'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </div>
    </button>
  )
}

function BackNext({ onBack, onNext, nextLabel, nextDisabled, nextLoading, hideBack = false }: {
  onBack?: () => void; onNext: () => void; nextLabel: string
  nextDisabled?: boolean; nextLoading?: boolean; hideBack?: boolean
}) {
  return (
    <div className="flex gap-3 mt-8">
      {!hideBack && onBack && (
        <button onClick={onBack} className="bg-white/[0.05] border border-white/[0.09] text-white/50 font-semibold px-6 py-4 rounded-2xl hover:bg-white/[0.08] transition-all text-sm shrink-0">
          ← Back
        </button>
      )}
      <button onClick={onNext} disabled={nextDisabled || nextLoading}
        className="flex-1 bg-[#c8f135] text-black font-black text-base py-4 rounded-2xl hover:bg-[#d4ff3d] active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#c8f135]/10">
        {nextLoading
          ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving...</span>
          : nextLabel}
      </button>
    </div>
  )
}

function ProgressBar({ stations, current }: { stations: { id: string; label: string }[]; current: number }) {
  return (
    <div className="max-w-3xl mx-auto px-6 pb-3 pt-1">
      <div className="flex items-start gap-px">
        {stations.map((s, i) => (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className={`h-1 w-full rounded-sm transition-all duration-500 ${i < current ? 'bg-[#c8f135]' : i === current ? 'bg-[#c8f135]/40' : 'bg-white/[0.07]'}`} />
            <span className={`text-[9px] font-bold mt-1 transition-all tracking-wide ${i === current ? 'text-[#c8f135]' : i < current ? 'text-[#c8f135]/35' : 'text-white/20'}`}>
              {s.label.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}



// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ExpressPage() {
  const router = useRouter()

  // ── Core campaign state ──
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [tsCode, setTsCode] = useState('')
  const [station, setStation] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── P1: Promoter ──
  const [promoter, setPromoter] = useState<PromoterData>({ name: '', abn: '', address: '', contactName: '', contactEmail: '' })
  const [promoInput, setPromoInput] = useState('')
  const [promoLocked, setPromoLocked] = useState(false)
  const [dirSuggestions, setDirSuggestions] = useState<PromoterRecord[]>([])
  const [dbSuggestions, setDbSuggestions] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [allDbPromoters, setAllDbPromoters] = useState<any[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── P2: Campaign ──
  const [campaignName, setCampaignName] = useState('')
  const [mechanicType, setMechanicType] = useState('SWEEPSTAKES')
  const [promoStart, setPromoStart] = useState('')
  const [promoEnd, setPromoEnd] = useState('')
  const [entryMechanic, setEntryMechanic] = useState('')
  const [regions, setRegions] = useState<string[]>(['national_au'])

  // ── P3: Prizes ──
  const [prizes, setPrizes] = useState<PrizeTier[]>([
    { tier: '1st', description: '', prizeType: '', qty: 1, unitValue: 0 },
  ])

  // ── P4: Draw ──
  const [multiDrawEnabled, setMultiDrawEnabled] = useState(false)
  const [regionalEnabled, setRegionalEnabled] = useState(false)
  const [drawFrequency, setDrawFrequency] = useState('weekly')
  const [regionalCount, setRegionalCount] = useState(3)
  const [draws, setDraws] = useState<DrawEvent[]>([])
  const [drawsReady, setDrawsReady] = useState(false)

  // ── P5: Quote ──
  const [liveQuote, setLiveQuote] = useState<any>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  // ── P6: Terms ──
  const [availableTemplates, setAvailableTemplates] = useState<TemplateEntry[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [termsQIdx, setTermsQIdx] = useState(0)
  const [termsPhase, setTermsPhase] = useState<'questions' | 'document'>('questions')
  const [termsSaving, setTermsSaving] = useState(false)

  // ── P7: Share ──
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Derived ──
  const mechanic = MECHANIC_OPTIONS.find(m => m.value === mechanicType) ?? MECHANIC_OPTIONS[0]
  const prizePool = prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const effectiveDrawMode: 'single' | 'multi' | 'regional' =
    regionalEnabled ? 'regional' : multiDrawEnabled ? 'multi' : 'single'

  const visibleStations = useMemo(() => {
    const s = [
      { id: 'promoter', label: 'Promoter' },
      { id: 'campaign', label: 'Campaign' },
    ]
    if (mechanic.hasPrizes) s.push({ id: 'prizes', label: 'Prizes' })
    if (mechanic.hasDraw)   s.push({ id: 'draw',   label: 'Draw' })
    s.push({ id: 'quote', label: 'Quote' })
    if (mechanic.hasTerms)  s.push({ id: 'terms',  label: 'Terms' })
    if (mechanic.hasTerms)  s.push({ id: 'share',  label: 'Share' })
    if (mechanicType === 'OTHER') s.push({ id: 'contact', label: 'Done' })
    return s
  }, [mechanic, mechanicType])

  const stationId = visibleStations[station]?.id ?? 'promoter'

  const permitCalcs = useMemo(() => {
    if (effectiveDrawMode !== 'regional' || !regionalCount || !prizePool) return []
    const perRegion = prizePool / regionalCount
    return Object.entries(PERMIT_THRESHOLDS)
      .map(([state, threshold]) => ({ state, perRegion, threshold, needed: perRegion > threshold }))
  }, [effectiveDrawMode, regionalCount, prizePool])

  // ── Validation ──
  const p1Valid = !!promoter.name.trim()
  const p2Valid = !!(campaignName.trim() && promoStart && promoEnd && regions.length > 0)
  const p3Valid = prizes.length > 0 && prizes.every(p => p.description && p.qty > 0 && p.unitValue > 0)
  const p4Valid = effectiveDrawMode === 'single' || drawsReady

  // ── Terms ──
  const currentTemplate = useMemo(() =>
    availableTemplates.find(t => t.meta.id === selectedTemplate) ?? availableTemplates[0],
    [availableTemplates, selectedTemplate]
  )
  const currentClauses = currentTemplate?.clauses ?? []

  const AUTO_VARS: Record<string, string> = useMemo(() => {
    const totalWinners = prizes.reduce((s, p) => s + p.qty, 0)
    const prizeList = prizes.map(p => `${p.qty} x ${p.description} valued at ${fmt(p.unitValue)} (incl. GST)`).join('\n')
    const mechLabel = mechanic.value === 'SWEEPSTAKES' ? 'Trade Lottery' : mechanic.value === 'LIMITED_OFFER' ? 'Limited Offer' : 'Prize Draw'
    return {
      PROMOTER_NAME: promoter.name || '[Promoter name]',
      PROMOTER_ABN: promoter.abn || '[ABN]',
      PROMOTER_ADDRESS: promoter.address || '[Address]',
      PROMO_START: fmtDateLong(promoStart),
      PROMO_END: fmtDateLong(promoEnd),
      DRAW_MECHANIC: mechLabel,
      CAMPAIGN_URL: `https://turnstylehost.com/campaign/${tsCode.toLowerCase()}/`,
      REGION: fmtRegion(regions),
      ENTRY_MECHANIC: entryMechanic || '[entry mechanic]',
      TOTAL_WINNERS: String(totalWinners),
      DRAW_DATE: draws[0]?.drawDate ? fmtDateLong(draws[0].drawDate) : '[Draw date]',
      PRIZE_LIST: prizeList,
      PRIZE_POOL: fmt(prizePool),
      UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
      UNCLAIMED_REDRAW: String(answers.UNCLAIMED_REDRAW ?? '[redraw date]'),
    }
  }, [promoter, promoStart, promoEnd, regions, entryMechanic, prizes, draws, prizePool, tsCode, answers, mechanic])

  const resolveText = (text: string) => {
    let out = String(text || ''), hasGaps = false
    out = out.replace(/\{\{(\w+)\}\}/g, (_, k) => AUTO_VARS[k] ?? `[${k}]`)
    out = out.replace(/\[\[(\w+)\]\]/g, (_, k) => {
      const a = answers[k]
      if (a !== undefined && String(a).trim()) return String(a)
      hasGaps = true; return '▓▓▓'
    })
    return { resolved: out, hasGaps }
  }

  const allTermsQ = useMemo(() => {
    const qs: { gap: any }[] = []
    currentClauses.forEach((clause: any) => {
      if (!clause.gaps) return
      clause.gaps.forEach((gap: any) => {
        qs.push({ gap })
        if (gap.followUp && answers[gap.key] !== undefined && Number(answers[gap.key]) === gap.followUp.showWhen) {
          qs.push({ gap: gap.followUp })
        }
      })
    })
    return qs
  }, [answers, currentClauses])

  const totalTermsQ = allTermsQ.length
  const currentTermsQ = allTermsQ[termsQIdx]
  const currentTermsA = currentTermsQ ? answers[currentTermsQ.gap.key] : undefined
  const canNextTerms = currentTermsQ
    ? (currentTermsQ.gap.options ? currentTermsA !== undefined : currentTermsA !== undefined && String(currentTermsA).trim() !== '')
    : true

  // ── Load DB promoters on mount ──
  useEffect(() => {
    fetch('/api/promoters').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAllDbPromoters(d)
    }).catch(() => {})
  }, [])

  // ── Outside click to close dropdown ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Auto single draw when dates change ──
  useEffect(() => {
    if (effectiveDrawMode === 'single' && promoEnd && prizes.length > 0) {
      setDraws(generateDrawSchedule(promoStart, promoEnd, 'single', drawFrequency, 1, prizes))
      setDrawsReady(true)
    }
  }, [effectiveDrawMode, promoEnd, prizes])

  // ── Load terms when arriving at terms station ──
  useEffect(() => {
    if (stationId === 'terms') {
      const mechLabel = mechanic.value === 'SWEEPSTAKES' ? 'Trade Lottery' : mechanic.value === 'LIMITED_OFFER' ? 'Limited Offer' : 'Prize Draw'
      const templates = getTemplatesForCampaign(promoter.name, mechLabel)
      const all = templates.length > 0 ? templates : getAllTemplates()
      setAvailableTemplates(all)
      if (all.length > 0 && !selectedTemplate) setSelectedTemplate(all[0].meta.id)
      const uc = calcUnclaimed(promoEnd)
      setAnswers(prev => ({ ...prev, UNCLAIMED_DEADLINE: uc.deadline, UNCLAIMED_REDRAW: uc.redraw }))
    }
  }, [stationId])

  // ── Generate fresh quote when arriving at quote station ──
  useEffect(() => {
    if (stationId === 'quote' && campaignId) {
      loadQuote()
    }
  }, [stationId, campaignId])

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTOSAVE — debounced patch via updateCampaign() (the approved server action)
  // Called whenever key fields change and a campaignId exists
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // CAMPAIGN CREATION — called when user clicks Next on Station 2
  // ─────────────────────────────────────────────────────────────────────────────

  async function createCampaignShell(name: string) {
    if (campaignId) return // already created
    if (!name.trim()) return
    try {
      const res = await fetch('/api/campaigns/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoter,
          campaignName: name,
          mechanicType,
          promoStart,
          promoEnd,
          regions,
          entryMechanic,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setCampaignId(data.id)
      setTsCode(data.tsCode)
      // Store in sessionStorage so user can resume if they navigate away
      sessionStorage.setItem('express_campaign_id', data.id)
    } catch (e) {
      console.error('[create shell]', e)
    }
  }

  // ── Resume from sessionStorage on mount ──
  useEffect(() => {
    const savedId = sessionStorage.getItem('express_campaign_id')
    if (savedId && !campaignId) {
      // Load the campaign and repopulate form
      fetch(`/api/campaigns/${savedId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.id) return
          setCampaignId(data.id)
          setTsCode(data.tsCode ?? '')
          setCampaignName(data.name ?? '')
          setMechanicType(data.mechanicType ?? 'SWEEPSTAKES')
          setPromoStart(data.promoStart ? new Date(data.promoStart).toISOString().split('T')[0] : '')
          setPromoEnd(data.promoEnd ? new Date(data.promoEnd).toISOString().split('T')[0] : '')
          setRegions(data.regions ?? ['national_au'])
          setEntryMechanic(data.entryMechanic ?? '')
          if (Array.isArray(data.prizes) && data.prizes.length > 0) setPrizes(data.prizes)
          if (data.promoter) {
            setPromoter({
              name: data.promoter.name ?? '',
              abn: data.promoter.abn ?? '',
              address: data.promoter.address ?? '',
              contactName: data.promoter.contactName ?? '',
              contactEmail: data.promoter.contactEmail ?? '',
            })
            setPromoInput(data.promoter.name ?? '')
          }
        })
        .catch(() => {})
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD QUOTE — calls generateQuote() server action then reads back the result
  // generateQuote() reads from DB (prizes already saved), so quote is always accurate
  // ─────────────────────────────────────────────────────────────────────────────

  async function loadQuote() {
    if (!campaignId) return
    setQuoteLoading(true)
    try {
      await generateQuote(campaignId)
      // Read back the freshly generated quote
      const res = await fetch(`/api/campaigns/${campaignId}`)
      const data = await res.json()
      const draft = data.quotes?.find((q: any) => q.status === 'DRAFT')
      if (draft) setLiveQuote(draft)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setQuoteLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATION HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  function next() { setStation(s => s + 1) }
  function back() { setStation(s => Math.max(0, s - 1)) }

  function handleP1Next() {
    if (!p1Valid) return
    next()
  }

  async function handleP2Next() {
    if (!p2Valid) return
    setSaving(true); setError(null)
    try {
      if (!campaignId) {
        // Create the campaign shell now if name was never autosaved
        await createCampaignShell(campaignName)
      } else {
        // Patch the existing campaign with full details via approved action
        await updateCampaign(campaignId, {
          name: campaignName,
          drawMechanic: mechanic.drawMechanic,
          drawFrequency: 'at_conclusion',
          promoStart,
          promoEnd,
          regions,
          entryMechanic,
          promoter: {
            name: promoter.name,
            abn: promoter.abn,
            contactName: promoter.contactName,
            contactEmail: promoter.contactEmail,
          },
        })
      }
      next()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleP3Next() {
    if (!p3Valid || !campaignId) return
    setSaving(true); setError(null)
    try {
      // Save prizes via approved updateCampaign action — this also regenerates the quote
      await updateCampaign(campaignId, { prizes })
      next()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleP4Next() {
    if (!campaignId) return
    setSaving(true); setError(null)
    try {
      const finalDraws = effectiveDrawMode === 'single'
        ? generateDrawSchedule(promoStart, promoEnd, 'single', drawFrequency, 1, prizes)
        : draws
      setDraws(finalDraws)
      // Save draw schedule via the PATCH route (draw schedule only)
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawSchedule: finalDraws }),
      })
      next()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleConfirm() {
    if (!campaignId) return
    setSaving(true); setError(null)
    try {
      await confirmQuote(campaignId)
      next()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  function handleTermsNext() {
    if (termsQIdx < totalTermsQ - 1) setTermsQIdx(i => i + 1)
    else setTermsPhase('document')
  }

  async function handleTermsSave() {
    if (!campaignId || !currentTemplate) return
    setTermsSaving(true); setError(null)
    const content = currentClauses.map((clause: any) => {
      const { resolved } = resolveText(clause.text)
      return `${clause.label}\n\n${resolved}`
    }).join('\n\n---\n\n')
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, content, gapAnswers: answers, templateId: currentTemplate.meta.id }),
      })
      if (!res.ok) throw new Error('Failed to save terms')
      const draft = await res.json()
      setShareLink(`${window.location.origin}/review/${draft.shareToken}`)
      // Clear session storage — campaign is fully onboarded
      sessionStorage.removeItem('express_campaign_id')
      next()
    } catch (e: any) { setError(e.message) }
    finally { setTermsSaving(false) }
  }

  // ── Promoter handlers ──
  function handlePromoterInput(val: string) {
    setPromoInput(val)
    setPromoter(p => ({ ...p, name: val }))
    setPromoLocked(false)
    if (val.length < 2) { setDirSuggestions([]); setDbSuggestions([]); setShowDropdown(false); return }
    const dirMatches = searchPromoters(val)
    setDirSuggestions(dirMatches)
    const q = val.toLowerCase()
    const dbMatches = allDbPromoters.filter(p => p.name?.toLowerCase().includes(q) && p.name?.toLowerCase() !== val.toLowerCase()).slice(0, 4)
    setDbSuggestions(dbMatches)
    setShowDropdown(dirMatches.length > 0 || dbMatches.length > 0)
  }

  function selectFromDirectory(p: PromoterRecord) {
    setPromoter({ name: p.name, abn: p.abn, address: p.address, contactName: '', contactEmail: '' })
    setPromoInput(p.name); setPromoLocked(true); setDirSuggestions([]); setDbSuggestions([]); setShowDropdown(false)
  }

  function selectFromDb(p: any) {
    setPromoter({ name: p.name ?? '', abn: p.abn ?? '', address: p.address ?? '', contactName: p.contactName ?? '', contactEmail: p.contactEmail ?? '' })
    setPromoInput(p.name ?? ''); setPromoLocked(true); setDirSuggestions([]); setDbSuggestions([]); setShowDropdown(false)
  }

  const hasDbOnly = [...dbSuggestions.filter(db => !dirSuggestions.find(d => d.name.toLowerCase() === db.name?.toLowerCase()))]

  function handleGenerateDraws() {
    const newDraws = generateDrawSchedule(promoStart, promoEnd, effectiveDrawMode, drawFrequency, regionalCount, prizes)
    setDraws(newDraws); setDrawsReady(true)
  }

  function handleMultiToggle(v: boolean) { setMultiDrawEnabled(v); if (v) setRegionalEnabled(false); setDrawsReady(false) }
  function handleRegionalToggle(v: boolean) { setRegionalEnabled(v); if (v) setMultiDrawEnabled(false); setDrawsReady(false) }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <nav className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-black text-lg tracking-tight">TURNSTYLE</span>
            <span className="text-white/20">/</span>
            <span className="text-white/50 text-sm">Express</span>
            {tsCode && <span className="text-[#c8f135]/50 text-xs font-mono">{tsCode}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/25 hover:text-white/60 text-sm transition-colors">✕ Exit</button>
          </div>
        </div>
        <ProgressBar stations={visibleStations} current={station} />
      </nav>

      {error && (
        <div className="max-w-3xl mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <span>⚠</span><span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400">×</button>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-10 pb-24">

        {/* ══ STATION 1: PROMOTER ══ */}
        {stationId === 'promoter' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">Who's promoting?</h2>
              <p className="text-white/40 text-sm mt-2">Start typing to search existing promoters or the business directory.</p>
            </div>
            <div className="space-y-4">
              <div ref={dropdownRef} className="relative">
                <FieldLabel>Company Name</FieldLabel>
                <div className="relative">
                  <input value={promoInput} onChange={e => handlePromoterInput(e.target.value)}
                    onFocus={() => { if (promoInput.length >= 2) setShowDropdown(true) }}
                    placeholder="Type company name to search..."
                    className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 text-white focus:outline-none placeholder-white/20 transition-all text-base ${promoLocked ? 'border-[#c8f135]/40 bg-[#c8f135]/[0.04]' : 'border-white/[0.09] focus:border-[#c8f135]/50'}`} />
                  {promoLocked && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="text-[#c8f135] text-xs font-bold">✓</span>
                      <button onClick={() => { setPromoLocked(false); setPromoInput(''); setPromoter(p => ({ ...p, name: '' })) }} className="text-white/30 hover:text-white/60 text-xs transition-colors">change</button>
                    </div>
                  )}
                </div>
                {showDropdown && (dirSuggestions.length > 0 || hasDbOnly.length > 0) && !promoLocked && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d1a] border border-white/[0.10] rounded-xl overflow-hidden z-30 shadow-2xl">
                    {hasDbOnly.length > 0 && (
                      <>
                        <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25">Previous Campaigns</div>
                        {hasDbOnly.map((p, i) => (
                          <button key={`db-${i}`} type="button" onClick={() => selectFromDb(p)} className="w-full text-left px-4 py-3 hover:bg-white/[0.04] border-b border-white/[0.05] last:border-0 transition-all">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-blue-400/10 border border-blue-400/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">DB</span>
                              <span className="text-white text-sm font-semibold">{p.name}</span>
                            </div>
                            <div className="text-white/35 text-xs mt-0.5 pl-8">{[p.abn, p.contactName, p.address].filter(Boolean).join(' · ')}</div>
                          </button>
                        ))}
                      </>
                    )}
                    {dirSuggestions.length > 0 && (
                      <>
                        {hasDbOnly.length > 0 && <div className="border-t border-white/[0.06]" />}
                        <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25">Business Directory</div>
                        {dirSuggestions.map((p, i) => (
                          <button key={`dir-${i}`} type="button" onClick={() => selectFromDirectory(p)} className="w-full text-left px-4 py-3 hover:bg-white/[0.04] border-b border-white/[0.05] last:border-0 transition-all">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">DIR</span>
                              <span className="text-white text-sm font-semibold">{p.name}</span>
                            </div>
                            <div className="text-white/35 text-xs mt-0.5 pl-8">ABN {p.abn} · {p.address}</div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>ABN</FieldLabel><TInput value={promoter.abn} onChange={v => setPromoter(p => ({ ...p, abn: v }))} placeholder="12 345 678 901" /></div>
                <div><FieldLabel>Address</FieldLabel><TInput value={promoter.address} onChange={v => setPromoter(p => ({ ...p, address: v }))} placeholder="123 Main St, Sydney NSW 2000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>Contact Name</FieldLabel><TInput value={promoter.contactName} onChange={v => setPromoter(p => ({ ...p, contactName: v }))} placeholder="Jane Smith" /></div>
                <div><FieldLabel>Contact Email</FieldLabel><TInput type="email" value={promoter.contactEmail} onChange={v => setPromoter(p => ({ ...p, contactEmail: v }))} placeholder="jane@company.com" /></div>
              </div>
            </div>
            <BackNext hideBack onNext={handleP1Next} nextDisabled={!p1Valid} nextLabel="Next — Campaign Details →" />
          </div>
        )}

        {/* ══ STATION 2: CAMPAIGN ══ */}
        {stationId === 'campaign' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">Campaign details.</h2>
              <p className="text-white/40 text-sm mt-2">Name, type, dates and entry method.</p>
            </div>
            <div className="space-y-5">
              <div>
                <FieldLabel>Campaign Name</FieldLabel>
                <input value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Win a Ford Mustang with Repco"
                  className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-[#c8f135]/50 placeholder-white/20 transition-all" />
              </div>
              <div>
                <FieldLabel>Promotion Type</FieldLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MECHANIC_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setMechanicType(opt.value)}
                      className={`px-4 py-3 rounded-xl text-left border transition-all ${mechanicType === opt.value ? 'bg-[#c8f135] text-black border-[#c8f135]' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white hover:border-white/20'}`}>
                      <div className={`font-bold text-sm ${mechanicType === opt.value ? 'text-black' : ''}`}>{opt.label}</div>
                      <div className={`text-xs mt-0.5 ${mechanicType === opt.value ? 'text-black/55' : 'text-white/25'}`}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>Start Date</FieldLabel><TInput type="date" value={promoStart} onChange={setPromoStart} min={new Date().toISOString().split('T')[0]} /></div>
                <div><FieldLabel>End Date</FieldLabel><TInput type="date" value={promoEnd} onChange={setPromoEnd} min={promoStart || new Date().toISOString().split('T')[0]} /></div>
              </div>
              <div>
                <FieldLabel>Regions</FieldLabel>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[{ key: 'national_au', label: '🇦🇺 Australia (National)' }, { key: 'NZ', label: '🇳🇿 New Zealand' }, { key: 'USA', label: '🇺🇸 USA' }].map(r => (
                      <PillBtn key={r.key} active={regions.includes(r.key)}
                        onClick={() => {
                          if (r.key === 'national_au') setRegions(prev => prev.includes('national_au') ? prev.filter(x => x !== 'national_au') : [...prev.filter(x => !AU_STATES.includes(x)), 'national_au'])
                          else setRegions(prev => prev.includes(r.key) ? prev.filter(x => x !== r.key) : [...prev, r.key])
                        }}>{r.label}</PillBtn>
                    ))}
                    <PillBtn active={AU_STATES.some(s => regions.includes(s))}
                      onClick={() => { const has = AU_STATES.some(s => regions.includes(s)); setRegions(prev => has ? prev.filter(x => !AU_STATES.includes(x)) : [...prev.filter(x => x !== 'national_au'), 'NSW']) }}>Select States</PillBtn>
                  </div>
                  {AU_STATES.some(s => regions.includes(s)) && !regions.includes('national_au') && (
                    <div className="flex flex-wrap gap-1.5">
                      {AU_STATES.map(state => (
                        <button key={state} type="button" onClick={() => setRegions(prev => prev.includes(state) ? prev.filter(x => x !== state) : [...prev, state])}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${regions.includes(state) ? 'bg-white text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-white'}`}>{state}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <FieldLabel optional>Entry Method</FieldLabel>
                <TInput value={entryMechanic} onChange={setEntryMechanic} placeholder="e.g. Purchase any product and scan the QR code instore" />
              </div>
            </div>
            <BackNext onBack={back} onNext={handleP2Next} nextDisabled={!p2Valid} nextLoading={saving}
              nextLabel={mechanic.hasPrizes ? 'Next — Add Prizes →' : mechanic.hasDraw ? 'Next — Draw Details →' : 'Next — Get Quote →'} />
          </div>
        )}

        {/* ══ STATION 3: PRIZES ══ */}
        {stationId === 'prizes' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">What's on offer?</h2>
              <p className="text-white/40 text-sm mt-2">Add each prize tier — type, description, quantity and value.</p>
            </div>
            <div className="space-y-3 mb-4">
              {prizes.map((prize, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs font-bold uppercase tracking-widest">Prize {i + 1}</span>
                      <input value={prize.tier} onChange={e => setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, tier: e.target.value } : p))}
                        className="bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-0.5 text-white text-xs font-bold w-14 text-center focus:outline-none focus:border-[#c8f135]/40" />
                    </div>
                    {prizes.length > 1 && (
                      <button onClick={() => setPrizes(prev => prev.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-400 transition-colors text-2xl leading-none">×</button>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Prize Type</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {PRIZE_TYPES.map(pt => (
                        <PillBtn key={pt.value} active={prize.prizeType === pt.value} onClick={() => setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, prizeType: pt.value } : p))}>{pt.label}</PillBtn>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <FieldLabel>Description</FieldLabel>
                      <input value={prize.description} onChange={e => setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, description: e.target.value } : p))}
                        placeholder="e.g. Ford Mustang GT"
                        className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c8f135]/40 placeholder-white/20" />
                    </div>
                    <div className="col-span-2">
                      <FieldLabel>Qty</FieldLabel>
                      <input type="number" min="1" value={prize.qty} onChange={e => setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, qty: parseInt(e.target.value) || 1 } : p))}
                        className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-2 py-2.5 text-white text-sm focus:outline-none focus:border-[#c8f135]/40 text-center" />
                    </div>
                    <div className="col-span-4">
                      <FieldLabel>Unit Value</FieldLabel>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                        <input type="number" min="0" value={prize.unitValue || ''} onChange={e => setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, unitValue: parseFloat(e.target.value) || 0 } : p))}
                          placeholder="0" className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c8f135]/40 placeholder-white/20" />
                      </div>
                    </div>
                  </div>
                  {prize.qty > 0 && prize.unitValue > 0 && (
                    <div className="text-right text-white/30 text-xs">Subtotal: <span className="text-white/60 font-semibold">{fmt(prize.qty * prize.unitValue)}</span></div>
                  )}
                </Card>
              ))}
              <button onClick={() => setPrizes(prev => [...prev, { tier: PRIZE_TIERS[prev.length] ?? '', description: '', prizeType: '', qty: 1, unitValue: 0 }])}
                className="w-full bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl py-4 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-sm font-semibold">
                + Add prize tier
              </button>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-6 py-4 flex items-center justify-between">
              <span className="text-white/40 text-sm">Total Prize Pool</span>
              <span className="text-white font-black text-2xl">{fmt(prizePool)}</span>
            </div>
            <BackNext onBack={back} onNext={handleP3Next} nextDisabled={!p3Valid} nextLoading={saving}
              nextLabel={mechanic.hasDraw ? 'Next — Draw Details →' : 'Next — Get Quote →'} />
          </div>
        )}

        {/* ══ STATION 4: DRAW ══ */}
        {stationId === 'draw' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">Draw setup.</h2>
              <p className="text-white/40 text-sm mt-2">Single draw for all prizes by default. Toggle multi-draw or regional draws below.</p>
            </div>
            <div className="space-y-3 mb-4">
              {effectiveDrawMode === 'single' && (
                <Card className="!py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold text-sm">Major Draw — All Prizes</div>
                      <div className="text-white/40 text-xs mt-0.5">{promoEnd ? fmtDate(addDays(promoEnd, 5)) : 'TBC'} at 2:00 PM · {fmt(calcDrawFee(1))} administration</div>
                    </div>
                    <span className="text-xs bg-white/10 border border-white/20 text-white/50 px-2 py-0.5 rounded-full font-semibold">major</span>
                  </div>
                </Card>
              )}
              <Toggle label="Multi-Draw" sub="Run draws on a regular schedule throughout the campaign" checked={multiDrawEnabled} onChange={handleMultiToggle} />
              {multiDrawEnabled && (
                <Card>
                  <FieldLabel>Draw Frequency</FieldLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {DRAW_FREQUENCIES.map(f => (
                      <button key={f.value} type="button" onClick={() => { setDrawFrequency(f.value); setDrawsReady(false) }}
                        className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${drawFrequency === f.value ? 'bg-[#c8f135] text-black border-[#c8f135]' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white'}`}>{f.label}</button>
                    ))}
                  </div>
                  <button onClick={handleGenerateDraws} className="w-full bg-white/[0.05] border border-white/[0.10] text-white/70 font-semibold py-3 rounded-xl hover:bg-white/[0.08] transition-all text-sm">
                    {drawsReady ? '↺ Regenerate Schedule' : '⚡ Generate Schedule'}
                  </button>
                  {drawsReady && draws.length > 0 && (
                    <>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {draws.map(draw => (
                          <div key={draw.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${draw.type === 'major' ? 'bg-white/10 border-white/20 text-white/60' : 'bg-blue-400/10 border-blue-400/20 text-blue-400'}`}>{draw.type}</span>
                              <span className="text-white/70 text-sm">{draw.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="date" value={draw.drawDate} onChange={e => setDraws(prev => prev.map(d => d.id === draw.id ? { ...d, drawDate: e.target.value } : d))} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
                              <input type="time" value={draw.drawTime} onChange={e => setDraws(prev => prev.map(d => d.id === draw.id ? { ...d, drawTime: e.target.value } : d))} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-white/40 text-xs pt-1 border-t border-white/[0.06]">
                        <span>{draws.length} draws total</span>
                        <span>Administration: <span className="text-white/70 font-semibold">{fmt(calcDrawFee(draws.length))}</span></span>
                      </div>
                    </>
                  )}
                </Card>
              )}
              <Toggle label="Regional Draws" sub="Separate draws by state, with per-region prize pool and permit calculations" checked={regionalEnabled} onChange={handleRegionalToggle} />
              {regionalEnabled && (
                <Card>
                  <div>
                    <FieldLabel>Number of Regions</FieldLabel>
                    <div className="flex gap-2 mb-1.5">
                      {[2, 3, 4, 5, 6].map(n => (
                        <button key={n} type="button" onClick={() => { setRegionalCount(n); setDrawsReady(false) }}
                          className={`w-11 h-11 rounded-xl font-black text-sm border transition-all ${regionalCount === n ? 'bg-[#c8f135] text-black border-[#c8f135]' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white'}`}>{n}</button>
                      ))}
                    </div>
                    <p className="text-white/25 text-xs">{REGIONAL_GROUPS.slice(0, regionalCount).join(' · ')}</p>
                  </div>
                  {prizePool > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/40 text-xs">{fmt(prizePool)} ÷ {regionalCount} regions</span>
                        <span className="text-white font-black text-lg">{fmt(prizePool / regionalCount)} <span className="text-white/40 text-xs font-normal">per region</span></span>
                      </div>
                      <div className="border-t border-white/[0.06] pt-3 space-y-2">
                        <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">Permit Status</div>
                        {permitCalcs.map(p => (
                          <div key={p.state} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${p.state === 'NSW' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : p.state === 'SA' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>{p.state}</span>
                              <span className="text-white/40 text-xs">threshold {fmt(p.threshold)}</span>
                            </div>
                            {p.needed ? <span className="text-amber-400 text-xs font-semibold">⚠ Permit required</span> : <span className="text-emerald-400 text-xs">✓ No permit</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={handleGenerateDraws} className="w-full bg-white/[0.05] border border-white/[0.10] text-white/70 font-semibold py-3 rounded-xl hover:bg-white/[0.08] transition-all text-sm">
                    {drawsReady ? '↺ Regenerate Regional Draws' : '⚡ Generate Regional Draws'}
                  </button>
                  {drawsReady && draws.length > 0 && (
                    <div className="space-y-1.5">
                      {draws.map(draw => (
                        <div key={draw.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-400/10 border-purple-400/20 text-purple-400 font-bold">regional</span>
                            <span className="text-white/70 text-sm">{draw.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="date" value={draw.drawDate} onChange={e => setDraws(prev => prev.map(d => d.id === draw.id ? { ...d, drawDate: e.target.value } : d))} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none" />
                            <input type="time" value={draw.drawTime} onChange={e => setDraws(prev => prev.map(d => d.id === draw.id ? { ...d, drawTime: e.target.value } : d))} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none w-24" />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-white/40 text-xs pt-1 border-t border-white/[0.06]">
                        <span>{draws.length} regional draws</span>
                        <span>Administration: <span className="text-white/70 font-semibold">{fmt(calcDrawFee(draws.length))}</span></span>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
            <BackNext onBack={back} onNext={handleP4Next} nextDisabled={!p4Valid} nextLoading={saving} nextLabel="Next — Get Quote →" />
          </div>
        )}

        {/* ══ STATION 5: QUOTE ══ */}
        {stationId === 'quote' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">Here's your estimate.</h2>
              <p className="text-white/40 text-sm mt-2">Based on your confirmed prize list and campaign details.</p>
            </div>

            {quoteLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-white/30">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <span className="text-sm">Calculating your quote…</span>
              </div>
            ) : liveQuote ? (
              <>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
                  <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between">
                    <div>
                      <div className="text-white/30 text-xs uppercase tracking-widest mb-1">Quote</div>
                      <div className="text-white font-black text-xl">{liveQuote.quoteNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white/30 text-xs uppercase tracking-widest mb-1">Valid Until</div>
                      <div className="text-white/60 text-sm">{fmtDate(liveQuote.validUntil)}</div>
                    </div>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {[
                      { label: 'Terms & Conditions (draft)', amount: liveQuote.termsFee, note: '' },
                      { label: 'Campaign Management', amount: liveQuote.mgmtFee, note: '' },
                      { label: 'Permit Fees (estimate)', amount: liveQuote.permitFee, note: '' },
                      { label: 'Draw Administration', amount: liveQuote.drawFee, note: '' },
                    ].filter(l => l.amount > 0).map((line, i) => (
                      <div key={i} className="px-6 py-4 flex items-center justify-between">
                        <div className="text-white/80 text-sm font-semibold">{line.label}</div>
                        <div className="text-white font-bold">{fmt(line.amount)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#c8f135] px-6 py-5">
                    <div className="text-black/50 text-xs font-bold uppercase tracking-widest mb-1">Total Estimate</div>
                    <div className="text-black font-black text-4xl">{fmt(liveQuote.totalExGst ?? 0)}</div>
                    <div className="text-black/50 text-sm mt-1">excl. GST · +{fmt(liveQuote.gstAmount ?? 0)} GST = {fmt(liveQuote.totalIncGst ?? 0)} incl.</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button onClick={handleConfirm} disabled={saving}
                    className="w-full bg-[#c8f135] text-black font-black text-base py-4 rounded-2xl hover:bg-[#d4ff3d] active:scale-[0.99] transition-all disabled:opacity-30 shadow-lg shadow-[#c8f135]/10">
                    {saving
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Confirming…</span>
                      : mechanic.hasTerms ? '✓ Confirm Quote & Build Terms →' : '✓ Confirm Quote & Finish →'}
                  </button>
                  <button onClick={() => router.push(`/dashboard/${campaignId}`)} className="w-full bg-white/[0.05] border border-white/[0.09] text-white/60 font-semibold py-3.5 rounded-2xl hover:bg-white/[0.08] hover:text-white transition-all text-sm">
                    💾 Save & Return to Dashboard
                  </button>
                  <button onClick={back} className="w-full text-white/20 hover:text-white/50 text-sm py-2 transition-colors">← Back</button>
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-white/30 text-sm mb-4">Could not load quote.</p>
                <button onClick={loadQuote} className="bg-white/[0.05] border border-white/10 text-white/60 px-6 py-3 rounded-xl text-sm hover:bg-white/[0.08] transition-all">Try again</button>
              </div>
            )}
          </div>
        )}

        {/* ══ STATION 6: TERMS ══ */}
        {stationId === 'terms' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {termsPhase === 'questions' && (
              <>
                <div className="mb-8">
                  <h2 className="text-white font-black text-4xl tracking-tight">Quick questions.</h2>
                  <p className="text-white/40 text-sm mt-2">{totalTermsQ} questions to complete your terms draft.</p>
                </div>
                {currentTermsQ ? (
                  <div>
                    <Card className="!p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-[#c8f135] rounded-full transition-all duration-500" style={{ width: `${((termsQIdx + 1) / totalTermsQ) * 100}%` }} />
                        </div>
                        <span className="text-white/30 text-xs shrink-0">{termsQIdx + 1}/{totalTermsQ}</span>
                      </div>
                      <h3 className="text-white font-bold text-xl mb-6">{currentTermsQ.gap.question}</h3>
                      {currentTermsQ.gap.options ? (
                        <div className="space-y-2">
                          {currentTermsQ.gap.options.map((opt: string, i: number) => {
                            const label = currentTermsQ.gap.optionLabels?.[i] ?? opt
                            const isSelected = String(currentTermsA) === String(i)
                            return (
                              <button key={i} type="button" onClick={() => setAnswers(prev => ({ ...prev, [currentTermsQ.gap.key]: i }))}
                                className={`w-full px-5 py-4 rounded-xl text-left border-2 font-semibold transition-all ${isSelected ? 'bg-[#c8f135] text-black border-[#c8f135]' : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white'}`}>
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      ) : currentTermsQ.gap.multiline ? (
                        <textarea value={String(currentTermsA ?? '')} onChange={e => setAnswers(prev => ({ ...prev, [currentTermsQ.gap.key]: e.target.value }))}
                          placeholder={currentTermsQ.gap.placeholder ?? 'Type your answer...'} rows={4}
                          className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#c8f135]/40 resize-none" />
                      ) : (
                        <input type="text" value={String(currentTermsA ?? '')} onChange={e => setAnswers(prev => ({ ...prev, [currentTermsQ.gap.key]: e.target.value }))}
                          placeholder={currentTermsQ.gap.placeholder ?? 'Type your answer...'} autoFocus
                          onKeyDown={e => { if (e.key === 'Enter' && canNextTerms) handleTermsNext() }}
                          className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#c8f135]/40" />
                      )}
                    </Card>
                    <BackNext onBack={() => termsQIdx > 0 ? setTermsQIdx(i => i - 1) : back()} onNext={handleTermsNext} nextDisabled={!canNextTerms}
                      nextLabel={termsQIdx === totalTermsQ - 1 ? 'Generate Terms →' : 'Next →'} />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/40 text-sm mb-4">No questions needed — terms are auto-populated.</p>
                    <button onClick={() => setTermsPhase('document')} className="bg-[#c8f135] text-black font-black px-8 py-3 rounded-xl hover:bg-[#d4ff3d] transition-all">Preview Terms →</button>
                  </div>
                )}
              </>
            )}
            {termsPhase === 'document' && (
              <>
                <div className="mb-8">
                  <h2 className="text-white font-black text-4xl tracking-tight">Terms are ready.</h2>
                  <p className="text-white/40 text-sm mt-2">Review the compiled draft, then save to proceed.</p>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mb-6">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-black text-base">{campaignName}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">Terms & Conditions · Draft v1 · {tsCode}</p>
                    </div>
                    {availableTemplates.length > 1 && (
                      <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 text-xs focus:outline-none">
                        {availableTemplates.map(t => <option key={t.meta.id} value={t.meta.id}>{t.meta.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-[150px_1fr] bg-gray-50 border-b border-gray-200">
                    <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Clause</div>
                    <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-l border-gray-100">Details</div>
                  </div>
                  {currentClauses.map((clause: any, ci: number) => {
                    const { resolved, hasGaps } = resolveText(clause.text)
                    return (
                      <div key={clause.slug} className={`grid grid-cols-[150px_1fr] border-b border-gray-100 last:border-0 ${ci % 2 ? 'bg-gray-50/50' : ''}`}>
                        <div className="px-5 py-3 flex items-start gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${clause.gaps ? 'bg-amber-400' : 'bg-gray-300'}`} />
                          <span className="text-gray-700 font-semibold text-xs leading-snug">{clause.label}</span>
                        </div>
                        <div className="px-5 py-3 border-l border-gray-100">
                          {hasGaps ? <span className="text-gray-400 italic text-xs">Incomplete — go back to answer questions</span>
                            : <span className="text-gray-600 text-xs leading-relaxed whitespace-pre-line">{resolved}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-3">
                  {totalTermsQ > 0 && (
                    <button onClick={() => { setTermsPhase('questions'); setTermsQIdx(0) }} className="bg-white/[0.05] border border-white/[0.09] text-white/50 font-semibold px-5 py-4 rounded-2xl hover:bg-white/[0.08] transition-all text-sm">← Edit Answers</button>
                  )}
                  <button onClick={handleTermsSave} disabled={termsSaving}
                    className="flex-1 bg-[#c8f135] text-black font-black text-base py-4 rounded-2xl hover:bg-[#d4ff3d] transition-all disabled:opacity-50 shadow-lg shadow-[#c8f135]/10">
                    {termsSaving ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Saving...</span> : '✓ Save Terms & Continue →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ STATION 7: SHARE ══ */}
        {stationId === 'share' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">Campaign ready.</h2>
              <p className="text-white/40 text-sm mt-2">Share the terms link for client review and sign-off.</p>
            </div>
            <div className="space-y-4">
              <div className="bg-[#c8f135]/[0.07] border border-[#c8f135]/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-[#c8f135]/20 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[#c8f135] text-lg">✓</span>
                  </div>
                  <div>
                    <div className="text-[#c8f135] font-black text-lg leading-tight">{campaignName}</div>
                    <div className="text-[#c8f135]/50 text-xs font-mono mt-0.5">{tsCode}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[{ label: 'Type', value: mechanic.label }, { label: 'Prize Pool', value: fmt(prizePool) }, { label: 'Start', value: fmtDate(promoStart) }, { label: 'End', value: fmtDate(promoEnd) }].map(item => (
                    <div key={item.label} className="bg-black/20 rounded-xl px-3 py-2.5 text-center">
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">{item.label}</div>
                      <div className="text-white font-semibold text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Card className="!space-y-3">
                <div className="text-white/40 text-[11px] font-bold uppercase tracking-wider">Terms Review Link</div>
                <div className="flex gap-2">
                  <input readOnly value={shareLink} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/50 text-sm focus:outline-none font-mono" />
                  <button onClick={() => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
                    className={`px-5 py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${copied ? 'bg-emerald-400/15 border border-emerald-400/25 text-emerald-400' : 'bg-white/[0.07] border border-white/[0.10] text-white hover:bg-white/[0.10]'}`}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => router.push(`/dashboard/${campaignId}`)} className="bg-white/[0.05] border border-white/[0.09] text-white/70 font-semibold py-4 rounded-2xl hover:bg-white/[0.08] transition-all text-sm">View Campaign →</button>
                <button onClick={() => router.push('/dashboard')} className="bg-[#c8f135] text-black font-black py-4 rounded-2xl hover:bg-[#d4ff3d] transition-all text-sm">Back to Dashboard →</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CONTACT — Other mechanic ══ */}
        {stationId === 'contact' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8">
              <h2 className="text-white font-black text-4xl tracking-tight">We'll be in touch.</h2>
              <p className="text-white/40 text-sm mt-2">Your campaign has been submitted. We'll reach out within 1 business day.</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center mb-6">
              <div className="text-5xl mb-5">👋</div>
              <div className="text-white font-black text-xl mb-2">{promoter.contactName || promoter.name}</div>
              <p className="text-white/40 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
                We've received your submission for <span className="text-white">{campaignName}</span>. A member of our team will review the details and contact <span className="text-white">{promoter.contactEmail || promoter.name}</span> shortly.
              </p>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-left space-y-2.5 max-w-xs mx-auto">
                {[{ label: 'Campaign', value: campaignName }, { label: 'Type', value: mechanic.label }, { label: 'Promoter', value: promoter.name }, { label: 'Dates', value: `${fmtDate(promoStart)} – ${fmtDate(promoEnd)}` }, { label: 'Reference', value: tsCode }].map(item => (
                  <div key={item.label} className="flex gap-3">
                    <span className="text-white/25 text-sm w-20 shrink-0">{item.label}</span>
                    <span className="text-white/60 text-sm font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => { sessionStorage.removeItem('express_campaign_id'); router.push('/dashboard') }}
              className="w-full bg-[#c8f135] text-black font-black text-base py-4 rounded-2xl hover:bg-[#d4ff3d] transition-all shadow-lg shadow-[#c8f135]/10">
              Back to Dashboard →
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
