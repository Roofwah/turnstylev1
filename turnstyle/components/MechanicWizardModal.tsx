'use client'

import { useState, useEffect } from 'react'

export interface MechanicDetails {
  entryMechanic: string
  purchaseValue: string
  gstType: 'excl' | 'incl'
  participatingBrand: string
  website: string
  additionalEntryValue: string
  additionalEntryGst: 'excl' | 'incl'
}

interface MechanicWizardModalProps {
  entryMechanic: string
  initialDetails?: Partial<MechanicDetails>
  onConfirm: (details: MechanicDetails) => void
  onClose: () => void
}

const PURCHASE_MECHANICS = [
  'Account Based Purchases',
  'Purchase & Show Loyalty Card',
  'Online - Purchase Required',
]

const ONLINE_MECHANICS = [
  'Online - Purchase Required',
  'Online - No Purchase',
]

export default function MechanicWizardModal({
  entryMechanic,
  initialDetails,
  onConfirm,
  onClose,
}: MechanicWizardModalProps) {
  const [purchaseValue, setPurchaseValue] = useState(initialDetails?.purchaseValue ?? '')
  const [gstType, setGstType] = useState<'excl' | 'incl'>(initialDetails?.gstType ?? 'excl')
  const [participatingBrand, setParticipatingBrand] = useState(initialDetails?.participatingBrand ?? '')
  const [website, setWebsite] = useState(initialDetails?.website ?? '')
  const [additionalEntryValue, setAdditionalEntryValue] = useState(initialDetails?.additionalEntryValue ?? '')
  const [additionalEntryGst, setAdditionalEntryGst] = useState<'excl' | 'incl'>(initialDetails?.additionalEntryGst ?? 'excl')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isPurchaseMechanic = PURCHASE_MECHANICS.includes(entryMechanic)
  const isOnline = ONLINE_MECHANICS.includes(entryMechanic)
  const isAccountBased = entryMechanic === 'Account Based Purchases'
  const isNoPurchase = entryMechanic === 'Online - No Purchase'

  const canConfirm = isNoPurchase
    ? (!isOnline || website.trim().length > 0)
    : (purchaseValue.trim().length > 0 && participatingBrand.trim().length > 0 && (!isOnline || website.trim().length > 0))

  function handleConfirm() {
    onConfirm({
      entryMechanic,
      purchaseValue,
      gstType,
      participatingBrand,
      website,
      additionalEntryValue,
      additionalEntryGst,
    })
  }

  const previewSentence = isNoPurchase
    ? 'No purchase necessary to enter.'
    : purchaseValue && participatingBrand
      ? 'Purchase $' + purchaseValue + ' (' + gstType + '. GST) of any ' + participatingBrand + ' product.'
      : ''

  const additionalPreview = isAccountBased && additionalEntryValue
    ? 'Additional entries: subsequent purchase of $' + additionalEntryValue + ' (' + additionalEntryGst + '. GST).'
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-[#0f0f17] border border-white/[0.10] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-black text-xl">Entry Method</h2>
            <p className="text-white/40 text-sm mt-0.5">{entryMechanic}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-2xl leading-none">x</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Purchase details */}
          {isPurchaseMechanic && (
            <div>
              <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">How does a participant enter?</label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white/50 text-sm">Purchase</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number" min="0"
                    value={purchaseValue}
                    onChange={e => setPurchaseValue(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg pl-6 pr-2 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                  />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-white/[0.10]">
                  {(['excl', 'incl'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setGstType(g)}
                      className={'px-3 py-2 text-xs font-bold transition-all ' + (gstType === g ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:text-white')}>
                      {g}. GST
                    </button>
                  ))}
                </div>
                <span className="text-white/50 text-sm">of any</span>
                <input
                  type="text"
                  value={participatingBrand}
                  onChange={e => setParticipatingBrand(e.target.value)}
                  placeholder="Participating brand"
                  className="flex-1 min-w-32 bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                />
              </div>
            </div>
          )}

          {/* Website */}
          {(isOnline || isNoPurchase) && (
            <div>
              <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">Website</label>
              <input
                type="text"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://www.example.com.au"
                className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
              />
            </div>
          )}

          {/* Additional entries — account based only */}
          {isAccountBased && (
            <div>
              <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Additional entries</label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white/50 text-sm">Subsequent purchase of</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number" min="0"
                    value={additionalEntryValue}
                    onChange={e => setAdditionalEntryValue(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/[0.06] border border-white/[0.10] rounded-lg pl-6 pr-2 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                  />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-white/[0.10]">
                  {(['excl', 'incl'] as const).map(g => (
                    <button key={g} type="button" onClick={() => setAdditionalEntryGst(g)}
                      className={'px-3 py-2 text-xs font-bold transition-all ' + (additionalEntryGst === g ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:text-white')}>
                      {g}. GST
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {(previewSentence || additionalPreview) && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 space-y-1">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2">Preview</p>
              {previewSentence && <p className="text-white/70 text-sm">{previewSentence}</p>}
              {additionalPreview && <p className="text-white/50 text-sm">{additionalPreview}</p>}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="bg-white/[0.05] border border-white/[0.10] text-white/60 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/[0.08] transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!canConfirm}
            className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Confirm Entry Method
          </button>
        </div>

      </div>
    </div>
  )
}
