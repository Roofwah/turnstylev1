'use client'

import { useState } from 'react'
import { calculateQuote, calcDrawFee, calcPermitFee, calcTermsFee, calcMgmtFee } from '@/lib/quote-engine'

const MECHANIC_OPTIONS = [
    { value: 'Sweepstakes', label: 'Sweepstakes' },
    { value: 'Instant Win', label: 'Instant Win' },
    { value: 'Limited Offer', label: 'Limited Offer' },
    { value: 'Game of Skill', label: 'Game of Skill' },
    { value: 'Other', label: 'Other' },
    { value: 'Draw Only', label: 'Draw Only' },
  ]

const FREQUENCY_OPTIONS = [
  { value: 'at_conclusion', label: 'At Conclusion' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
]

function fmt(n: number) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0 })
}

export default function QuoteTestPage() {
  const [mechanic, setMechanic] = useState('Sweepstakes')
  const [frequency, setFrequency] = useState('at_conclusion')
  const [prizePool, setPrizePool] = useState(10000)
  const [start, setStart] = useState('2026-04-01')
  const [end, setEnd] = useState('2026-06-30')

  const quote = calculateQuote({
    campaignId: 'test',
    tsCode: 'TESTX',
    campaignName: 'Test Campaign',
    promoStart: start,
    promoEnd: end,
    drawMechanic: mechanic,
    drawFrequency: frequency,
    prizes: [{ tier: '1st', description: 'Prize', qty: 1, unitValue: prizePool }],
  })

  // Draw only quote
  const doDrawFee = calcDrawFee(1)
  const doMgmt = 100
  const doTotal = doDrawFee + doMgmt
  const doGst = Math.round(doTotal * 0.1 * 100) / 100

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-black mb-2">Quote Engine Test</h1>
        <p className="text-white/40 text-sm mb-8">Test all promotion types and see how fees are calculated.</p>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest">Inputs</h2>

            <div>
              <label className="block text-white/40 text-xs mb-1">Promotion Type</label>
              <select value={mechanic} onChange={e => setMechanic(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm">
                {MECHANIC_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-white/40 text-xs mb-1">Draw Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm">
                {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-white/40 text-xs mb-1">Prize Pool ($)</label>
              <input type="number" value={prizePool} onChange={e => setPrizePool(Number(e.target.value))}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/40 text-xs mb-1">Start Date</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1">End Date</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm" />
              </div>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest">Fee Breakdown</h2>
            <div className="space-y-2">
              {quote.lines.map((line, i) => (
                <div key={i} className="flex justify-between items-start">
                  <div>
                    <p className="text-white/80 text-sm">{line.label}</p>
                    <p className="text-white/30 text-xs">{line.note}</p>
                  </div>
                  <span className={`text-sm font-bold ml-4 shrink-0 ${line.amount === 0 ? 'text-white/20' : 'text-white'}`}>
                    {fmt(line.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] pt-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-white/40 text-sm">Total ex GST</span>
                <span className="text-white font-black">{fmt(quote.totalExGst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/30 text-sm">GST</span>
                <span className="text-white/50 text-sm">{fmt(quote.gstAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40 text-sm">Total incl GST</span>
                <span className="text-emerald-400 font-black">{fmt(quote.totalIncGst)}</span>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-white/30 text-xs">Draw count: {quote.drawCount} · Quote: {quote.quoteNumber}</p>
            </div>
          </div>
        </div>

        {/* Draw Only comparison */}
        <div className="bg-sky-400/5 border border-sky-400/20 rounded-2xl p-6 mb-8">
          <h2 className="text-sky-400 text-xs font-semibold uppercase tracking-widest mb-4">Draw Only Quote (always fixed)</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-white/40 text-xs mb-1">Campaign Management</p>
              <p className="text-white font-bold">{fmt(doMgmt)}</p>
              <p className="text-white/20 text-xs">Draw Only flat fee</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Draw Administration</p>
              <p className="text-white font-bold">{fmt(doDrawFee)}</p>
              <p className="text-white/20 text-xs">1 draw</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Total incl GST</p>
              <p className="text-emerald-400 font-black">{fmt(doTotal + doGst)}</p>
              <p className="text-white/20 text-xs">No terms · No permits</p>
            </div>
          </div>
        </div>

        {/* Permit threshold reference */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8">
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Permit Fee Reference</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { range: 'Under $3,000', fee: 0 },
              { range: '$3,000 – $4,999', fee: 275 },
              { range: '$5,000 – $9,999', fee: 675 },
              { range: '$10,000 – $49,999', fee: 2365 },
              { range: '$50,000 – $99,999', fee: 3505 },
              { range: '$100,000 – $199,999', fee: 6375 },
              { range: '$200,000+', fee: 11305 },
            ].map(r => (
              <div key={r.range} className={`flex justify-between px-3 py-2 rounded-lg ${prizePool >= parseInt(r.range.replace(/[^0-9]/g, '').slice(0,6) || '0') ? 'bg-white/[0.05]' : ''}`}>
                <span className="text-white/50">{r.range}</span>
                <span className={`font-bold ${r.fee === 0 ? 'text-emerald-400' : 'text-white'}`}>{fmt(r.fee)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Draw fee reference */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Draw Administration Fee Reference</h2>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {[1,2,3,4,5,6,8,10,12,15,20,26,52].map(n => (
              <div key={n} className={`flex justify-between px-3 py-2 rounded-lg ${quote.drawCount === n ? 'bg-white/10 border border-white/20' : ''}`}>
                <span className="text-white/50">{n} draw{n > 1 ? 's' : ''}</span>
                <span className="text-white font-bold">{fmt(calcDrawFee(n))}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
