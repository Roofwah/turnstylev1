export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CALCULATED_STATUS_LABELS } from '@/lib/ops/constants'
import { getAllPromotionsWithOps, toPromotionRow } from '@/lib/ops/queries'

const statusColors: Record<string, string> = {
  LIVE: 'text-emerald-400',
  DRAW_DUE: 'text-amber-400',
  DRAW_OVERDUE: 'text-red-400',
  READY_TO_LAUNCH: 'text-purple-400',
  PERMIT_PENDING: 'text-orange-400',
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default async function PromotionsPage() {
  const campaigns = await getAllPromotionsWithOps()
  const rows = campaigns.map((c) => toPromotionRow(c))

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black mb-1">Promotions</h1>
          <p className="text-white/40 text-sm">{rows.length} promotion{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/new"
          className="bg-white text-[#0a0a0f] font-bold text-sm px-4 py-2 rounded-lg hover:bg-white/90"
        >
          + New Campaign
        </Link>
      </div>

      <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/35 border-b border-white/[0.06]">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Terms</th>
              <th className="px-4 py-3">Permits</th>
              <th className="px-4 py-3">Draws</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white/60">{r.clientName}</td>
                <td className="px-4 py-3 font-medium">{r.campaignName}</td>
                <td className={`px-4 py-3 text-xs font-bold uppercase ${statusColors[r.calculatedStatus] ?? 'text-white/40'}`}>
                  {CALCULATED_STATUS_LABELS[r.calculatedStatus]}
                  {r.overdueWarnings.length > 0 && (
                    <span className="ml-1 text-red-400" title={r.overdueWarnings.join(', ')}>!</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">{formatDate(r.startDate)}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{formatDate(r.endDate)}</td>
                <td className="px-4 py-3 text-xs text-white/50">{r.invoiceStatus.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-white/50">{r.termsStatus}</td>
                <td className="px-4 py-3 text-xs text-white/50">{r.permitStatus}</td>
                <td className="px-4 py-3 text-xs text-white/50">{r.drawStatus}</td>
                <td className="px-4 py-3 text-xs text-white/60 max-w-[180px] truncate">{r.nextAction}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/promotions/${r.id}`} className="text-xs text-white/40 hover:text-white">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
