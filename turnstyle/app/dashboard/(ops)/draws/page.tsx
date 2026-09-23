export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { DRAW_FILE_STATUS_LABELS, OPS_DOCUMENT_STATUS_LABELS } from '@/lib/ops/constants'
import { getDrawsWithCampaigns } from '@/lib/ops/queries'
import { startOfDay } from '@/lib/ops/status'

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function DrawCalendarPage() {
  const draws = await getDrawsWithCampaigns()
  const now = startOfDay(new Date())
  const weekEnd = new Date(now)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const thisWeek = draws.filter((d) => {
    const dd = startOfDay(d.drawDate)
    return dd >= now && dd <= weekEnd
  })

  const overdue = draws.filter((d) => {
    const dd = startOfDay(d.drawDate)
    return dd < now && d.entryFileStatus !== 'USED_IN_DRAW'
  })

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-black mb-1">Draw Calendar</h1>
      <p className="text-white/40 text-sm mb-8">Pure Random draw obligations across all promotions</p>

      {overdue.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-red-400 mb-3">Overdue draws</h2>
          <DrawList draws={overdue} highlight="overdue" />
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-amber-400 mb-3">Due this week ({thisWeek.length})</h2>
        {thisWeek.length === 0 ? (
          <p className="text-white/30 text-sm">No draws due this week</p>
        ) : (
          <DrawList draws={thisWeek} highlight="due" />
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">All scheduled draws</h2>
        <DrawList draws={draws} />
      </section>
    </div>
  )
}

function DrawList({
  draws,
  highlight,
}: {
  draws: Awaited<ReturnType<typeof getDrawsWithCampaigns>>
  highlight?: 'overdue' | 'due'
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-white/35 border-b border-white/[0.06]">
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Draw</th>
            <th className="px-4 py-2">Promotion</th>
            <th className="px-4 py-2">Client</th>
            <th className="px-4 py-2">Entry file</th>
            <th className="px-4 py-2">Certificate</th>
            <th className="px-4 py-2">Winner notify</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((d) => (
            <tr
              key={d.id}
              className={`border-b border-white/[0.04] ${
                highlight === 'overdue' ? 'bg-red-500/5' : highlight === 'due' ? 'bg-amber-500/5' : ''
              }`}
            >
              <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDate(d.drawDate)} {d.drawTime ?? ''}</td>
              <td className="px-4 py-3 font-medium">{d.drawName}</td>
              <td className="px-4 py-3">
                <Link href={`/dashboard/promotions/${d.campaign.id}`} className="hover:underline text-white/80">
                  {d.campaign.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-white/50 text-xs">{d.campaign.promoter?.name ?? '—'}</td>
              <td className="px-4 py-3 text-xs">{DRAW_FILE_STATUS_LABELS[d.entryFileStatus]}</td>
              <td className="px-4 py-3 text-xs">{d.certificateStatus.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 text-xs">{OPS_DOCUMENT_STATUS_LABELS[d.winnerNotifyStatus] ?? d.winnerNotifyStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
