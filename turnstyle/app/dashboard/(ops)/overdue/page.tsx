export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { DOCUMENT_TYPES, DRAW_FILE_STATUS_LABELS, OPS_DOCUMENT_STATUS_LABELS } from '@/lib/ops/constants'
import { getOverdueItems } from '@/lib/ops/queries'

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default async function OverduePage() {
  const { documents, draws } = await getOverdueItems()

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-black mb-1">Overdue</h1>
      <p className="text-white/40 text-sm mb-8">
        {documents.length + draws.length} overdue item{documents.length + draws.length !== 1 ? 's' : ''}
      </p>

      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-wider text-red-400 mb-3">Overdue documents</h2>
        {documents.length === 0 ? (
          <p className="text-white/30 text-sm">No overdue documents</p>
        ) : (
          <div className="rounded-xl border border-red-500/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-white/35 border-b border-white/[0.06]">
                  <th className="px-4 py-2">Campaign</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Document</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/promotions/${d.campaignId}`} className="hover:underline">{d.campaignName}</Link>
                    </td>
                    <td className="px-4 py-3 text-white/50">{d.clientName}</td>
                    <td className="px-4 py-3">
                      {DOCUMENT_TYPES.find((t) => t.fileType === d.fileType)?.label ?? d.fileType}
                    </td>
                    <td className="px-4 py-3 text-red-400">{formatDate(d.dueDate)}</td>
                    <td className="px-4 py-3 text-xs">{OPS_DOCUMENT_STATUS_LABELS[d.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-red-400 mb-3">Overdue draw obligations</h2>
        {draws.length === 0 ? (
          <p className="text-white/30 text-sm">No overdue draw obligations</p>
        ) : (
          <div className="rounded-xl border border-red-500/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-white/35 border-b border-white/[0.06]">
                  <th className="px-4 py-2">Campaign</th>
                  <th className="px-4 py-2">Draw</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/promotions/${d.campaignId}`} className="hover:underline">{d.campaignName}</Link>
                    </td>
                    <td className="px-4 py-3">{d.drawName}</td>
                    <td className="px-4 py-3 text-xs capitalize">{d.kind.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-red-400">{formatDate(d.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
