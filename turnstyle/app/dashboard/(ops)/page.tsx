export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CALCULATED_STATUS_LABELS } from '@/lib/ops/constants'
import { getAllPromotionsWithOps, getDashboardMetrics, toPromotionRow } from '@/lib/ops/queries'

function MetricCard({
  label,
  value,
  href,
  warn,
}: {
  label: string
  value: number
  href?: string
  warn?: boolean
}) {
  const inner = (
    <div
      className={`rounded-xl border p-4 ${warn && value > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-white/[0.08] bg-white/[0.02]'}`}
    >
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${warn && value > 0 ? 'text-red-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const statusColors: Record<string, string> = {
  LIVE: 'text-emerald-400 bg-emerald-400/10',
  DRAW_DUE: 'text-amber-400 bg-amber-400/10',
  DRAW_OVERDUE: 'text-red-400 bg-red-400/10',
  READY_TO_LAUNCH: 'text-purple-400 bg-purple-400/10',
  PERMIT_PENDING: 'text-orange-400 bg-orange-400/10',
  DRAFT: 'text-white/40 bg-white/5',
}

export default async function OpsDashboardPage() {
  const now = new Date()
  const [campaigns, metrics] = await Promise.all([getAllPromotionsWithOps(), getDashboardMetrics(now)])
  const rows = campaigns.map((c) => toPromotionRow(c, now))
  const live = rows.filter((r) => r.calculatedStatus === 'LIVE' || r.campaignStatus === 'LIVE')
  const actionRows = rows.filter((r) => r.overdueWarnings.length > 0).slice(0, 8)

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black mb-1">Promotion Operations</h1>
        <p className="text-white/40 text-sm">Control layer for live promotions — Dropbox holds files, Turnstyle tracks obligations.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Live promotions" value={metrics.livePromotions} href="/dashboard/promotions" />
        <MetricCard label="Draws due this week" value={metrics.drawsDueThisWeek} href="/dashboard/draws" warn />
        <MetricCard label="Overdue actions" value={metrics.overdueActions} href="/dashboard/overdue" warn />
        <MetricCard label="Awaiting invoice" value={metrics.awaitingInvoice} warn />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCard label="Draw files required" value={metrics.drawFilesRequired} href="/dashboard/draws" warn />
        <MetricCard label="Draw files overdue" value={metrics.drawFilesOverdue} href="/dashboard/overdue" warn />
        <MetricCard label="Certificates to generate" value={metrics.certificatesToGenerate} warn />
        <MetricCard label="Certificates not sent" value={metrics.certificatesNotSent} warn />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <MetricCard label="Permit apps pending" value={metrics.permitApplicationsPending} warn />
        <MetricCard label="Permit approvals missing" value={metrics.permitApprovalsMissing} warn />
        <MetricCard label="Invoices not issued" value={metrics.invoicesNotIssued} warn />
        <MetricCard label="Invoices not paid" value={metrics.invoicesNotPaid} warn />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">Live promotions</h2>
            <Link href="/dashboard/promotions" className="text-xs text-white/40 hover:text-white">View all</Link>
          </div>
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            {live.length === 0 ? (
              <p className="p-6 text-sm text-white/30">No live promotions</p>
            ) : (
              live.slice(0, 6).map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/promotions/${r.id}`}
                  className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="font-semibold text-sm">{r.campaignName}</p>
                    <p className="text-xs text-white/40">{r.clientName}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusColors[r.calculatedStatus] ?? statusColors.DRAFT}`}>
                    {CALCULATED_STATUS_LABELS[r.calculatedStatus]}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">Overdue &amp; urgent</h2>
            <Link href="/dashboard/overdue" className="text-xs text-white/40 hover:text-white">View all</Link>
          </div>
          <div className="rounded-xl border border-red-500/20 overflow-hidden">
            {actionRows.length === 0 ? (
              <p className="p-6 text-sm text-white/30">Nothing overdue</p>
            ) : (
              actionRows.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/promotions/${r.id}`}
                  className="block px-4 py-3 border-b border-white/[0.06] last:border-0 hover:bg-red-500/5"
                >
                  <p className="font-semibold text-sm">{r.campaignName}</p>
                  <p className="text-xs text-red-400/80 mt-0.5">{r.overdueWarnings[0]}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">All promotions — next actions</h2>
        </div>
        <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/35 border-b border-white/[0.06]">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/60">{r.clientName}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/promotions/${r.id}`} className="font-medium hover:underline">
                      {r.campaignName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusColors[r.calculatedStatus] ?? statusColors.DRAFT}`}>
                      {CALCULATED_STATUS_LABELS[r.calculatedStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">{r.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
