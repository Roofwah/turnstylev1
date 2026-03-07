'use client'

import { useState, useEffect } from 'react'

interface PrizeTier {
  tier: string
  description: string
  qty: number
  unitValue: number
}

interface PrizeWizardModalProps {
  campaignId: string
  existingPrizes: PrizeTier[]
  originalPrizePoolTotal: number
  onConfirm: (prizes: PrizeTier[]) => void
  onClose: () => void
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

export default function PrizeWizardModal({
  campaignId,
  existingPrizes,
  originalPrizePoolTotal,
  onConfirm,
  onClose,
}: PrizeWizardModalProps) {
  const [prizes, setPrizes] = useState<PrizeTier[]>(
    existingPrizes.length > 0
      ? existingPrizes.map(p => ({ ...p }))
      : [{ tier: '1st', description: '', qty: 1, unitValue: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [showVariationWarning, setShowVariationWarning] = useState(false)

  const newPrizePoolTotal = prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const hasVariation = Math.abs(newPrizePoolTotal - originalPrizePoolTotal) > 0.01

  function updatePrize(i: number, field: keyof PrizeTier, value: string | number) {
    setPrizes(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  function addPrize() {
    const tiers = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
    setPrizes(prev => [...prev, { tier: tiers[prev.length] ?? '', description: '', qty: 1, unitValue: 0 }])
  }

  function removePrize(i: number) {
    setPrizes(prev => prev.filter((_, idx) => idx !== i))
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
          prizes: prizes,
          prizePoolTotal: newPrizePoolTotal,
        }),
      })
      onConfirm(prizes)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0f0f17] border border-white/[0.10] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-black text-xl">Prize Wizard</h2>
            <p className="text-white/40 text-sm mt-0.5">Confirm the prize structure for this campaign</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-2xl leading-none">×</button>
        </div>

        {/* Variation warning */}
        {showVariationWarning && (
          <div className="mx-6 mt-4 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 font-bold text-sm">Prize pool has changed</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Original: {formatMoney(originalPrizePoolTotal)} → New: {formatMoney(newPrizePoolTotal)}. 
                This may affect your quote. Confirm to proceed.
              </p>
            </div>
          </div>
        )}

        {/* Prize list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-1">
            <div className="col-span-1 text-white/30 text-xs uppercase tracking-widest">Tier</div>
            <div className="col-span-5 text-white/30 text-xs uppercase tracking-widest">Description</div>
            <div className="col-span-2 text-white/30 text-xs uppercase tracking-widest">Qty</div>
            <div className="col-span-3 text-white/30 text-xs uppercase tracking-widest">Unit Value</div>
            <div className="col-span-1" />
          </div>

          {prizes.map((prize, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="col-span-1">
                <input
                  value={prize.tier}
                  onChange={e => updatePrize(i, 'tier', e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-2 py-1.5 text-white text-xs font-bold text-center focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="col-span-5">
                <input
                  value={prize.description}
                  onChange={e => updatePrize(i, 'description', e.target.value)}
                  placeholder="e.g. Ford Mustang GT"
                  className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="1"
                  value={prize.qty}
                  onChange={e => updatePrize(i, 'qty', parseInt(e.target.value) || 1)}
                  className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={prize.unitValue || ''}
                    onChange={e => updatePrize(i, 'unitValue', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg pl-7 pr-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                  />
                </div>
              </div>
              <div className="col-span-1 flex justify-center">
                {prizes.length > 1 && (
                  <button onClick={() => removePrize(i)} className="text-white/20 hover:text-red-400 transition-colors text-xl leading-none">×</button>
                )}
              </div>
              {prize.qty > 0 && prize.unitValue > 0 && (
                <div className="col-span-12 text-white/30 text-xs px-1">
                  Subtotal: {formatMoney(prize.qty * prize.unitValue)}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addPrize}
            className="w-full bg-white/[0.02] border border-dashed border-white/[0.10] rounded-xl py-3 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-sm font-semibold"
          >
            + Add prize tier
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-4">
          <div>
            <div className="text-white/40 text-xs">Total Prize Pool</div>
            <div className={`font-black text-xl ${hasVariation ? 'text-amber-400' : 'text-white'}`}>
              {formatMoney(newPrizePoolTotal)}
              {hasVariation && (
                <span className="text-amber-400/60 text-xs font-normal ml-2">
                  (was {formatMoney(originalPrizePoolTotal)})
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/[0.08] transition-all">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || prizes.some(p => !p.description || p.qty < 1 || p.unitValue <= 0)}
              className={`font-black text-sm px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                showVariationWarning
                  ? 'bg-amber-400 text-black hover:bg-amber-300'
                  : 'bg-white text-[#0a0a0f] hover:bg-white/90'
              }`}
            >
              {saving ? 'Saving...' : showVariationWarning ? 'Confirm Variation & Proceed →' : 'Confirm Prizes →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
