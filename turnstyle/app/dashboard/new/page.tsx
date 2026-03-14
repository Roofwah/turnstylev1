'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calculateQuote, calcDrawFee } from '@/lib/quote-engine'
import { createCampaign, createDrawOnlyCampaign } from '@/app/actions/campaigns'
import { searchPromoters, type PromoterRecord } from '@/lib/promoter-lookup'
import MechanicWizardModal, { type MechanicDetails } from '@/components/MechanicWizardModal'
import PrizeWizardModal from '@/components/PrizeWizardModal'
import DrawWizardModal from '@/components/DrawWizardModal'
// ─── Types ────────────────────────────────────────────────────────────────────

interface PrizeTier {
  tier: string
  description: string
  qty: number
  unitValue: number
}

interface FormData {
  promoterName: string
  promoterAbn: string
  contactName: string
  contactEmail: string
  promoterAddress: string
  campaignName: string
  tsCode: string
  promoStart: string
  promoEnd: string
  notes: string
  drawMechanic: string
  drawFrequency: string
  entryMechanic: string
  regions: string[]
  prizes: PrizeTier[]
}

interface DrawOnlyData {
  promoterName: string
  promoterAbn: string
  contactName: string
  contactEmail: string
  promoterAddress: string
  campaignName: string
  drawDate: string
  drawTime: string
  prizes: PrizeTier[]
}

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

const MECHANIC_OPTIONS = [
  { value: 'Sweepstakes',   label: 'Sweepstakes' },
  { value: 'Instant Win',   label: 'Instant Win' },
  { value: 'Limited Offer', label: 'Limited Offer' },
  { value: 'Game of Skill', label: 'Game of Skill' },
  { value: 'Other',         label: 'Other' },
]

const FREQUENCY_OPTIONS = [
  { value: 'at_conclusion', label: 'At Conclusion (single draw)' },
  { value: 'daily',         label: 'Daily' },
  { value: 'weekly',        label: 'Weekly' },
  { value: 'fortnightly',   label: 'Fortnightly' },
  { value: 'monthly',       label: 'Monthly' },
]

// Draw frequency only shown for Sweepstakes
const DRAW_FREQUENCY_MECHANICS = ['Sweepstakes']

const STEPS = [
  { id: 1, label: 'Promoter' },
  { id: 2, label: 'Campaign' },
  { id: 3, label: 'Mechanic' },
  { id: 4, label: 'Prizes' },
  { id: 5, label: 'Draws' },
  { id: 6, label: 'Review' },
]

const DRAW_ONLY_STEPS = [
  { id: 1, label: 'Promoter' },
  { id: 2, label: 'Campaign' },
  { id: 3, label: 'Prizes' },
  { id: 4, label: 'Review' },
]

const EMPTY_PRIZE: PrizeTier = { tier: '', description: '', qty: 1, unitValue: 0 }

function generateTsCode(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5).padEnd(5, 'X')
}

// ─── Field components ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required, min }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; min?: string
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required} min={min}
      className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all"
    />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
    >
      <option value="" className="bg-[#1a1a2e]">Select...</option>
      {options.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>)}
    </select>
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all resize-none"
    />
  )
}

