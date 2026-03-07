'use client'

import { useState } from 'react'

interface PrizeTier {
  tier: string
  description: string
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
  winners: number
  prizes: { tier: string; description: string; qty: number }[]
  region?: string
  purerandomId?: string
  scheduled?: boolean
}

interface DrawWizardModalProps {
  campaignId: string
  campaignName: string
  tsCode: string
  promoStart: string
  promoEnd: string
  confirmedPrizes: PrizeTier[]
  existingDrawSchedule: DrawEvent[]
  originalDrawFee: number
  mechanicType: string
  onConfirm: (schedule: DrawEvent[]) => void
  onClose: () => void
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function calcDrawFee(draws: number): number {
  const n = Math.max(1, draws)
  if (n === 1) return 275
  if (n <= 4) return 275 + (n - 1) * 125
  return 275 + 3 * 125 + (n - 4) * 95
}

const DRAW_TYPES = [
  { value: 'major', label: 'Major Draw' },
  { value: 'minor', label: 'Minor Draw' },
  { value: 'regional', label: 'Regional Draw' },
]

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function defaultDraw(promoEnd: string, prizes: PrizeTier[], index: number): DrawEvent {
  const drawDate = addDays(promoEnd, 5)
  return {
    id: generateId(),
    name: index === 0 ? 'Major Draw' : `Draw ${index + 1}`,
    type: 'major',
    drawDate,
    drawTime: '14:00',
    periodStart: '',
    periodEnd: promoEnd,
    winners: 1,
    prizes: prizes.slice(0, 1).map(p => ({ tier: p.tier, description: p.description, qty: 1 })),
  }
}

export default function DrawWizardModal({
  campaignId,
  campaignName,
  tsCode,
  promoStart,
  promoEnd,
  confirmedPrizes,
  existingDrawSchedule,
  originalDrawFee,
  mechanicType,
  onConfirm,
  onClose,
}: DrawWizardModalProps) {
  const [draws, setDraws] = useState<DrawEvent[]>(
    existingDrawSchedule.length > 0
      ? existingDrawSchedule
      : [defaultDraw(promoEnd, confirmedPrizes, 0)]
  )
  const [saving, setSaving] = useState(false)
  const [showVariationWarning, setShowVariationWarning] = useState(false)
  const [expandedDraw, setExpandedDraw] = useState<string>(draws[0]?.id ?? '')

  const newDrawFee = calcDrawFee(draws.length)
  const hasVariation = Math.abs(newDrawFee - originalDrawFee) > 0.01

  function updateDraw(id: string, field: keyof DrawEvent, value: any) {
    setDraws(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  function addDraw() {
    const newDraw = defaultDraw(promoEnd, confirmedPrizes, draws.length)
    setDraws(prev => [...prev, newDraw])
    setExpandedDraw(newDraw.id)
  }

  function removeDraw(id: string) {
    setDraws(prev => {
      const updated = prev.filter(d => d.id !== id)
      if (expandedDraw === id && updated.length > 0) setExpandedDraw(updated[0].id)
      return updated
    })
  }

  function updateDrawPrize(drawId: string, prizeIdx: number, field: string, value: any) {
    setDraws(prev => prev.map(d => {
      if (d.id !== drawId) return d
      const updated = [...d.prizes]
      updated[prizeIdx] = { ...updated[prizeIdx], [field]: value }
      return { ...d, prizes: updated }
    }))
  }

  function addDrawPrize(drawId: string) {
    const remaining = confirmedPrizes.filter(p =>
      !draws.find(d => d.id === drawId)?.prizes.find(dp => dp.tier === p.tier)
    )
    if (remaining.length === 0) return
    const next = remaining[0]
    setDraws(prev => prev.map(d => d.id === drawId
      ? { ...d, prizes: [...d.prizes, { tier: next.tier, description: next.description, qty: 1 }] }
      : d
    ))
  }

  function removeDrawPrize(drawId: string, prizeIdx: number) {
    setDraws(prev => prev.map(d => d.id === drawId
      ? { ...d, prizes: d.prizes.filter((_, i) => i !== prizeIdx) }
      : d
    ))
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
        body: JSON.stringify({
          drawSchedule: draws,
          drawConfirmed: true,
        }),
      })
      onConfirm(draws)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const minDrawDate = promoEnd ? addDays(promoEnd, 1) : new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0f0f17] border border-white/[0.10] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-black text-xl">Draw Wizard</h2>
            <p className="text-white/40 text-sm mt-0.5">Schedule draws and allocate prizes</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-2xl leading-none">×</button>
        </div>

        {/* Variation warning */}
        {showVariationWarning && (
          <div className="mx-6 mt-4 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 font-bold text-sm">Draw fee has changed</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Original: {formatMoney(originalDrawFee)} → New: {formatMoney(newDrawFee)} ({draws.length} draw{draws.length > 1 ? 's' : ''}).
                This will affect your quote. Confirm to proceed.
              </p>
            </div>
          </div>
        )}

        {/* Draw list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {draws.map((draw, idx) => (
            <div key={draw.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">

              {/* Draw header — click to expand */}
              <button
                onClick={() => setExpandedDraw(expandedDraw === draw.id ? '' : draw.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-mono w-5">{idx + 1}</span>
                  <span className="text-white font-semibold text-sm">{draw.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    draw.type === 'major' ? 'bg-white/10 border-white/20 text-white/60' :
                    draw.type === 'minor' ? 'bg-blue-400/10 border-blue-400/20 text-blue-400' :
                    'bg-purple-400/10 border-purple-400/20 text-purple-400'
                  }`}>{draw.type}</span>
                  {draw.drawDate && <span className="text-white/30 text-xs">{draw.drawDate}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {draws.length > 1 && (
                    <span onClick={e => { e.stopPropagation(); removeDraw(draw.id) }}
                      className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none px-1">×</span>
                  )}
                  <span className="text-white/30 text-xs">{expandedDraw === draw.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Draw detail */}
              {expandedDraw === draw.id && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4">

                  {/* Name & Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Draw Name</label>
                      <input value={draw.name} onChange={e => updateDraw(draw.id, 'name', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
                    </div>
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Type</label>
                      <select value={draw.type} onChange={e => updateDraw(draw.id, 'type', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none appearance-none cursor-pointer">
                        {DRAW_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#0f0f17]">{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Regional state */}
                  {draw.type === 'regional' && (
                    <div>
                      <label className="block text-white/40 text-xs mb-1">State / Region</label>
                      <div className="flex flex-wrap gap-1.5">
                        {AU_STATES.map(state => (
                          <button key={state} type="button"
                            onClick={() => updateDraw(draw.id, 'region', state)}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                              draw.region === state ? 'bg-white text-black' : 'bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white'
                            }`}>{state}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Entry period */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Period Start</label>
                      <input type="date" value={draw.periodStart || promoStart}
                        onChange={e => updateDraw(draw.id, 'periodStart', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Period End</label>
                      <input type="date" value={draw.periodEnd || promoEnd}
                        onChange={e => updateDraw(draw.id, 'periodEnd', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                    </div>
                  </div>

                  {/* Draw date & time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Draw Date</label>
                      <input type="date" value={draw.drawDate} min={minDrawDate}
                        onChange={e => updateDraw(draw.id, 'drawDate', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-white/40 text-xs mb-1">Draw Time</label>
                      <input type="time" value={draw.drawTime}
                        onChange={e => updateDraw(draw.id, 'drawTime', e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                    </div>
                  </div>

                  {/* Prizes for this draw */}
                  <div>
                    <label className="block text-white/40 text-xs mb-2">Prizes in this draw</label>
                    <div className="space-y-2">
                      {draw.prizes.map((dp, pi) => (
                        <div key={pi} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                          <span className="text-white/40 text-xs font-mono w-8">{dp.tier}</span>
                          <span className="text-white/70 text-sm flex-1">{dp.description}</span>
                          <input type="number" min="1" value={dp.qty}
                            onChange={e => updateDrawPrize(draw.id, pi, 'qty', parseInt(e.target.value) || 1)}
                            className="w-16 bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-1 text-white text-xs focus:outline-none text-center" />
                          <span className="text-white/30 text-xs">winner{dp.qty > 1 ? 's' : ''}</span>
                          {draw.prizes.length > 1 && (
                            <button onClick={() => removeDrawPrize(draw.id, pi)} className="text-white/20 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    {confirmedPrizes.length > draw.prizes.length && (
                      <button onClick={() => addDrawPrize(draw.id)}
                        className="mt-2 text-white/30 hover:text-white/60 text-xs font-semibold transition-colors">
                        + Add prize tier to this draw
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}

          <button onClick={addDraw}
            className="w-full bg-white/[0.02] border border-dashed border-white/[0.10] rounded-xl py-3 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-sm font-semibold">
            + Add another draw
          </button>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-4">
          <div>
            <div className="text-white/40 text-xs">{draws.length} draw{draws.length > 1 ? 's' : ''} · Draw Administration</div>
            <div className={`font-black text-xl ${hasVariation ? 'text-amber-400' : 'text-white'}`}>
              {formatMoney(newDrawFee)}
              {hasVariation && (
                <span className="text-amber-400/60 text-xs font-normal ml-2">(was {formatMoney(originalDrawFee)})</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/[0.08] transition-all">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || draws.some(d => !d.drawDate || !d.drawTime)}
              className={`font-black text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                showVariationWarning
                  ? 'bg-amber-400 text-black hover:bg-amber-300'
                  : 'bg-white text-[#0a0a0f] hover:bg-white/90'
              }`}
            >
              {saving ? 'Saving...' : showVariationWarning ? 'Confirm Variation & Proceed →' : 'Confirm Draw Schedule →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
