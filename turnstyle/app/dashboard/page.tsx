import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CampaignCard from '@/components/CampaignCard'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Draft',      color: 'text-white/50',    bg: 'bg-white/5' },
  CONFIRMED: { label: 'Confirmed',  color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  COMPILED:  { label: 'Compiled',   color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  REVIEW:    { label: 'In Review',  color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  PENDING:   { label: 'Pending',    color: 'text-orange-400',  bg: 'bg-orange-400/10' },
  SCHEDULED: { label: 'Scheduled',  color: 'text-purple-400',  bg: 'bg-purple-400/10' },
  LIVE:      { label: 'Live',       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  CLOSED:    { label: 'Closed',     color: 'text-white/50',    bg: 'bg-white/5' },
  DRAWN:     { label: 'Drawn',      color: 'text-white/60',    bg: 'bg-white/5' },
  ARCHIVED:  { label: 'Archived',   color: 'text-white/30',    bg: 'bg-white/5' },
  // Legacy fallbacks
  QUOTE_SENT: { label: 'Quote Sent', color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  APPROVED:   { label: 'Approved',   color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
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
      termsDrafts: {
        orderBy: { version: 'desc' },
        include: {
          approvals: true,
        },
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
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
              const hasApprovedQuote = (latestQuote?.status as string) === 'ACCEPTED'
              const statusMap: Record<string, string> = {
                APPROVED: 'CONFIRMED',
                QUOTE_SENT: 'DRAFT',
                ACTIVE: 'LIVE',
              }
              const effectiveStatus = statusMap[campaign.status] ?? campaign.status

              const status = statusConfig[effectiveStatus] ?? statusConfig.DRAFT

              const AU_STATES = ['NSW','VIC','QLD','SA','WA','ACT','TAS','NT']
              const r = campaign.regions
              const regionParts: string[] = []
              if (r.includes('national_au')) regionParts.push('Aust')
              else {
                const s = r.filter((x: string) => AU_STATES.includes(x))
                if (s.length) regionParts.push('Aust: ' + s.join(', '))
              }
              if (r.includes('NZ'))  regionParts.push('NZ')
              if (r.includes('USA')) regionParts.push('USA')
              if (r.includes('EU'))  regionParts.push('EU')
              const regionLabel = regionParts.join(' · ') || '—'

              // Countdown
              const startDays = daysUntil(campaign.promoStart, nowMs)
              const endDays   = daysUntil(campaign.promoEnd, nowMs)
              let countdownLabel: string | null = null
              if (['DRAFT','CONFIRMED','COMPILED','REVIEW','PENDING','SCHEDULED'].includes(campaign.status)) {
                if (startDays !== null && startDays > 0) countdownLabel = `${startDays} days to start`
                else if (startDays === 0) countdownLabel = 'Starts today'
              } else if (campaign.status === 'LIVE') {
                if (endDays !== null && endDays > 0) countdownLabel = `${endDays} days to end`
                else if (endDays === 0) countdownLabel = 'Ends today'
              } else if (campaign.status === 'CLOSED') {
                countdownLabel = 'Awaiting draw'
              }

              // Permit badges
              const prize = Number(campaign.prizePoolTotal)
              const permitStates: string[] = []
              if ((r.includes('national_au') || r.includes('ACT')) && prize > 3500)  permitStates.push('ACT')
              if ((r.includes('national_au') || r.includes('SA'))  && prize > 5000)  permitStates.push('SA')
              if ((r.includes('national_au') || r.includes('NSW')) && prize > 10000) permitStates.push('NSW')

              // Serialize Decimal and Date fields for client component
              const serializedCampaign = {
                ...campaign,
                prizePoolTotal: Number(campaign.prizePoolTotal),
                promoStart: campaign.promoStart?.toISOString() ?? null,
                promoEnd: campaign.promoEnd?.toISOString() ?? null,
                createdAt: campaign.createdAt.toISOString(),
                updatedAt: campaign.updatedAt.toISOString(),
                quotes: campaign.quotes.map((q: any) => ({
                  ...q,
                  termsFee: q.termsFee ? Number(q.termsFee) : null,
                  mgmtFee: q.mgmtFee ? Number(q.mgmtFee) : null,
                  permitFee: q.permitFee ? Number(q.permitFee) : null,
                  drawFee: q.drawFee ? Number(q.drawFee) : null,
                  totalExGst: q.totalExGst ? Number(q.totalExGst) : null,
                  gstAmount: q.gstAmount ? Number(q.gstAmount) : null,
                  totalIncGst: q.totalIncGst ? Number(q.totalIncGst) : null,
                  createdAt: q.createdAt?.toISOString() ?? null,
                  updatedAt: q.updatedAt?.toISOString() ?? null,
                  approvedAt: q.approvedAt?.toISOString() ?? null,
                })),
                termsDrafts: campaign.termsDrafts.map((d: any) => ({
                  ...d,
                  createdAt: d.createdAt?.toISOString() ?? null,
                  updatedAt: d.updatedAt?.toISOString() ?? null,
                  sharedAt: d.sharedAt?.toISOString() ?? null,
                  approvals: d.approvals.map((a: any) => ({
                    ...a,
                    createdAt: a.createdAt?.toISOString() ?? null,
                    updatedAt: a.updatedAt?.toISOString() ?? null,
                  })),
                })),
              }

              return (
                <CampaignCard
                  key={campaign.id}
                  campaign={serializedCampaign}
                  status={status}
                  effectiveStatus={effectiveStatus}
                  hasApprovedQuote={hasApprovedQuote}
                  countdownLabel={countdownLabel}
                  regionLabel={regionLabel}
                  permitStates={permitStates}
                  cta={undefined}
                  prizePoolTotalFormatted={formatMoney(Number(campaign.prizePoolTotal))}
                  promoStartFormatted={formatDate(campaign.promoStart)}
                  promoEndFormatted={formatDate(campaign.promoEnd)}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
