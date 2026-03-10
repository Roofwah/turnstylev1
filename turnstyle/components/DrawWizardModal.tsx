'use client'

import { useState, useEffect } from 'react'

interface DrawEvent {
  id: string
  name: string
  type: 'major' | 'minor' | 'regional'
  drawDate: string
  drawTime: string
  periodStart: string
  periodEnd: string
  winners: number
  prizes: { tier: string; description: string; qty: number }[]
  region?: string
  purerandomId?: string
  scheduled?: boolean
}

interface DrawWizardModalProps {
  campaignId: string
  promoStart: string
  promoEnd: string
  drawFrequency: string           // 'at_conclusion' | 'daily' | 'weekly' | 'fortnightly' | 'monthly'
  totalPrizePool: number
  maxStatePool: number            // 0 or same as totalPrizePool = no state split
  existingDrawSchedule: DrawEvent[]
  originalDrawFee: number
  onConfirm: (schedule: DrawEvent[]) => void
  onClose: () => void
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function calcDrawFee(draws: number): number {
  const n = Math.max(1, draws)
  if (n === 1) return 275
  if (n <= 4) return 275 + (n - 1) * 125
  return 275 + 3 * 125 + (n - 4) * 95
}

function addDays(dateStr: string, days: number): string {
  const clean = dateStr.split('T')[0]
  const [y, m, d] = clean.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFullDayDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' })
  const month = date.toLocaleDateString('en-AU', { month: 'long' })
  const dayNum = date.getDate()
  const suffix =
    dayNum % 10 === 1 && dayNum !== 11 ? 'st' :
    dayNum % 10 === 2 && dayNum !== 12 ? 'nd' :
    dayNum % 10 === 3 && dayNum !== 13 ? 'rd' :
    'th'
  return `${weekday} ${dayNum}${suffix} ${month}`
}

function daysBetween(startStr: string, endStr: string): number {
  const [sy, sm, sd] = startStr.split('T')[0].split('-').map(Number)
  const [ey, em, ed] = endStr.split('T')[0].split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function getFrequencyDays(freq: string): number {
  switch (freq) {
    case 'daily': return 1
    case 'weekly': return 7
    case 'fortnightly': return 14
    case 'monthly': return 30
    default: return 7
  }
}

function getFrequencyLabel(freq: string): string {
  switch (freq) {
    case 'daily': return 'Daily'
    case 'weekly': return 'Weekly'
    case 'fortnightly': return 'Fortnightly'
    case 'monthly': return 'Monthly'
    case 'at_conclusion': return 'At Conclusion'
    default: return freq
  }
}

// Generate evenly-spaced minor draw dates within the promo period
function generateMinorDates(promoStart: string, promoEnd: string, freq: string): string[] {
  const freqDays = getFrequencyDays(freq)
  const totalDays = daysBetween(promoStart, promoEnd)
  const dates: string[] = []

  // Start from promoStart + freqDays so first draw isn't day 1
  let cursor = freqDays
  while (cursor < totalDays) {
    dates.push(addDays(promoStart, cursor))
    cursor += freqDays
  }
  return dates
}

function buildDraws(
  promoStart: string,
  promoEnd: string,
  freq: string,
  structure: 'minor_only' | 'minor_and_final',
  stateMultiplier: number
): DrawEvent[] {
  const finalDate = addDays(promoEnd, 5)
  const draws: DrawEvent[] = []

  if (freq === 'at_conclusion') {
    // One set of draws all on finalDate
    if (stateMultiplier <= 1) {
      draws.push({
        id: generateId(), name: 'Draw 1', type: 'major',
        drawDate: finalDate, drawTime: '12:00',
        periodStart: promoStart, periodEnd: promoEnd,
        winners: 1, prizes: [],
      })
    } else {
      for (let i = 0; i < stateMultiplier; i++) {
        draws.push({
          id: generateId(), name: `Regional Draw ${i + 1}`, type: 'regional',
          drawDate: finalDate, drawTime: '12:00',
          periodStart: promoStart, periodEnd: promoEnd,
          winners: 1, prizes: [],
        })
      }
    }
    return draws
  }

  // Frequency-based: generate minor draw dates
  const minorDates = generateMinorDates(promoStart, promoEnd, freq)
  let minorCount = 1

  for (const date of minorDates) {
    if (stateMultiplier <= 1) {
      draws.push({
        id: generateId(), name: `Minor ${minorCount}`, type: 'minor',
        drawDate: date, drawTime: '12:00',
        periodStart: promoStart, periodEnd: promoEnd,
        winners: 1, prizes: [],
      })
      minorCount++
    } else {
      for (let i = 0; i < stateMultiplier; i++) {
        draws.push({
          id: generateId(), name: `Minor ${minorCount} – Region ${i + 1}`, type: 'regional',
          drawDate: date, drawTime: '12:00',
          periodStart: promoStart, periodEnd: promoEnd,
          winners: 1, prizes: [],
        })
      }
      minorCount++
    }
  }

  // Add final draw(s) if selected
  if (structure === 'minor_and_final') {
    if (stateMultiplier <= 1) {
      draws.push({
        id: generateId(), name: 'Final Draw', type: 'major',
        drawDate: finalDate, drawTime: '12:00',
        periodStart: promoStart, periodEnd: promoEnd,
        winners: 1, prizes: [],
      })
    } else {
      for (let i = 0; i < stateMultiplier; i++) {
        draws.push({
          id: generateId(), name: `Final Draw – Region ${i + 1}`, type: 'regional',
          drawDate: finalDate, drawTime: '12:00',
          periodStart: promoStart, periodEnd: promoEnd,
          winners: 1, prizes: [],
        })
      }
    }
  }

  return draws
}

export default function DrawWizardModal({
  campaignId,
  promoStart,
  promoEnd,
  drawFrequency,
  totalPrizePool,
  maxStatePool,
  existingDrawSchedule,
  originalDrawFee,
  onConfirm,
  onClose,
}: DrawWizardModalProps) {

  // Calculate state multiplier
  const stateMultiplier = (Number(maxStatePool) > 0 && Number(maxStatePool) < Number(totalPrizePool))
    ? Math.round(Number(totalPrizePool) / Number(maxStatePool))
    : 1

  const hasStateDraws = stateMultiplier > 1

  const [structure, setStructure] = useState<'minor_only' | 'minor_and_final'>('minor_and_final')
  const [draws, setDraws] = useState<DrawEvent[]>(() => {
    if (existingDrawSchedule.length > 0) return existingDrawSchedule
    return buildDraws(promoStart, promoEnd, drawFrequency, 'minor_and_final', stateMultiplier)
  })
  const [saving, setSaving] = useState(false)
  const [showVariationWarning, setShowVariationWarning] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Regenerate draws when structure changes
  useEffect(() => {
    setDraws(buildDraws(promoStart, promoEnd, drawFrequency, structure, stateMultiplier))
  }, [structure])

  const newDrawFee = calcDrawFee(draws.length)
  const hasVariation = originalDrawFee > 0 && Math.abs(newDrawFee - originalDrawFee) > 0.01
  const finalDate = addDays(promoEnd, 5)

  function updateDraw(id: string, field: keyof DrawEvent, value: any) {
    setDraws(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  async function handleConfirm() {
    if (hasVariation && !showVariationWarning) {
      setShowVariationWarning(true)
      return
    }
    setSaving(true)
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawSchedule: draws, drawConfirmed: true }),
      })
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
    onConfirm(draws)
  }

