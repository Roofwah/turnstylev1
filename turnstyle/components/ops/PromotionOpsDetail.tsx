'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  updatePromotionDocument,
  updatePromotionDraw,
  updatePromotionDropbox,
  updatePromotionInvoiceStatus,
  updatePromotionOpsNotes,
} from '@/app/actions/ops'
import {
  CALCULATED_STATUS_LABELS,
  CERTIFICATE_STATUS_LABELS,
  DOCUMENT_TYPES,
  DRAW_FILE_STATUS_LABELS,
  OPS_DOCUMENT_STATUS_LABELS,
} from '@/lib/ops/constants'
import { getFolderStructureForDisplay } from '@/lib/ops/dropbox'
import type { LaunchReadinessCheck } from '@/lib/ops/types'

type Doc = {
  id: string
  fileType: string
  required: boolean
  status: string
  dueDate: string | null
  dropboxFileUrl: string | null
  notes: string | null
  folderLabel: string | null
}

type Draw = {
  id: string
  drawName: string
  drawNumber: number
  drawDate: string
  drawTime: string | null
  drawLocation: string | null
  entryPeriodStart: string | null
  entryPeriodEnd: string | null
  entryFileRequired: boolean
  entryFileStatus: string
  entryFileDropboxUrl: string | null
  purerandomDrawStatus: string | null
  certificateStatus: string
  certificateDropboxUrl: string | null
  winnerNotifyDue: string | null
  winnerNotifyStatus: string
  publicationRequired: boolean
  publicationDue: string | null
  publicationStatus: string
  permitReference: string | null
  notes: string | null
}

type Props = {
  campaign: {
    id: string
    tsCode: string
    name: string
    status: string
    mechanicType: string
    promoStart: string | null
    promoEnd: string | null
    prizePoolTotal: number
    dropboxFolderUrl: string | null
    intakeSummary: string | null
    preflightScore: number | null
    invoiceOpsStatus: string
    opsNotes: string | null
    permitNSW: string | null
    permitSA: string | null
    permitACT: string | null
    requiredPermits: string[]
    promoter: { name: string } | null
  }
  calculatedStatus: string
  launchReadiness: LaunchReadinessCheck
  nextAction: string
  termsStatus: string
  documents: Doc[]
  draws: Draw[]
}