function RegionBtn({ active, onClick, children, future = false }: {
  active: boolean; onClick: () => void; children: React.ReactNode; future?: boolean
}) {
  if (future) {
    return (
      <button type="button" onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          active
            ? 'bg-white/20 text-white border border-white/30'
            : 'bg-white/[0.03] border border-dashed border-white/[0.10] text-white/25 hover:text-white/50'
        }`}
      >{children}</button>
    )
  }
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        active
          ? 'bg-white text-black'
          : 'bg-white/[0.06] border border-white/[0.10] text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >{children}</button>
  )
}

// ─── Draw Only Modal ──────────────────────────────────────────────────────────

function DrawOnlyModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#12121a] border border-white/[0.10] rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-white font-black text-xl mb-2">Draw Only Campaign</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Do you already have your own Terms & Conditions and the applicable State permit numbers for this promotion?
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={onConfirm}
            className="w-full bg-white text-[#0a0a0f] font-black text-sm px-6 py-3.5 rounded-xl hover:bg-white/90 transition-all"
          >
            Yes — I have my T&Cs and permits
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all"
          >
            No — I need Turnstyle to manage this
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BuildFormPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showDrawOnlyModal, setShowDrawOnlyModal] = useState(false)
  const [isDrawOnly, setIsDrawOnly] = useState(false)
  const [promoterSuggestions, setPromoterSuggestions] = useState<PromoterRecord[]>([])
  const [promoterLocked, setPromoterLocked] = useState(false)

  const [form, setForm] = useState<FormData>({
    promoterName: '', promoterAbn: '', promoterAddress: '', contactName: '', contactEmail: '',
    campaignName: '', tsCode: '', promoStart: '', promoEnd: '', notes: '',
    drawMechanic: '', drawFrequency: 'at_conclusion', entryMechanic: '',
    regions: [],
    prizes: [{ ...EMPTY_PRIZE, tier: '1st' }],
  })

  const [showMechanicWizard, setShowMechanicWizard] = useState(false)
  const [mechanicDetails, setMechanicDetails] = useState<MechanicDetails | null>(null)

  const [showPrizeWizard, setShowPrizeWizard] = useState(false)
  const [prizesConfirmed, setPrizesConfirmed] = useState(false)
  const [confirmedPrizes, setConfirmedPrizes] = useState<any[]>([])
  const [prizePoolTotal, setPrizePoolTotal] = useState(0)
  const [maxStatePool, setMaxStatePool] = useState(0)
  const [requiredPermits, setRequiredPermits] = useState<string[]>([])

  const [showDrawWizard, setShowDrawWizard] = useState(false)
  const [drawsConfirmed, setDrawsConfirmed] = useState(false)
  const [confirmedDrawSchedule, setConfirmedDrawSchedule] = useState<any[]>([])

  const [drawOnly, setDrawOnly] = useState<DrawOnlyData>({
    promoterName: '', promoterAbn: '', contactName: '', contactEmail: '', promoterAddress: '',
    campaignName: '', drawDate: '', drawTime: '',
    prizes: [{ ...EMPTY_PRIZE, tier: '1st' }],
  })

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setDO<K extends keyof DrawOnlyData>(key: K, value: DrawOnlyData[K]) {
    setDrawOnly(prev => ({ ...prev, [key]: value }))
  }

  function handleCampaignNameChange(name: string) {
    set('campaignName', name)
    if (form.tsCode === '' || form.tsCode === generateTsCode(form.campaignName)) {
      set('tsCode', generateTsCode(name))
    }
  }

  // ── Draw Only confirmation ──
  function confirmDrawOnly() {
    setShowDrawOnlyModal(false)
    setIsDrawOnly(true)
    // Pre-fill draw only form with promoter data already entered
    setDrawOnly(prev => ({
      ...prev,
      promoterName: form.promoterName,
      promoterAbn: form.promoterAbn,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      promoterAddress: form.promoterAddress,
      campaignName: form.campaignName,
    }))
    // Stay on step 2 to enter draw date and time
  }

  function cancelDrawOnly() {
    setShowDrawOnlyModal(false)
    setIsDrawOnly(false)
  }

  // ── Validate draw date/time is at least 60 mins from now ──
  function drawDateTimeValid(): boolean {
    if (!drawOnly.drawDate || !drawOnly.drawTime) return false
    const dt = new Date(`${drawOnly.drawDate}T${drawOnly.drawTime}:00`)
    const minTime = new Date(Date.now() + 60 * 60 * 1000)
    return dt >= minTime
  }

  // ── Region helpers ──
  const hasNational = form.regions.includes('national_au')
  const hasStates   = form.regions.some(r => AU_STATES.includes(r))

  function toggleNational() {
    if (hasNational) {
      set('regions', form.regions.filter(r => r !== 'national_au'))
    } else {
      set('regions', [...form.regions.filter(r => !AU_STATES.includes(r) && r !== 'national_au'), 'national_au'])
    }
  }

  function toggleAustStates() {
    if (hasStates) {
      set('regions', form.regions.filter(r => !AU_STATES.includes(r)))
    } else {
      set('regions', [...form.regions.filter(r => r !== 'national_au'), 'NSW'])
    }
  }

  function toggleState(state: string) {
    set('regions', form.regions.includes(state)
      ? form.regions.filter(r => r !== state)
      : [...form.regions, state]
    )
  }

  function toggleRegion(region: string) {
    set('regions', form.regions.includes(region)
      ? form.regions.filter(r => r !== region)
      : [...form.regions, region]
    )
  }

  // ── Prize helpers (standard) ──
  function updatePrize(index: number, field: keyof PrizeTier, value: string | number) {
    set('prizes', form.prizes.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }
  function addPrize() {
    const tiers = ['1st', '2nd', '3rd', '4th', '5th']
    set('prizes', [...form.prizes, { ...EMPTY_PRIZE, tier: tiers[form.prizes.length] ?? '' }])
  }
  function removePrize(index: number) {
    set('prizes', form.prizes.filter((_, i) => i !== index))
  }

  // ── Prize helpers (draw only) ──
  function updateDOPrize(index: number, field: keyof PrizeTier, value: string | number) {
    setDrawOnly(prev => ({ ...prev, prizes: prev.prizes.map((p, i) => i === index ? { ...p, [field]: value } : p) }))
  }
  function addDOPrize() {
    const tiers = ['1st', '2nd', '3rd', '4th', '5th']
    setDrawOnly(prev => ({ ...prev, prizes: [...prev.prizes, { ...EMPTY_PRIZE, tier: tiers[prev.prizes.length] ?? '' }] }))
  }
  function removeDOPrize(index: number) {
    setDrawOnly(prev => ({ ...prev, prizes: prev.prizes.filter((_, i) => i !== index) }))
  }

  // ── Live quote (standard) ──
  const hasQuoteInputs  = form.promoStart && form.promoEnd && form.drawMechanic
  const quote = hasQuoteInputs ? calculateQuote({
    campaignId: 'new', tsCode: form.tsCode || 'XXXXX', campaignName: form.campaignName,
    promoStart: form.promoStart, promoEnd: form.promoEnd,
    drawMechanic: form.drawMechanic, drawFrequency: form.drawFrequency, prizes: confirmedPrizes.length > 0 ? confirmedPrizes : form.prizes,
  }) : null

  // ── Draw Only quote ──
  const doPrizePoolTotal = drawOnly.prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const doDrawFee = calcDrawFee(1) // single draw
  const doCampaignMgmtFee = 100
  const doTotalExGst = doCampaignMgmtFee + doDrawFee
  const doGst = Math.round(doTotalExGst * 0.1 * 100) / 100
  const doTotalIncGst = doTotalExGst + doGst

  // ── Show Draw Frequency only for Sweepstakes ──
  const showDrawFrequency = DRAW_FREQUENCY_MECHANICS.includes(form.drawMechanic)

  function canProceed(): boolean {
    if (isDrawOnly) {
      if (step === 1) return !!(form.promoterName && form.contactName && form.contactEmail)
      if (step === 2) return !!(form.campaignName && drawOnly.drawDate && drawOnly.drawTime && drawDateTimeValid())
      if (step === 3) return drawOnly.prizes.length > 0 && drawOnly.prizes.every(p => p.description && p.qty > 0 && p.unitValue > 0)
      return true
    }
    if (step === 1) return !!(form.promoterName && form.contactName && form.contactEmail)
    if (step === 2) return !!(form.campaignName && form.promoStart && form.promoEnd)
    if (step === 3) return !!(form.drawMechanic && form.regions.length > 0)
    if (step === 4) return prizesConfirmed
    if (step === 5) return drawsConfirmed
    return true
  }

  async function handleSubmit() {
    setSaving(true)
    if (isDrawOnly) {
      const draws =
        drawsConfirmed && confirmedDrawSchedule.length > 0
          ? confirmedDrawSchedule.map((d: { drawDate?: string; date?: string; drawTime?: string; time?: string; winners?: number }) => ({
              drawDate: d.drawDate || d.date || '',
              drawTime: d.drawTime || d.time || '12:00',
              winners: Number(d.winners) || 1,
            }))
          : [{ drawDate: drawOnly.drawDate, drawTime: drawOnly.drawTime, winners: 1 }]
      await createDrawOnlyCampaign({
        promoterName: form.promoterName,
        promoterAbn: form.promoterAbn,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        promoterAddress: form.promoterAddress,
        campaignName: drawOnly.campaignName,
        draws,
        prizes: drawOnly.prizes,
      })
    } else {
      await createCampaign({
        ...form,
        prizes: confirmedPrizes.length > 0 ? confirmedPrizes : form.prizes,
      })
    }
  }

  function formatMoney(n: number) {
    return '$' + n.toLocaleString('en-AU')
  }

  function formatRegionsSummary() {
    const parts: string[] = []
    if (hasNational) parts.push('Australia')
    else if (hasStates) parts.push('Aust: ' + form.regions.filter(r => AU_STATES.includes(r)).join(', '))
    if (form.regions.includes('NZ'))  parts.push('NZ')
    if (form.regions.includes('USA')) parts.push('USA')
    if (form.regions.includes('EU'))  parts.push('EU')
    return parts.join(' · ') || '—'
  }

  const activeSteps = isDrawOnly ? DRAW_ONLY_STEPS : STEPS
  const maxStep = activeSteps.length

  // ── Handle step 2 Next in draw only mode ──
  function handleNext() {
    const next = step + 1
    setStep(next)
    if (next === 4 && !prizesConfirmed) setShowPrizeWizard(true)
    if (next === 5 && !drawsConfirmed) setShowDrawWizard(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }}
      />

      {/* Draw Only Modal */}
      {showDrawOnlyModal && (
        <DrawOnlyModal onConfirm={confirmDrawOnly} onCancel={cancelDrawOnly} />
      )}

      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-6">
          <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/40 hover:text-white transition-colors text-sm">← Campaigns</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">New Campaign</span>
            {isDrawOnly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-400/10 border border-sky-400/20 text-sky-400 font-bold">Draw Only</span>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-10">
          {activeSteps.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  step > s.id ? 'bg-emerald-400 text-black' : step === s.id ? 'bg-white text-black' : 'bg-white/10 text-white/30'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span className={`text-xs mt-1.5 font-semibold transition-all ${step === s.id ? 'text-white' : 'text-white/20'}`}>
                  {s.label}
                </span>
              </div>
              {i < activeSteps.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-5 transition-all ${step > s.id ? 'bg-emerald-400/40' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Promoter (shared) ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Promoter details</h2>
              <p className="text-white/40 text-sm">Who is running this promotion?</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="relative">
                <Label>Company / Promoter Name *</Label>
                <Input value={form.promoterName} onChange={v => {
                  set('promoterName', v)
                  setPromoterLocked(false)
                  setPromoterSuggestions(v.length >= 3 ? searchPromoters(v) : [])
                }} placeholder="e.g. Repco, Woolworths..." required />
                {promoterSuggestions.length > 0 && !promoterLocked && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/[0.12] rounded-xl overflow-hidden shadow-xl">
                    {promoterSuggestions.map(p => (
                      <button key={p.abn} type="button"
                        onClick={() => {
                          set('promoterName', p.name)
                          set('promoterAbn', p.abn)
                          set('promoterAddress', p.address)
                          setPromoterSuggestions([])
                          setPromoterLocked(true)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-all border-b border-white/[0.06] last:border-0">
                        <div className="text-white text-sm font-semibold">{p.name}</div>
                        <div className="text-white/40 text-xs mt-0.5">ABN {p.abn} · {p.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>ABN {!promoterLocked && <span className="text-amber-400/70 normal-case font-normal">(auto-filled when promoter selected)</span>}</Label>
                <Input value={form.promoterAbn} onChange={v => set('promoterAbn', v)} placeholder="e.g. 26 004 139 397" />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.promoterAddress} onChange={v => set('promoterAddress', v)} placeholder="e.g. 22 Enterprise Drive, Rowville VIC 3178" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Contact Name *</Label><Input value={form.contactName} onChange={v => set('contactName', v)} placeholder="Full name" required /></div>
              </div>
              <div><Label>Contact Email *</Label><Input value={form.contactEmail} onChange={v => set('contactEmail', v)} placeholder="email@company.com" type="email" required /></div>
            </div>
          </div>
        )}

        {/* ── Step 2: Campaign (shared — draw only adds draw date/time) ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Campaign details</h2>
              <p className="text-white/40 text-sm">
                {isDrawOnly ? 'Name your draw and set the draw date and time.' : 'Name your campaign and set the dates.'}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div>
                <Label>Campaign Name *</Label>
                <Input value={form.campaignName} onChange={handleCampaignNameChange} placeholder="e.g. Summer Promo 2026" required />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => isDrawOnly ? setIsDrawOnly(false) : setShowDrawOnlyModal(true)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isDrawOnly ? 'bg-white/40' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white/60 transition-transform ${isDrawOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-white/25 text-xs">Draw Only</span>
                  {isDrawOnly && <span className="text-white/35 text-xs">· start/end dates not required</span>}
                </div>
              </div>

              {!isDrawOnly && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Promotion Start *</Label>
                      <input type="date" value={form.promoStart} min={new Date().toISOString().split('T')[0]}
                        onChange={e => { set('promoStart', e.target.value); if (form.promoEnd && e.target.value > form.promoEnd) set('promoEnd', '') }}
                        required className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all" />
                    </div>
                    <div>
                      <Label>Promotion End *</Label>
                      <input type="date" value={form.promoEnd} min={form.promoStart || new Date().toISOString().split('T')[0]}
                        onChange={e => set('promoEnd', e.target.value)}
                        required className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all" />
                    </div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={v => set('notes', v)} placeholder="Any special requirements..." /></div>
                </>
              )}

              {isDrawOnly && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Draw Date *</Label>
                      <input type="date"
                        value={drawOnly.drawDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setDO('drawDate', e.target.value)}
                        required
                        className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all"
                      />
                    </div>
                    <div>
                      <Label>Draw Time *</Label>
                      <input type="time"
                        value={drawOnly.drawTime}
                        onChange={e => setDO('drawTime', e.target.value)}
                        required
                        className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all"
                      />
                    </div>
                  </div>
                  {drawOnly.drawDate && drawOnly.drawTime && !drawDateTimeValid() && (
                    <p className="text-amber-400 text-xs">⚠ Draw must be scheduled at least 60 minutes from now.</p>
                  )}
                  <div className="bg-sky-400/5 border border-sky-400/20 rounded-xl px-4 py-3">
                    <p className="text-sky-400/80 text-xs">Promotion Type: <span className="font-bold text-sky-400">Sweepstakes</span> · Draw Administration: <span className="font-bold text-sky-400">PureRandom</span></p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Mechanic (standard only) ── */}
        {step === 3 && !isDrawOnly && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Promotion mechanic</h2>
              <p className="text-white/40 text-sm">How will winners be selected?</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div>
                <Label>Promotion Type *</Label>
                <Select value={form.drawMechanic} onChange={v => {
                  set('drawMechanic', v)
                  if (!DRAW_FREQUENCY_MECHANICS.includes(v)) {
                    set('drawFrequency', 'at_conclusion')
                  }
                }} options={MECHANIC_OPTIONS} />
              </div>

              {/* Only show Draw Frequency for Sweepstakes */}
              {showDrawFrequency && (
                <div>
                  <Label>Draw Frequency</Label>
                  <Select value={form.drawFrequency} onChange={v => set('drawFrequency', v)} options={FREQUENCY_OPTIONS} />
                </div>
              )}

              <div>
                <Label>Entry Method</Label>
                <Select value={form.entryMechanic} onChange={v => {
                  set('entryMechanic', v)
                }} options={[
                  { value: 'Account Based Purchases', label: 'Account Based Purchases' },
                  { value: 'Purchase & Show Loyalty Card', label: 'Purchase & Show Loyalty Card' },
                  { value: 'Online - Purchase Required', label: 'Online - Purchase Required' },
                  { value: 'Online - No Purchase', label: 'Online - No Purchase' },
                  { value: 'Other', label: 'Other' },
                ]} />
                {mechanicDetails && (
                  <div className="mt-2 flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                    <span className="text-white/50 text-xs">{mechanicDetails.purchaseValue ? ('Purchase $' + mechanicDetails.purchaseValue + ' (' + mechanicDetails.gstType + '. GST) of any ' + mechanicDetails.participatingBrand) : 'No purchase necessary'}</span>
                    <button type="button" onClick={() => setShowMechanicWizard(true)} className="text-white/30 hover:text-white text-xs font-semibold ml-3 shrink-0">Edit</button>
                  </div>
                )}
              </div>

              {/* Regions */}
              <div>
                <Label>Region *</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RegionBtn active={hasNational} onClick={toggleNational}>Australia</RegionBtn>
                    <RegionBtn active={hasStates} onClick={toggleAustStates}>Aust States</RegionBtn>
                    <RegionBtn active={form.regions.includes('NZ')} onClick={() => toggleRegion('NZ')}>NZ</RegionBtn>
                    <div className="ml-auto flex gap-2">
                      <RegionBtn future active={form.regions.includes('USA')} onClick={() => toggleRegion('USA')}>USA</RegionBtn>
                      <RegionBtn future active={form.regions.includes('EU')} onClick={() => toggleRegion('EU')}>EU</RegionBtn>
                    </div>
                  </div>
                  {hasStates && (
                    <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                      {AU_STATES.map(state => (
                        <button key={state} type="button" onClick={() => toggleState(state)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                            form.regions.includes(state)
                              ? 'bg-white text-black'
                              : 'bg-white/[0.05] border border-white/[0.08] text-white/35 hover:text-white hover:bg-white/10'
                          }`}
                        >{state}</button>
                      ))}
                    </div>
                  )}
                </div>
                {form.regions.length === 0 && <p className="text-white/30 text-xs mt-2">Select at least one region</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Prizes (standard) — Prize Wizard ── */}
        {!isDrawOnly && step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Prize structure</h2>
              <p className="text-white/40 text-sm">Define your prize pool using the prize wizard.</p>
            </div>
            {prizesConfirmed ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Prizes confirmed</span>
                  <button type="button" onClick={() => setShowPrizeWizard(true)} className="text-white/30 hover:text-white text-xs font-semibold">Edit</button>
                </div>
                {confirmedPrizes.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/60">Tier {p.tier} · {p.description}</span>
                    <span className="text-white/80 font-semibold">{p.qty} x ${Number(p.unitValue).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-white/[0.06] pt-3 flex justify-between">
                  <span className="text-white/40 text-sm">Total Prize Pool</span>
                  <span className="text-white font-black">${prizePoolTotal.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-dashed border-white/[0.10] rounded-2xl p-8 flex flex-col items-center gap-4">
                <p className="text-white/30 text-sm">No prizes configured yet</p>
                <button type="button" onClick={() => setShowPrizeWizard(true)}
                  className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all">
                  Open Prize Wizard
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Draws (standard) — Draw Wizard ── */}
        {!isDrawOnly && step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Draw schedule</h2>
              <p className="text-white/40 text-sm">Configure your draw dates using the draw wizard.</p>
            </div>
            {drawsConfirmed ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Draws confirmed</span>
                  <button type="button" onClick={() => setShowDrawWizard(true)} className="text-white/30 hover:text-white text-xs font-semibold">Edit</button>
                </div>
                {confirmedDrawSchedule.map((d: any, i: number) => {
                  const dateStr = d.drawDate || d.date || ''
                  let prettyDate = '—'
                  if (dateStr) {
                    const [y, m, day] = dateStr.split('-').map((n: string) => parseInt(n, 10))
                    const dt = new Date(y, m - 1, day)
                    const weekday = dt.toLocaleDateString('en-AU', { weekday: 'long' })
                    const month = dt.toLocaleDateString('en-AU', { month: 'short' })
                    const dnum = dt.getDate()
                    const suffix =
                      dnum % 10 === 1 && dnum !== 11 ? 'st' :
                      dnum % 10 === 2 && dnum !== 12 ? 'nd' :
                      dnum % 10 === 3 && dnum !== 13 ? 'rd' :
                      'th'
                    prettyDate = `${weekday} ${dnum}${suffix} ${month}`
                  }
                  const timeStr = d.drawTime || d.time || ''
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-white/60">{d.name}</span>
                      <span className="text-white/50">
                        {prettyDate}
                        {timeStr ? ` · ${timeStr}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-dashed border-white/[0.10] rounded-2xl p-8 flex flex-col items-center gap-4">
                <p className="text-white/30 text-sm">No draws configured yet</p>
                <button type="button" onClick={() => setShowDrawWizard(true)}
                  className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all">
                  Open Draw Wizard
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Prizes (draw only) ── */}
        {isDrawOnly && step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Prize structure</h2>
              <p className="text-white/40 text-sm">Add all prize tiers. Values drive permit fee calculations.</p>
            </div>
            <div className="space-y-3">
              {(isDrawOnly ? drawOnly.prizes : form.prizes).map((prize, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-bold text-sm">Prize {i + 1}</span>
                    {(isDrawOnly ? drawOnly.prizes : form.prizes).length > 1 && (
                      <button type="button" onClick={() => isDrawOnly ? removeDOPrize(i) : removePrize(i)} className="text-white/20 hover:text-red-400 transition-colors text-xs font-semibold">Remove</button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Tier</Label><Input value={prize.tier} onChange={v => isDrawOnly ? updateDOPrize(i, 'tier', v) : updatePrize(i, 'tier', v)} placeholder="1st" /></div>
                      <div><Label>Qty</Label><Input value={String(prize.qty)} onChange={v => isDrawOnly ? updateDOPrize(i, 'qty', parseInt(v) || 1) : updatePrize(i, 'qty', parseInt(v) || 1)} type="number" placeholder="1" /></div>
                      <div><Label>Unit Value ($)</Label><Input value={String(prize.unitValue || '')} onChange={v => isDrawOnly ? updateDOPrize(i, 'unitValue', parseFloat(v) || 0) : updatePrize(i, 'unitValue', parseFloat(v) || 0)} type="number" placeholder="0" /></div>
                    </div>
                    <div><Label>Description</Label><Input value={prize.description} onChange={v => isDrawOnly ? updateDOPrize(i, 'description', v) : updatePrize(i, 'description', v)} placeholder="e.g. $5,000 cash prize" /></div>
                    {prize.qty > 0 && prize.unitValue > 0 && (
                      <p className="text-white/30 text-xs">Subtotal: {formatMoney(prize.qty * prize.unitValue)}</p>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => isDrawOnly ? addDOPrize() : addPrize()}
                className="w-full bg-white/[0.03] border border-dashed border-white/[0.10] rounded-2xl py-4 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-sm font-semibold">
                + Add prize tier
              </button>
            </div>
            {(isDrawOnly ? doPrizePoolTotal : prizePoolTotal) > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 flex justify-between items-center">
                <span className="text-white/40 text-sm">Total Prize Pool</span>
                <span className="text-white font-black text-lg">{formatMoney(isDrawOnly ? doPrizePoolTotal : prizePoolTotal)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review (draw only) / Step 6: Review (standard) ── */}
        {((isDrawOnly && step === 4) || (!isDrawOnly && step === 6)) && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-black text-2xl mb-1">Review & confirm</h2>
              <p className="text-white/40 text-sm">Check everything looks right before saving.</p>
            </div>

            {/* Summary */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
              {isDrawOnly ? (
                <>
                  {[
                    { label: 'Promoter',    value: form.promoterName },
                    { label: 'Contact',     value: `${form.contactName} · ${form.contactEmail}` },
                    { label: 'Campaign',    value: form.campaignName },
                    { label: 'Type',        value: '⚡ Draw Only · Sweepstakes' },
                    { label: 'Draw Date',   value: drawOnly.drawDate },
                    { label: 'Draw Time',   value: drawOnly.drawTime },
                    { label: 'Prize Pool',  value: formatMoney(doPrizePoolTotal) },
                    { label: 'Prizes',      value: `${drawOnly.prizes.length} tier(s)` },
                  ].map(row => (
                    <div key={row.label} className="flex gap-4">
                      <span className="text-white/30 text-sm w-28 shrink-0">{row.label}</span>
                      <span className="text-white/80 text-sm">{row.value || '—'}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { label: 'Promoter',   value: form.promoterName },
                    { label: 'Contact',    value: `${form.contactName} · ${form.contactEmail}` },
                    { label: 'Campaign',   value: form.campaignName },
                    { label: 'Code',       value: form.tsCode },
                    { label: 'Dates',      value: `${form.promoStart} → ${form.promoEnd}` },
                    { label: 'Mechanic',   value: form.drawMechanic },
                    { label: 'Frequency',  value: showDrawFrequency ? form.drawFrequency : 'N/A' },
                    { label: 'Regions',    value: formatRegionsSummary() },
                    { label: 'Prize Pool', value: formatMoney(prizePoolTotal) },
                    { label: 'Prizes',     value: `${form.prizes.length} tier(s)` },
                  ].map(row => (
                    <div key={row.label} className="flex gap-4">
                      <span className="text-white/30 text-sm w-28 shrink-0">{row.label}</span>
                      <span className="text-white/80 text-sm">{row.value || '—'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Quote */}
            {isDrawOnly ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">Quote — Draw Only</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-white/60 text-sm">Campaign Management (Draw Only)</span>
                    <span className="text-white/80 text-sm font-semibold">{formatMoney(doCampaignMgmtFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60 text-sm">Draw Administration (1 draw)</span>
                    <span className="text-white/80 text-sm font-semibold">{formatMoney(doDrawFee)}</span>
                  </div>
                </div>
                <div className="border-t border-white/[0.06] pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-white font-bold">Total (excl GST)</span>
                    <span className="text-white font-black text-lg">{formatMoney(doTotalExGst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">GST</span>
                    <span className="text-white/60 text-sm">{formatMoney(doGst)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 text-sm">Total (incl GST)</span>
                    <span className="text-white/60 text-sm">{formatMoney(doTotalIncGst)}</span>
                  </div>
                </div>
                <p className="text-white/20 text-xs mt-4">No terms fee · No permit fee · Proceeds directly to Scheduled on approval.</p>
              </div>
            ) : quote ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">Estimated Quote</h3>
                <div className="space-y-2 mb-4">
                  {quote.lines.map((line, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-white/60 text-sm">{line.label}</span>
                      <span className="text-white/80 text-sm font-semibold">{formatMoney(line.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-white font-bold">Total (excl GST)</span>
                  <span className="text-white font-black text-lg">{formatMoney(quote.totalExGst)}</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
          <button type="button" onClick={() => setStep(s => s - 1)}
            className={`text-white/40 hover:text-white text-sm font-semibold transition-all ${step === 1 ? 'invisible' : ''}`}>
            ← Back
          </button>
          {step < maxStep ? (
            <button type="button" onClick={handleNext} disabled={!canProceed()}
              className="bg-white text-[#0a0a0f] font-black text-sm px-8 py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              Continue →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="bg-white text-[#0a0a0f] font-black text-sm px-8 py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          )}
        </div>

      </main>

      {showMechanicWizard && form.entryMechanic && form.entryMechanic !== 'Other' && (
        <MechanicWizardModal
          entryMechanic={form.entryMechanic}
          initialDetails={mechanicDetails ?? undefined}
          onConfirm={(details) => { setMechanicDetails(details); setShowMechanicWizard(false) }}
          onClose={() => setShowMechanicWizard(false)}
        />
      )}

      {showPrizeWizard && (
        <PrizeWizardModal
          campaignId="new"
          existingPrizes={confirmedPrizes.length > 0 ? confirmedPrizes : []}
          originalPrizePoolTotal={prizePoolTotal}
          initialMaxStatePool={maxStatePool}
          onConfirm={(prizes, msp, permits) => {
            setConfirmedPrizes(prizes)
            setPrizePoolTotal(prizes.reduce((s: number, p: any) => s + p.qty * p.unitValue, 0))
            setMaxStatePool(msp)
            setRequiredPermits(permits)
            setPrizesConfirmed(true)
            setShowPrizeWizard(false)
          }}
          onClose={() => setShowPrizeWizard(false)}
        />
      )}

      {showDrawWizard && (
        <DrawWizardModal
          campaignId="new"
          promoStart={form.promoStart}
          promoEnd={form.promoEnd}
          drawFrequency={form.drawFrequency}
          totalPrizePool={prizePoolTotal}
          maxStatePool={maxStatePool}
          existingDrawSchedule={confirmedDrawSchedule}
          originalDrawFee={0}
          onConfirm={(schedule) => {
            setConfirmedDrawSchedule(schedule)
            setDrawsConfirmed(true)
            setShowDrawWizard(false)
          }}
          onClose={() => setShowDrawWizard(false)}
        />
      )}

    </div>
  )
}