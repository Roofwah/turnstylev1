'use client'

import { useState, useEffect } from 'react'

interface PrizeTier {
  tier: string
  description: string
  qty: number
  unitValue: number
  type: string
}

interface PrizeWizardModalProps {
  campaignId: string
  existingPrizes: PrizeTier[]
  originalPrizePoolTotal: number
  initialMaxStatePool?: number
  onConfirm: (prizes: PrizeTier[], maxStatePool: number, requiredPermits: string[]) => void
  onClose: () => void
}

const PRIZE_TYPES = ['Motor Vehicle', 'Travel', 'Cash', 'Gift Card', 'Other']

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

function getPermits(maxStatePool: number, totalPool?: number): string[] {
  const pool = totalPool ?? maxStatePool
  const permits: string[] = []
  if (pool >= 3000)           permits.push('ACT')
  if (pool >= 5000)           permits.push('SA')
  if (maxStatePool >= 10000)  permits.push('NSW')
  return permits
}

export default function PrizeWizardModal({
  campaignId,
  existingPrizes,
  originalPrizePoolTotal,
  initialMaxStatePool,
  onConfirm,
  onClose,
}: PrizeWizardModalProps) {
  const [prizes, setPrizes] = useState<PrizeTier[]>(
    existingPrizes.length > 0
      ? existingPrizes.map((p, i) => ({ ...p, tier: String(i + 1), type: (p as any).type ?? '' }))
      : [{ tier: '1', description: '', qty: 1, unitValue: 0, type: '' }]
  )
  const [maxStatePool, setMaxStatePool] = useState<number>(initialMaxStatePool ?? 0)
  const [saving, setSaving] = useState(false)
  const [showVariationWarning, setShowVariationWarning] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const [stateBasedDraws, setStateBasedDraws] = useState<boolean>((initialMaxStatePool ?? 0) > 0)

  const totalPool = prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const hasVariation = Math.abs(totalPool - originalPrizePoolTotal) > 0.01
  const prizesValid = prizes.every(p => p.description && p.qty >= 1 && p.unitValue > 0 && p.type)
  const showStatePoolToggle = prizes.length > 3 && totalPool >= 3000
  const requiredPermits = stateBasedDraws ? getPermits(maxStatePool, totalPool) : []
  const canConfirm = prizesValid && (!stateBasedDraws || maxStatePool > 0)

  function updatePrize(i: number, field: keyof PrizeTier, value: string | number) {
    setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  function addPrize() {
    const tiers = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
    setPrizes(prev => [...prev, { tier: String(prev.length + 1), description: '', qty: 1, unitValue: 0, type: '' }])
  }

  function removePrize(i: number) {
    setPrizes(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, tier: String(idx + 1) })))
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
          confirmedPrizes: prizes,
          prizesConfirmed: true,
          prizes,
          prizePoolTotal: totalPool,
          maxStatePool,
          requiredPermits,
        }),
      })
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
    onConfirm(prizes, maxStatePool, requiredPermits)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#0f0f17] border border-white/[0.10] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-black text-xl">Prize Structure</h2>
              <p className="text-white/40 text-sm mt-0.5">Define all prize tiers for this campaign</p>
            </div>
            <button onClick={addPrize}
              className="ml-2 text-white/30 hover:text-white text-xs font-semibold border border-white/[0.10] hover:border-white/30 rounded-lg px-2.5 py-1 transition-all">
              + Add tier
            </button>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-2xl leading-none">×</button>
        </div>

        {showVariationWarning && (
          <div className="mx-6 mt-4 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 font-bold text-sm">Prize pool has changed</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Original: {formatMoney(originalPrizePoolTotal)} → New: {formatMoney(totalPool)}. This will affect your quote.
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">

          <div className="flex gap-3 px-1 items-end">
            <div className="w-8 text-white/30 text-xs uppercase tracking-widest shrink-0">#</div>
            <div className="flex-1 text-white/30 text-xs uppercase tracking-widest">Description</div>
            <div className="w-28 text-white/30 text-xs uppercase tracking-widest shrink-0">Type</div>
            <div className="w-12 text-white/30 text-xs uppercase tracking-widest shrink-0 text-center">Qty</div>
            <div className="w-28 text-white/30 text-xs uppercase tracking-widest shrink-0">Value</div>
            <div className="w-5 shrink-0" />
          </div>

          {prizes.map((prize, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
              <div className="flex gap-3 items-start">
                <div className="w-8 h-9 flex items-center justify-center text-white/40 text-sm font-black shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <textarea
                    value={prize.description}
                    onChange={e => updatePrize(i, 'description', e.target.value)}
                    placeholder="e.g. 2025 Ford Mustang GT Fastback, valued at $65,000 drive away"
                    rows={1}
                    style={{ resize: 'none', overflow: 'hidden' }}
                    onInput={e => {
                      const el = e.target as HTMLTextAreaElement
                      el.style.height = 'auto'
                      el.style.height = el.scrollHeight + 'px'
                    }}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20 leading-snug"
                  />
                </div>
                <div className="w-28 shrink-0">
                  <select value={prize.type} onChange={e => updatePrize(i, 'type', e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer h-9">
                    <option value="" className="bg-[#0f0f17]">Type…</option>
                    {PRIZE_TYPES.map(t => <option key={t} value={t} className="bg-[#0f0f17]">{t}</option>)}
                  </select>
                </div>
                <div className="w-12 shrink-0">
                  <input type="number" min="1" value={prize.qty}
                    onChange={e => updatePrize(i, 'qty', parseInt(e.target.value) || 1)}
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-white/30 text-center h-9" />
                </div>
                <div className="w-28 shrink-0">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                    <input type="number" min="0" value={prize.unitValue || ''}
                      onChange={e => updatePrize(i, 'unitValue', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg pl-6 pr-2 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20 h-9" />
                  </div>
                </div>
                <div className="w-5 shrink-0 flex items-center justify-center h-9">
                  {prizes.length > 1 && (
                    <button onClick={() => removePrize(i)} className="text-white/20 hover:text-red-400 transition-colors text-xl leading-none">×</button>
                  )}
                </div>
              </div>
              {prize.qty > 0 && prize.unitValue > 0 && (
                <div className="text-white/30 text-xs pl-11">
                  Subtotal: {formatMoney(prize.qty * prize.unitValue)}
                </div>
              )}
            </div>
          ))}

          {showStatePoolToggle && (
            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setStateBasedDraws(prev => !prev)
                  if (stateBasedDraws) setMaxStatePool(0)
                }}
                className="flex items-center gap-3 group"
              >
                <div className={`w-10 h-5 rounded-full transition-all relative ${stateBasedDraws ? 'bg-white' : 'bg-white/[0.10] border border-white/[0.15]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${stateBasedDraws ? 'bg-[#0f0f17] left-5' : 'bg-white/30 left-0.5'}`} />
                </div>
                <span className={`text-sm font-semibold transition-colors ${stateBasedDraws ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                  State based draws
                </span>
              </button>

              {stateBasedDraws && (
                <div className="space-y-2 pl-1">
                  <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest">
                    Maximum prize pool available per state
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">$</span>
                    <input type="number" min="0" value={maxStatePool || ''}
                      onChange={e => setMaxStatePool(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl pl-8 pr-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-white/30 placeholder-white/20" />
                  </div>
                  {maxStatePool > 0 && requiredPermits.length > 0 && (
                    <p className="text-amber-400 font-bold text-sm">Permits required: {requiredPermits.join(' · ')}</p>
                  )}
                  {maxStatePool > 0 && requiredPermits.length === 0 && (
                    <p className="text-emerald-400 font-bold text-sm">No permits required</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-white/40 text-xs">Total Prize Pool</div>
            <div className={`font-black text-xl ${hasVariation ? 'text-amber-400' : 'text-white'}`}>
              {formatMoney(totalPool)}
              {hasVariation && <span className="text-amber-400/60 text-xs font-normal ml-2">(was {formatMoney(originalPrizePoolTotal)})</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/[0.08] transition-all">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={saving || !canConfirm}
              className={`font-black text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                showVariationWarning ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white text-[#0a0a0f] hover:bg-white/90'
              }`}>
              {saving ? 'Saving...' : showVariationWarning ? 'Confirm & Save →' : 'Confirm Prizes →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
