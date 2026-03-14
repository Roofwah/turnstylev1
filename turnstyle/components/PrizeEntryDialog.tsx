'use client'

import { useState, useEffect } from 'react'

export interface PrizeEntry {
  tier: string
  description: string
  type: string
  qty: number
  unitValue: number
}

const PRIZE_TYPES = [
  { value: 'Motor vehicle', label: 'Motor vehicle' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Voucher', label: 'Voucher' },
  { value: 'Other', label: 'Other' },
]

interface PrizeEntryDialogProps {
  open: boolean
  prizeIndex: number
  prize: PrizeEntry
  onSave: (updated: PrizeEntry) => void
  onClose: () => void
  inputClassName?: string
  labelClassName?: string
}

export default function PrizeEntryDialog({
  open,
  prizeIndex,
  prize,
  onSave,
  onClose,
  inputClassName = 'w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30',
  labelClassName = 'block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5',
}: PrizeEntryDialogProps) {
  const [draft, setDraft] = useState<PrizeEntry>(prize)

  useEffect(() => {
    if (open) setDraft({ ...prize })
  }, [open, prize])

  if (!open) return null

  function handleSave() {
    onSave(draft)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prize-dialog-title"
    >
      {/* Backdrop — fade in */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — scale + fade */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#1a1a2e] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.08]">
          <h2 id="prize-dialog-title" className="text-white font-bold text-lg">
            Prize {prizeIndex + 1}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className={labelClassName}>Description</label>
              <textarea
                value={draft.description}
                onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. $5,000 cash — 30+ words OK for full terms"
                rows={8}
                className={inputClassName + ' resize-y min-h-[180px] py-3'}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClassName}>Type</label>
              <select
                value={draft.type}
                onChange={e => setDraft(prev => ({ ...prev, type: e.target.value }))}
                className={inputClassName + ' py-3'}
              >
                <option value="">Select type</option>
                {PRIZE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClassName}>Qty</label>
                <input
                  type="number"
                  min={1}
                  value={draft.qty}
                  onChange={e => setDraft(prev => ({ ...prev, qty: Number(e.target.value) || 1 }))}
                  className={inputClassName + ' py-3'}
                />
              </div>
              <div>
                <label className={labelClassName}>Value ($)</label>
                <input
                  type="number"
                  min={0}
                  value={draft.unitValue || ''}
                  onChange={e => setDraft(prev => ({ ...prev, unitValue: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  className={inputClassName + ' py-3'}
                />
              </div>
            </div>
            <p className="text-white/40 text-sm">Total: ${(draft.qty * (draft.unitValue || 0)).toLocaleString('en-AU')}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-[#0a0a0f] hover:bg-white/90 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