  // Group draws by date for display
  const drawsByDate = draws.reduce((acc, draw) => {
    const key = draw.drawDate
    if (!acc[key]) acc[key] = []
    acc[key].push(draw)
    return acc
  }, {} as Record<string, DrawEvent[]>)

  const sortedDates = Object.keys(drawsByDate).sort()
  const isFinal = (draw: DrawEvent) => draw.name.toLowerCase().includes('final') || draw.type === 'major'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#0f0f17] border border-white/[0.10] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-white font-black text-xl">Draw Schedule</h2>
            <p className="text-white/40 text-sm mt-0.5">
              {getFrequencyLabel(drawFrequency)} draws
              {hasStateDraws && ` · ${stateMultiplier} regional draws per date`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-2xl leading-none">×</button>
        </div>

        {/* Structure selector — only show for frequency-based */}
        {drawFrequency !== 'at_conclusion' && (
          <div className="px-6 pt-4 shrink-0">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">Draw Structure</p>
            <div className="flex gap-2">
              {([
                { value: 'minor_and_final', label: 'Minor draws + Final draw' },
                { value: 'minor_only', label: 'Minor draws only' },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setStructure(opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    structure === opt.value
                      ? 'bg-white text-[#0a0a0f] border-white'
                      : 'bg-white/[0.04] border-white/[0.10] text-white/50 hover:text-white hover:border-white/30'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Variation warning */}
        {showVariationWarning && (
          <div className="mx-6 mt-4 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 font-bold text-sm">Draw fee has changed</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Original: {formatMoney(originalDrawFee)} → New: {formatMoney(newDrawFee)} ({draws.length} draw{draws.length !== 1 ? 's' : ''}).
                This will affect your quote. Confirm to proceed.
              </p>
            </div>
          </div>
        )}

        {/* State draw info */}
        {hasStateDraws && (
          <div className="mx-6 mt-4 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 shrink-0">
            <p className="text-white/50 text-xs">
              State prize split detected — {stateMultiplier} regional draws per draw date
              ({formatMoney(maxStatePool)} per state of {formatMoney(totalPrizePool)} total pool)
            </p>
          </div>
        )}

        {/* Draw list grouped by date */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">

          {/* Column header */}
          <div className="flex items-center gap-3 px-1 mb-1">
            <div className="w-5 shrink-0" />
            <div className="flex-1 text-white/30 text-xs uppercase tracking-widest">Draw Name</div>
            <div className="w-48 text-white/30 text-xs uppercase tracking-widest shrink-0">Date</div>
            <div className="w-20 text-white/30 text-xs uppercase tracking-widest shrink-0">Time</div>
          </div>

          {sortedDates.map(date => {
            const datDraws = drawsByDate[date]
            const isThisFinalDate = date === finalDate
            return (
              <div key={date} className="space-y-1">
                {datDraws.map(draw => (
                  <div key={draw.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                      isFinal(draw)
                        ? 'bg-white/[0.04] border-white/[0.12]'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}>
                    {/* Type badge */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                      draw.type === 'major' ? 'bg-white text-black' :
                      draw.type === 'regional' ? 'bg-purple-400/20 text-purple-400' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {draw.type === 'major' ? '★' : draw.type === 'regional' ? 'R' : '·'}
                    </div>

                    {/* Name */}
                    <input
                      value={draw.name}
                      onChange={e => updateDraw(draw.id, 'name', e.target.value)}
                      className="flex-1 bg-transparent text-white text-sm font-semibold focus:outline-none focus:bg-white/[0.04] rounded px-1 -mx-1"
                    />

                    {/* Date */}
                    <div className="w-48 shrink-0">
                      <div className="text-white/60 text-xs mb-0.5">
                        {draw.drawDate ? formatFullDayDate(draw.drawDate) : '—'}
                      </div>
                      <input
                        type="date"
                        value={draw.drawDate}
                        onChange={e => updateDraw(draw.id, 'drawDate', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Time */}
                    <div className="w-20 shrink-0">
                      <input type="time" value={draw.drawTime}
                        onChange={e => updateDraw(draw.id, 'drawTime', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30" />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-white/40 text-xs">{draws.length} draw{draws.length !== 1 ? 's' : ''} · Draw Administration</div>
            <div className={`font-black text-xl ${hasVariation ? 'text-amber-400' : 'text-white'}`}>
              {formatMoney(newDrawFee)}
              {hasVariation && <span className="text-amber-400/60 text-xs font-normal ml-2">(was {formatMoney(originalDrawFee)})</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/[0.08] transition-all">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={saving || draws.some(d => !d.drawDate || !d.drawTime)}
              className={`font-black text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                showVariationWarning ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white text-[#0a0a0f] hover:bg-white/90'
              }`}>
              {saving ? 'Saving...' : showVariationWarning ? 'Confirm Variation & Save →' : 'Confirm Draw Schedule →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
