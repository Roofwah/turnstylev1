import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:      { label: 'Draft',      color: 'text-white/50',    bg: 'bg-white/5' },
  QUOTE_SENT: { label: 'Quote Sent', color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  APPROVED:   { label: 'Approved',   color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ACTIVE:     { label: 'Active',     color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  ARCHIVED:   { label: 'Archived',   color: 'text-white/30',    bg: 'bg-white/5' },
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU')
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: Date | null, nowMs: number): number | null {
  if (!d) return null
  const dd = new Date(d)
  const targetMs = Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate())
  return Math.round((targetMs - nowMs) / 86400000)
}

export default async function DashboardPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      promoter: true,
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  const nowMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-8">
          <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
          <div className="hidden md:flex items-center gap-6">
            <span className="text-white text-sm font-semibold">Campaigns</span>
            <span className="text-white/30 text-sm cursor-not-allowed">Templates</span>
            <span className="text-white/30 text-sm cursor-not-allowed">Reports</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-white font-black text-3xl mb-1">Campaigns</h1>
            <p className="text-white/40 text-sm">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/dashboard/new"
            className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            New Campaign
          </Link>
        </div>

        {/* Campaign list */}
        {campaigns.length === 0 ? (
          <div className="bg-white/[0.03] border border-dashed border-white/[0.08] rounded-2xl p-16 text-center">
            <p className="text-white/30 text-sm mb-4">No campaigns yet</p>
            <Link
              href="/dashboard/new"
              className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all inline-block"
            >
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            
            {campaigns.map(campaign => {
  const latestQuote = campaign.quotes[0]
  // Check if quote is approved - if so, campaign should show as APPROVED
  const hasApprovedQuote = latestQuote?.status === 'APPROVED'
  const effectiveStatus = hasApprovedQuote ? 'APPROVED' : campaign.status
  const status = statusConfig[effectiveStatus] ?? statusConfig.DRAFT
  const AU_STATES = ['NSW','VIC','QLD','SA','WA','ACT','TAS','NT']
  const r = campaign.regions
  const regionParts: string[] = []
  if (r.includes('national_au')) regionParts.push('Aust')
  else { const s = r.filter((x: string) => AU_STATES.includes(x)); if (s.length) regionParts.push('Aust: ' + s.join(', ')) }
  if (r.includes('NZ'))  regionParts.push('NZ')
  if (r.includes('USA')) regionParts.push('USA')
  if (r.includes('EU'))  regionParts.push('EU')
  const regionLabel = regionParts.join(' · ') || '—'

  // Countdown
  const startDays = daysUntil(campaign.promoStart, nowMs)
  const endDays   = daysUntil(campaign.promoEnd, nowMs)
  let countdownLabel: string | null = null
  if (['DRAFT','QUOTE_SENT','APPROVED','CONFIRMATION','REVIEW','PENDING','SCHEDULED'].includes(campaign.status)) {
    
    
    if (startDays !== null && startDays > 0) countdownLabel = `${startDays} days to start`
else if (startDays === 0)                countdownLabel = 'Starts today'
} else if (['ACTIVE','LIVE'].includes(campaign.status)) {
if (endDays !== null && endDays > 0) countdownLabel = `${endDays} days to end`
else if (endDays === 0)              countdownLabel = 'Ends today'
  } else if (campaign.status === 'CLOSED') {
    countdownLabel = 'Awaiting draw'
  }

  // Permit badge — ACT > $3,500 · SA > $5,000 · NSW > $10,000
  const prize = Number(campaign.prizePoolTotal)
  const permitStates: string[] = []
  if ((r.includes('national_au') || r.includes('ACT')) && prize > 3500)  permitStates.push('ACT')
  if ((r.includes('national_au') || r.includes('SA'))  && prize > 5000)  permitStates.push('SA')
  if ((r.includes('national_au') || r.includes('NSW')) && prize > 10000) permitStates.push('NSW')

  const ctas: Record<string, { label: string; color: string }> = {
    DRAFT:        { label: 'View & Confirm Quote →',  color: 'text-amber-400' },
    CONFIRMATION: { label: 'View & Confirm Quote →',  color: 'text-amber-400' },
    APPROVED:     { label: 'Quote Approved ✓',        color: 'text-emerald-400' },
    REVIEW:       { label: 'In Review',               color: 'text-blue-400' },
    PENDING:      { label: 'Awaiting Permits',        color: 'text-purple-400' },
    SCHEDULED:    { label: 'Scheduled — Ready',       color: 'text-emerald-400' },
    LIVE:         { label: '🔴 Live Now',             color: 'text-red-400' },
    CLOSED:       { label: 'Closed — Awaiting Draw',  color: 'text-white/40' },
    DRAWN:        { label: 'Drawn — Archiving soon',  color: 'text-white/40' },
    ARCHIVED:     { label: 'Archived',                color: 'text-white/20' },
  }
  // Use effective status (based on quote approval) for CTA
  const cta = ctas[effectiveStatus]

  return (
    <Link
      key={campaign.id}
      href={`/dashboard/${campaign.id}`}
      className="block bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-white/30 text-xs font-mono font-bold">{campaign.tsCode}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
              {status.label}
            </span>
          </div>
          <h2 className="text-white font-bold text-lg leading-tight mb-0.5 group-hover:text-white transition-colors">
            {campaign.name}
          </h2>
          <p className="text-white/40 text-sm">{campaign.promoter?.name ?? '—'}</p>
        </div>
        <div className="text-right shrink-0">
          {latestQuote ? (
            <>
              <div className="text-white font-black text-lg">{formatMoney(Number(latestQuote.totalExGst))}</div>
              <div className="text-white/30 text-xs">excl GST</div>
            </>
          ) : (
            <div className="text-amber-400 text-xs font-bold">View & Confirm Quote →</div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-white/30 text-xs">Prize pool </span>
            <span className="text-white/60 text-xs font-semibold">{formatMoney(Number(campaign.prizePoolTotal))}</span>
          </div>
          <div>
            <span className="text-white/30 text-xs">Dates </span>
            <span className="text-white/60 text-xs font-semibold">
              {formatDate(campaign.promoStart)} → {formatDate(campaign.promoEnd)}
            </span>
          </div>
          {countdownLabel && (
            
            <div className="px-3 py-0.5 rounded-md bg-sky-400/10 border border-sky-400/20">
            <span className="text-sky-400 text-xs font-bold">{countdownLabel}</span>
          </div>
          )}
          <div>
            <span className="text-white/30 text-xs">Regions </span>
            <span className="text-white/60 text-xs font-semibold">{regionLabel}</span>
          </div>
          {permitStates.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-xs">Permits </span>
              {permitStates.map(state => {
  const permitColors: Record<string, string> = {
    ACT: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    SA:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
    NSW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span key={state} className={`text-xs font-bold px-1.5 py-0.5 rounded border ${permitColors[state] ?? 'bg-purple-500/15 text-purple-400 border-purple-500/20'}`}>
      {state}
    </span>
  )
})}
            </div>
          )}
        </div>
        {cta && (
          <span className={`text-xs font-bold ${cta.color}`}>{cta.label}</span>
        )}
      </div>
    </Link>
  )
})}
           
          </div>
        )}
      </main>
    </div>
  )
}
