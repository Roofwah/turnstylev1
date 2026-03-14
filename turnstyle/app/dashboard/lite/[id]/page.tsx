'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { getCampaign } from '@/app/actions/getCampaign'

function formatLongDate(yyyyMmDd: string): string {
  if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd
  const d = new Date(yyyyMmDd + 'T12:00:00')
  if (isNaN(d.getTime())) return yyyyMmDd
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' })
  const day = d.getDate()
  const n = day % 100
  const suffix = n >= 11 && n <= 13 ? 'th' : (day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th')
  const month = d.toLocaleDateString('en-AU', { month: 'long' })
  const year = d.getFullYear()
  return `${weekday} ${day}${suffix} ${month} ${year}`
}

function firstName(contactName: string | null): string {
  if (!contactName || !contactName.trim()) return 'There'
  const first = contactName.trim().split(/\s+/)[0]
  return first || 'There'
}

function mechanicLabel(mechanicType: string): string {
  const map: Record<string, string> = {
    SWEEPSTAKES: 'Sweepstakes',
    INSTANT_WIN: 'Instant Win',
    LIMITED_OFFER: 'Limited Offer',
    GAME_OF_SKILL: 'Game of Skill',
    DRAW_ONLY: 'Draw Only',
    OTHER: 'Other',
  }
  return map[mechanicType] ?? mechanicType ?? '—'
}

function promoLabel(c: any): string {
  if (c.mechanicType === 'DRAW_ONLY' && Array.isArray(c.drawSchedule) && c.drawSchedule.length > 0) {
    return c.drawSchedule.length === 1
      ? `1 draw: ${formatLongDate(c.drawSchedule[0].drawDate ?? '')}`
      : `${c.drawSchedule.length} draws`
  }
  const start = c.promoStart ? new Date(c.promoStart).toISOString().split('T')[0] : ''
  const end = c.promoEnd ? new Date(c.promoEnd).toISOString().split('T')[0] : ''
  return start && end ? `${start} → ${end}` : (start || end || '—')
}

function CommandCentreLiteInner() {
  const params = useParams()
  const id = params.id as string
  const searchParams = useSearchParams()
  const created = searchParams.get('created') === '1'

  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    getCampaign(id).then(raw => {
      if (raw) setCampaign(raw)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (campaign && created) setShowSuccessModal(true)
  }, [campaign, created])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white/50">Loading…</p>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white/50">Campaign not found.</p>
        <Link href="/dashboard" className="ml-4 text-white/70 hover:text-white text-sm">← Dashboard</Link>
      </div>
    )
  }

  const quoteNumber = campaign.quotes?.[0]?.quoteNumber ?? campaign.tsCode ?? '—'
  const contactName = campaign.promoter?.contactName ?? null
  const isDrawOnly = campaign.mechanicType === 'DRAW_ONLY'
  const status = campaign.status ?? 'DRAFT'

  const hasConfirmed = status === 'CONFIRMED' || status === 'COMPILED' || status === 'APPROVED'
  const hasCompiled = status === 'COMPILED'

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Success modal (full screen) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/[0.12] rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-white font-bold text-xl mb-4">
              {firstName(contactName)}, we have prepared your quote
            </h2>
            <p className="text-white/80 text-sm mb-2">
              <span className="text-white font-mono font-bold">#{quoteNumber}</span>
            </p>
            <p className="text-white/60 text-sm mb-6">
              You can view and download it below. A copy has been sent to your email address.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/dashboard/${id}?tab=quote`}
                className="inline-flex items-center justify-center bg-white text-[#0a0a0f] font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all"
              >
                Show Quote
              </Link>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="inline-flex items-center justify-center bg-white/[0.1] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-white/[0.15] transition-all border border-white/[0.12]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm">← Dashboard</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold truncate max-w-[200px]">{campaign.name}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Status strip: Confirmed · Compiled */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-semibold ${hasConfirmed ? 'text-white' : 'text-white/30'}`}>Confirmed</span>
          <span className="text-white/20">·</span>
          <span className={`text-sm font-semibold ${hasCompiled ? 'text-white' : 'text-white/30'}`}>Compiled</span>
        </div>
        <div className="flex gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full ${hasConfirmed ? 'bg-white/80' : 'bg-white/[0.08]'}`} />
          <div className={`h-1 flex-1 rounded-full ${hasCompiled ? 'bg-white/80' : 'bg-white/[0.08]'}`} />
        </div>

        <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Campaign Summary</h2>
        <div className="bg-white/[0.04] border border-white/[0.12] rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <div>
              <span className="text-white/40">Campaign name</span>
              <p className="text-white font-medium">{campaign.name ?? '—'}</p>
            </div>
            <div>
              <span className="text-white/40">Promoter</span>
              <p className="text-white font-medium">{campaign.promoter?.name ?? '—'}</p>
            </div>
            <div>
              <span className="text-white/40">Promotion type</span>
              <p className="text-white font-medium">{mechanicLabel(campaign.mechanicType)}</p>
            </div>
            <div>
              <span className="text-white/40">Dates / period</span>
              <p className="text-white font-medium">{promoLabel(campaign)}</p>
            </div>
            <div>
              <span className="text-white/40">Structure</span>
              <p className="text-white font-medium">{isDrawOnly ? 'As per schedule' : 'At Conclusion'}</p>
            </div>
            <div>
              <span className="text-white/40">Regions</span>
              <p className="text-white font-medium">{isDrawOnly ? 'As per terms' : (campaign.regions?.includes('national_au') ? 'National' : (campaign.regions?.join(', ') || '—'))}</p>
            </div>
            <div>
              <span className="text-white/40">Total draws</span>
              <p className="text-white font-medium">
                {isDrawOnly && Array.isArray(campaign.drawSchedule)
                  ? `${campaign.drawSchedule.length} draw${campaign.drawSchedule.length !== 1 ? 's' : ''}`
                  : '—'}
              </p>
            </div>
            {!isDrawOnly && (
              <div>
                <span className="text-white/40">Prize pool</span>
                <p className="text-white font-medium">${Number(campaign.prizePoolTotal || 0).toLocaleString('en-AU')}</p>
              </div>
            )}
          </div>

          {/* Draw schedule (Draw Only) */}
          {isDrawOnly && Array.isArray(campaign.drawSchedule) && campaign.drawSchedule.length > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.08]">
              <span className="text-white/40 text-xs font-semibold uppercase tracking-wider block mb-1.5">Draw schedule</span>
              <ul className="space-y-1 text-sm">
                {campaign.drawSchedule.map((d: any, i: number) => (
                  <li key={i} className="text-white/80 flex flex-wrap gap-x-3 gap-y-0">
                    <span>{formatLongDate(d.drawDate ?? '')}</span>
                    <span className="text-white/50">{d.drawTime ?? '—'}</span>
                    <span className="text-white/50">{d.winners ?? 1} winner{(d.winners ?? 1) !== 1 ? 's' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8">
          <Link
            href={`/dashboard/${id}/terms-wizard`}
            className="inline-flex items-center justify-center w-full sm:w-auto bg-white text-[#0a0a0f] font-black text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all"
          >
            Start Terms Builder
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-6">After create you’ll land on the campaign page → Quote → Download → Approve & build terms.</p>
      </main>
    </div>
  )
}

export default function CommandCentreLitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><p className="text-white/50">Loading…</p></div>}>
      <CommandCentreLiteInner />
    </Suspense>
  )
}