const TABS = ['Overview', 'Intake', 'Preflight', 'Documents', 'Permits', 'Draws', 'Notes'] as const

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PromotionOpsDetail({
  campaign,
  calculatedStatus,
  launchReadiness,
  nextAction,
  termsStatus,
  documents,
  draws,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  const [dropboxUrl, setDropboxUrl] = useState(campaign.dropboxFolderUrl ?? '')
  const [notes, setNotes] = useState(campaign.opsNotes ?? '')
  const [pending, startTransition] = useTransition()

  const docLabel = (fileType: string) =>
    DOCUMENT_TYPES.find((d) => d.fileType === fileType)?.label ?? fileType.replace(/_/g, ' ')

  const folderStructure = getFolderStructureForDisplay(campaign.dropboxFolderUrl)

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <p className="text-xs text-white/40 mb-1">{campaign.tsCode} · {campaign.promoter?.name}</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-black">{campaign.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-white/10">
              {CALCULATED_STATUS_LABELS[calculatedStatus]}
            </span>
            <Link
              href={`/dashboard/${campaign.id}`}
              className="text-xs border border-white/15 px-3 py-1.5 rounded-lg text-white/60 hover:text-white"
            >
              Campaign workspace →
            </Link>
          </div>
        </div>
        <p className="text-sm text-amber-400/90 mt-2">Next: {nextAction}</p>
      </div>

      <div className="flex gap-1 border-b border-white/[0.08] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-white text-white font-semibold' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className={`rounded-xl border p-4 ${launchReadiness.ready ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <h3 className="font-bold text-sm mb-2">{launchReadiness.ready ? 'Ready to launch' : 'Launch gate — not ready'}</h3>
            {!launchReadiness.ready && (
              <ul className="text-sm text-amber-400/90 list-disc pl-4 space-y-1">
                {launchReadiness.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
              {Object.entries(launchReadiness.checks).map(([k, v]) => (
                <div key={k} className={v ? 'text-emerald-400' : 'text-white/40'}>
                  {v ? '✓' : '○'} {k.replace(/([A-Z])/g, ' $1').trim()}
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-white/[0.08] p-4 space-y-2">
              <Row label="Promotion type" value={campaign.mechanicType.replace(/_/g, ' ')} />
              <Row label="Dates" value={`${formatDate(campaign.promoStart)} – ${formatDate(campaign.promoEnd)}`} />
              <Row label="Prize pool" value={`$${campaign.prizePoolTotal.toLocaleString('en-AU')}`} />
              <Row label="Terms" value={termsStatus} />
              <Row label="Invoice" value={campaign.invoiceOpsStatus.replace(/_/g, ' ')} />
            </div>
            <div className="rounded-xl border border-white/[0.08] p-4 space-y-3">
              <label className="text-xs text-white/40 uppercase tracking-wider">Dropbox folder</label>
              <input
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder="Paste Dropbox folder URL"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => { void updatePromotionDropbox(campaign.id, dropboxUrl) })}
                  className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-lg"
                >
                  Save URL
                </button>
                {campaign.dropboxFolderUrl && (
                  <a
                    href={campaign.dropboxFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs border border-white/15 px-3 py-1.5 rounded-lg text-white/70 hover:text-white"
                  >
                    Open Dropbox Folder
                  </a>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-white/40 mb-2">Required folder structure</h3>
            <div className="grid sm:grid-cols-2 gap-1 text-xs font-mono text-white/50">
              {folderStructure.map((f) => (
                <div key={f.label} className="px-2 py-1 bg-white/[0.02] rounded">{f.label}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Intake' && (
        <div className="rounded-xl border border-white/[0.08] p-4">
          {campaign.intakeSummary ? (
            <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans">{campaign.intakeSummary}</pre>
          ) : (
            <p className="text-white/40 text-sm">No intake summary recorded. Use <Link href="/dashboard/intake" className="underline">Campaign Intake</Link> or paste notes here via campaign workspace.</p>
          )}
        </div>
      )}

      {tab === 'Preflight' && (
        <div className="rounded-xl border border-white/[0.08] p-4">
          {campaign.preflightScore != null ? (
            <p className="text-sm">Preflight score: <span className="font-bold">{campaign.preflightScore}</span>/100</p>
          ) : (
            <p className="text-white/40 text-sm">No preflight score. Run preflight from <Link href={`/dashboard/${campaign.id}/preflight-report`} className="underline">campaign workspace</Link>.</p>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        <DocumentTable
          documents={documents}
          docLabel={docLabel}
          onUpdate={(id, data) => startTransition(() => { void updatePromotionDocument(id, data) })}
        />
      )}

      {tab === 'Permits' && (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-white/[0.08] p-4 grid sm:grid-cols-3 gap-3">
            <Row label="NSW" value={campaign.permitNSW ?? '—'} />
            <Row label="SA" value={campaign.permitSA ?? '—'} />
            <Row label="ACT" value={campaign.permitACT ?? '—'} />
          </div>
          <p className="text-white/40 text-xs">Edit permit numbers in <Link href={`/dashboard/admin/permits`} className="underline">Admin Permits</Link> or campaign workspace.</p>
        </div>
      )}

      {tab === 'Draws' && (
        <DrawTable
          draws={draws}
          onUpdate={(id, data) => startTransition(() => { void updatePromotionDraw(id, data) })}
        />
      )}

      {tab === 'Notes' && (
        <div className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
            placeholder="Internal ops notes…"
          />
          <button
            disabled={pending}
            onClick={() => startTransition(() => { void updatePromotionOpsNotes(campaign.id, notes) })}
            className="text-xs bg-white text-black font-bold px-4 py-2 rounded-lg"
          >
            Save notes
          </button>
          <div className="pt-4 border-t border-white/[0.06]">
            <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">Invoice status</label>
            <select
              value={campaign.invoiceOpsStatus}
              onChange={(e) =>
                startTransition(() => {
                  void updatePromotionInvoiceStatus(campaign.id, e.target.value as never)
                })
              }
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {['NOT_STARTED', 'REQUIRED', 'ISSUED', 'PAID', 'NOT_APPLICABLE'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 text-right">{value}</span>
    </div>
  )
}

function DocumentTable({
  documents,
  docLabel,
  onUpdate,
}: {
  documents: Doc[]
  docLabel: (t: string) => string
  onUpdate: (id: string, data: Record<string, unknown>) => void
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-white/35 border-b border-white/[0.06]">
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Required</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Dropbox URL</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b border-white/[0.04]">
              <td className="px-3 py-2">{docLabel(doc.fileType)}</td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={doc.required}
                  onChange={(e) => onUpdate(doc.id, { required: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={doc.status}
                  onChange={(e) => onUpdate(doc.id, { status: e.target.value })}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs max-w-[140px]"
                >
                  {Object.entries(OPS_DOCUMENT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  defaultValue={doc.dueDate?.slice(0, 10) ?? ''}
                  onBlur={(e) => onUpdate(doc.id, { dueDate: e.target.value || null })}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="url"
                  defaultValue={doc.dropboxFileUrl ?? ''}
                  placeholder="Dropbox file URL"
                  onBlur={(e) => onUpdate(doc.id, { dropboxFileUrl: e.target.value || null })}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs w-full min-w-[160px]"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DrawTable({
  draws,
  onUpdate,
}: {
  draws: Draw[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
}) {
  if (!draws.length) {
    return <p className="text-white/40 text-sm">No draws scheduled. Add draws via campaign workspace or seed data.</p>
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {draws.map((d) => {
        const overdue = d.drawDate.slice(0, 10) < today && d.entryFileStatus !== 'USED_IN_DRAW'
        const dueToday = d.drawDate.slice(0, 10) === today
        return (
          <div
            key={d.id}
            className={`rounded-xl border p-4 ${overdue ? 'border-red-500/40 bg-red-500/5' : dueToday ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/[0.08]'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold">{d.drawName} <span className="text-white/40 font-normal">#{d.drawNumber}</span></h3>
                <p className="text-xs text-white/50">{formatDate(d.drawDate)} {d.drawTime ?? ''} · {d.drawLocation ?? 'TBC'}</p>
              </div>
              {overdue && <span className="text-[10px] font-bold uppercase text-red-400">Overdue</span>}
              {dueToday && !overdue && <span className="text-[10px] font-bold uppercase text-amber-400">Due today</span>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <Field label="Entry period" value={`${formatDate(d.entryPeriodStart)} – ${formatDate(d.entryPeriodEnd)}`} />
              <Field label="Permit ref" value={d.permitReference ?? '—'} />
              <div>
                <label className="text-white/40 block mb-1">Entry file status</label>
                <select
                  value={d.entryFileStatus}
                  onChange={(e) => onUpdate(d.id, { entryFileStatus: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1"
                >
                  {Object.entries(DRAW_FILE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-white/40 block mb-1">Pure Random status</label>
                <input
                  defaultValue={d.purerandomDrawStatus ?? ''}
                  placeholder="scheduled / complete"
                  onBlur={(e) => onUpdate(d.id, { purerandomDrawStatus: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="text-white/40 block mb-1">Certificate status</label>
                <select
                  value={d.certificateStatus}
                  onChange={(e) => onUpdate(d.id, { certificateStatus: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1"
                >
                  {Object.entries(CERTIFICATE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-white/40 block mb-1">Winner notify due</label>
                <input
                  type="date"
                  defaultValue={d.winnerNotifyDue?.slice(0, 10) ?? ''}
                  onBlur={(e) => onUpdate(d.id, { winnerNotifyDue: e.target.value || null })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1"
                />
              </div>
              {d.publicationRequired && (
                <div>
                  <label className="text-white/40 block mb-1">Publication due</label>
                  <input
                    type="date"
                    defaultValue={d.publicationDue?.slice(0, 10) ?? ''}
                    onBlur={(e) => onUpdate(d.id, { publicationDue: e.target.value || null })}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1"
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/40">{label}</span>
      <p className="text-white/80">{value}</p>
    </div>
  )
}
