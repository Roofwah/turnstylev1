'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function LOAPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [customName, setCustomName] = useState('')
  const [signed, setSigned] = useState(false)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(data => { setCampaign(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [campaignId])



  const toProperCase = (str: string) =>
    str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())

  const handleSign = () => {
    if (!customName && !promoter?.contactName) return
    setSigned(true)
    const now = new Date()
    const timestamp = now.toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric',
    }) + ' ' + now.toLocaleTimeString('en-AU', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney'
    }) + ' AEST'
    setSignedAt(timestamp)
  }
  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading...</div>
      </div>
    )
  }

  const promoter = campaign?.promoter
  const rawName = customName || promoter?.contactName || '[Contact Name]'
  const signerName = rawName === '[Contact Name]' ? rawName : toProperCase(rawName)

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');

        @media print {
          nav, .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="no-print border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href={`/dashboard/${campaignId}`} className="text-white/40 hover:text-white text-sm transition-colors">
              {campaign?.name ?? 'Campaign'}
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Letter of Authority</span>
          </div>
          <button
            onClick={handlePrint}
            className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2 rounded-xl hover:bg-white/90 transition-all">
            Save as PDF →
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Name input */}
        <div className="no-print mb-6">
          <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">
            Authorised Person Name
          </label>
          <input
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={promoter?.contactName || 'Enter authorised person name'}
            className="w-full max-w-sm bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/40 transition-all"
          />
        <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSign}
              disabled={signed || (!customName && !promoter?.contactName)}
              className={`text-xs font-black px-4 py-2 rounded-lg transition-all ${
                signed
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 cursor-default'
                  : 'bg-white text-[#0a0a0f] hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}>
              {signed ? '✓ Signed' : 'Sign'}
            </button>
            {signed && signedAt && (
              <span className="text-emerald-400/60 text-xs">{signedAt}</span>
            )}
          </div>
          <p className="text-white/20 text-xs mt-2">Typing your name and clicking Sign acts as your authorisation.</p>
        
        </div>

        {/* Document */}
        <div ref={printRef} className="print-area bg-white rounded-2xl shadow-xl p-12 text-gray-900">

          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Letter of Authority</div>
              <div className="text-gray-900 font-black text-2xl">Trade Promotion Permit Application</div>
            </div>
            <div className="text-right text-sm text-gray-400">
              <div>{today}</div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-5 text-sm leading-relaxed text-gray-700">
            <p>To Whom It May Concern,</p>
            <p>
              I, <strong>{signerName}</strong>, acting in my capacity as an authorised representative of{' '}
              <strong>{promoter?.name || '[Company Name]'}</strong> (ABN: {promoter?.abn || '[ABN]'}),
              hereby authorise <strong>Flow Marketing Pty Ltd</strong> to act as our agent in relation to the
              trade promotion permit application for the following promotion:
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">Promotion Name</div>
                <div className="font-semibold">{campaign?.name}</div>
              </div>
            </div>

            <p>
              Flow Marketing Pty Ltd is authorised to submit permit applications, liaise with
              relevant state authorities and gaming regulators as applicable, and act on our behalf
              in all matters relating to this promotion.
            </p>
            <p>
              This authority is valid for the duration of the promotion and any related permit application process.
            </p>
          </div>

          {/* Signature block */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <div
style={{ fontFamily: "'Pinyon Script', cursive", fontSize: '1.8rem', lineHeight: 1.2, color: '#1a1a2e' }}
 >
                  {signerName}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <div className="text-gray-900 font-semibold text-sm">{signerName}</div>
                  <div className="text-gray-400 text-xs">Authorised Representative</div>
                  <div className="text-gray-400 text-xs">{promoter?.name}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Date Signed</div>
                <div className="text-gray-900 font-semibold">{signedAt || '—'}</div>
                {!signed && (
                  <div className="text-gray-400 text-xs mt-1">Please sign to confirm date</div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-300 flex justify-between">
            <span>Turnstyle — Trade Promotion Management</span>
            <span>turnstylehost.com</span>
          </div>

        </div>
      </main>
    </div>
  )
}