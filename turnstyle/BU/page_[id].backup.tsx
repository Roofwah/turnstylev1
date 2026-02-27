'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { calculateQuote } from '@/lib/quote-engine'
import { getCampaign } from '@/app/actions/getCampaign'
import { updateCampaign } from '@/app/actions/updateCampaign'
import { deleteCampaign } from '@/app/actions/deleteCampaign'
import { confirmQuote } from '@/app/actions/confirmQuote'
import CampaignLifecycleBar from '@/components/CampaignLifecycleBar'

// Terms Tab Component - Shows drafts and comments
function TermsTab({ campaignId, campaignStatus }: { campaignId: string; campaignStatus: string }) {
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/terms?campaignId=${campaignId}`)
      .then(res => res.json())
      .then(data => {
        setDrafts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load terms drafts:', err)
        setLoading(false)
      })
  }, [campaignId])

  if (loading) {
    return <div className="text-white/60 text-sm">Loading terms drafts...</div>
  }

  const totalOpenComments =
    drafts.reduce(
      (sum, d) => sum + (d.comments?.filter((c: any) => c.status === 'OPEN').length || 0),
      0,
    )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-1 opacity-60">Abbreviated Terms & Conditions</h2>
        <button className="text-amber-400 hover:text-amber-300 text-sm underline"
          onClick={() => window.open(`/dashboard/${campaignId}/abbrev-terms`, '_blank')}
        >
          View Abbreviated Terms →
        </button>
      </div>
      <div>
        {['CONFIRMED','COMPILED','REVIEW','PENDING','SCHEDULED'].includes(campaignStatus) ? (
          <button onClick={() => window.open(`/dashboard/${campaignId}/terms-wizard`, '_blank')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium">
            {campaignStatus === 'COMPILED' || campaignStatus === 'REVIEW' ? 'Edit Terms →' : 'Start Terms Wizard →'}
          </button>
        ) : (
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded text-white/30 text-sm">
            Approve quote first to unlock terms
          </div>
        )}
        {totalOpenComments > 0 && (
          <div className="mt-3">
            <Link
              href={`/dashboard/${campaignId}/terms/comments`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {totalOpenComments} comment{totalOpenComments === 1 ? '' : 's'} to resolve
            </Link>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4 opacity-60">Full Terms & Conditions</h2>
        
        {drafts.length === 0 ? (
          <p className="text-white/40 text-sm">No terms drafts yet. Create one using the Terms Wizard above.</p>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => {
              const commentCount = draft.comments?.filter((c: any) => c.status === 'OPEN').length || 0
              const reviewUrl = `${window.location.origin}/review/${draft.shareToken}`
              
              return (
                <div key={draft.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">Version {draft.version}</h3>
                      <p className="text-white/60 text-xs mt-1">
                        Created: {new Date(draft.createdAt).toLocaleDateString()}
                        {' • '}
                        Status: <span className="capitalize">{draft.status.toLowerCase().replace('_', ' ')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {commentCount > 0 && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                          {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
                        </span>
                      )}
                      <button
                        onClick={() => window.open(reviewUrl, '_blank')}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded text-xs border border-amber-500/30"
                      >
                        View & Review
                      </button>
                    </div>
                  </div>
                  
                  {/* Approvals */}
                  {draft.approvals && draft.approvals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <h4 className="text-white/80 text-xs font-semibold mb-2">Approvals:</h4>
                      <div className="space-y-2">
                        {draft.approvals
                          .filter((a: any) => a.status === 'APPROVED')
                          .map((approval: any) => (
                            <div key={approval.id} className="text-white/80 text-xs">
                              <p>
                                <span className="font-medium">{approval.approverName}</span>
                                {' · '}
                                <span className="text-white/60">{approval.approverEmail}</span>
                                {' · '}
                                <span className="text-emerald-400">Approved</span>
                                {' · '}
                                <span className="text-white/50">
                                  {new Date(approval.respondedAt || approval.createdAt).toLocaleString('en-AU', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Comments */}
                  {commentCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <h4 className="text-white/80 text-xs font-semibold mb-2">Recent Comments:</h4>
                      <div className="space-y-2">
                        {draft.comments
                          ?.filter((c: any) => c.status === 'OPEN')
                          .slice(0, 3)
                          .map((comment: any) => (
                            <div key={comment.id} className="bg-white/5 rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white/80 text-xs font-medium">{comment.authorName}</span>
                                <span className="text-white/40 text-xs">{comment.clauseSlug}</span>
                              </div>
                              <p className="text-white/60 text-xs line-clamp-2">{comment.body}</p>
                            </div>
                          ))}
                        {commentCount > 3 && (
                          <p className="text-white/40 text-xs">+ {commentCount - 3} more comments</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrizeTier {
  tier: string
  description: string
  qty: number
  unitValue: number
}

interface Campaign {
  id: string
  tsCode: string
  name: string
  status: string
  promoter: {
    name: string
    abn: string
    contactName: string
    contactEmail: string
    contactPhone: string
  } | null
  promoStart: string
  promoEnd: string
  drawMechanic: string
  drawFrequency: string
  entryMechanic: string
  regions: string[]
  prizes: PrizeTier[]
  notes: string
  quotes?: { id: string; status: string; quoteNumber: string; approvedAt?: string | null }[]
  auditLogs?: { id: string; action: string; actorId: string; createdAt: string }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']

const MECHANIC_OPTIONS = [
  { value: 'Sweepstakes - Random Draw', label: 'Sweepstakes — Random Draw' },
  { value: 'Sweepstakes - Instant Win',  label: 'Sweepstakes — Instant Win' },
  { value: 'Limited Offer',              label: 'Limited Offer' },
  { value: 'Other',                      label: 'Other / Unsure' },
]

const FREQUENCY_OPTIONS = [
  { value: 'at_conclusion', label: 'At Conclusion' },
  { value: 'daily',         label: 'Daily' },
  { value: 'weekly',        label: 'Weekly' },
  { value: 'fortnightly',   label: 'Fortnightly' },
  { value: 'monthly',       label: 'Monthly' },
]

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:      { label: 'Draft',      color: 'text-white/50',    bg: 'bg-white/5',        border: 'border-white/10' },
  QUOTE_SENT: { label: 'Quote Sent', color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20' },
  APPROVED:   { label: 'Approved',   color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  ACTIVE:     { label: 'Active',     color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20' },
  ARCHIVED:   { label: 'Archived',   color: 'text-white/30',    bg: 'bg-white/5',        border: 'border-white/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU')
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRegions(regions: string[]) {
  const parts: string[] = []
  if (regions.includes('national_au')) parts.push('Australia')
  else {
    const states = regions.filter(r => AU_STATES.includes(r))
    if (states.length) parts.push('Aust: ' + states.join(', '))
  }
  if (regions.includes('NZ'))  parts.push('NZ')
  if (regions.includes('USA')) parts.push('USA')
  if (regions.includes('EU'))  parts.push('EU')
  return parts.join(' · ') || '—'
}

function normaliseCampaign(raw: any): Campaign {
  // Use ACTUAL campaign status - if quote is approved, status should be CONFIRMED (set by confirmQuote)
  // If status is DRAFT, quote is NOT approved - no fake status
  const hasApprovedQuote = raw.quotes?.some((q: any) => q.status === 'APPROVED' || q.status === 'ACCEPTED')
  const effectiveStatus = raw.status ?? 'DRAFT' // Use actual status, not fake
  
  return {
    id:            raw.id,
    tsCode:        raw.tsCode ?? '',
    name:          raw.name ?? '',
    status:        effectiveStatus,
    promoter:      raw.promoter ?? null,
    promoStart:    raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd:      raw.promoEnd   ? new Date(raw.promoEnd).toISOString().split('T')[0]   : '',
    drawMechanic:  raw.mechanicType === 'SWEEPSTAKES' ? 'Sweepstakes - Random Draw'
                 : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer'
                 : raw.drawMechanic ?? '',
    drawFrequency: (raw.drawFrequency ?? 'AT_CONCLUSION').toLowerCase().replace('_', '_'),
    entryMechanic: raw.entryMechanic ?? '',
    regions:       raw.regions ?? [],
    prizes:        Array.isArray(raw.prizes) ? raw.prizes : [],
    notes:         raw.notes ?? '',
    quotes:        raw.quotes?.map((q: any) => ({
      id: q.id,
      status: q.status,
      quoteNumber: q.quoteNumber,
      approvedAt: q.approvedAt,
    })) ?? [],
    auditLogs:     raw.auditLogs ?? [],
  }
}

// ─── Edit field components ────────────────────────────────────────────────────

function EditInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/40 transition-all w-full" />
  )
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/40 transition-all appearance-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>)}
    </select>
  )
}

function EditTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
      className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/40 transition-all w-full resize-none" />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommandCentrePage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)
  const [activeTab, setActiveTab]     = useState<'overview' | 'quote' | 'terms' | 'history'>('overview')
  const [editing, setEditing]         = useState(false)
  const [campaign, setCampaign]       = useState<Campaign | null>(null)
  const [draft, setDraft]             = useState<Campaign | null>(null)
  const [approvalWarning, setApprovalWarning] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)

  useEffect(() => {
    getCampaign(id).then(raw => {
      if (!raw) { setNotFound(true); setLoading(false); return }
      const c = normaliseCampaign(raw)
      setCampaign(c)
      setDraft(c)
      setLoading(false)
    })
  }, [id])

  const QUOTE_AFFECTING_FIELDS: (keyof Campaign)[] = [
    'promoStart', 'promoEnd', 'drawMechanic', 'drawFrequency', 'prizes', 'regions'
  ]

  function startEditing() {
    setDraft({ ...campaign! })
    setEditing(true)
    setApprovalWarning(false)
  }

  function cancelEditing() {
    setDraft({ ...campaign! })
    setEditing(false)
    setApprovalWarning(false)
  }

  function updateDraft<K extends keyof Campaign>(key: K, value: Campaign[K]) {
    setDraft(prev => {
      if (!prev) return prev
      const updated = { ...prev, [key]: value }
      if (campaign?.status === 'APPROVED' && QUOTE_AFFECTING_FIELDS.includes(key)) {
        setApprovalWarning(true)
      }
      return updated
    })
  }

  async function saveEdits() {
    if (!draft) return
    setSaving(true)
    await updateCampaign(id, {
      name:          draft.name,
      promoStart:    draft.promoStart,
      promoEnd:      draft.promoEnd,
      drawMechanic:  draft.drawMechanic,
      drawFrequency: draft.drawFrequency,
      entryMechanic: draft.entryMechanic,
      regions:       draft.regions,
      prizes:        draft.prizes,
      notes:         draft.notes,
      promoter:      draft.promoter ?? undefined,
      revertToDraft: approvalWarning,
    })
    setCampaign({ ...draft, status: approvalWarning ? 'DRAFT' : campaign!.status })
    setEditing(false)
    setApprovalWarning(false)
    setSaving(false)
  }

  // ── Loading / not found states ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/30 text-sm">Loading campaign...</div>
      </div>
    )
  }

  if (notFound || !campaign || !draft) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/30 text-sm mb-4">Campaign not found</p>
          <Link href="/dashboard" className="text-white text-sm underline">← Back to campaigns</Link>
        </div>
      </div>
    )
  }

  // ── Live quote ──
  const source = editing ? draft : campaign
  const prizePoolTotal = source.prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
// ── Countdown ──
const nowMs2 = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
const daysUntilFn = (d: string | null) => {
  if (!d) return null
  const dd = new Date(d)
  return Math.round((Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate()) - nowMs2) / 86400000)
}
const startDays = daysUntilFn(source.promoStart)
const endDays   = daysUntilFn(source.promoEnd)
let countdownLabel: string | null = null
if (['DRAFT','APPROVED','REVIEW','PENDING','SCHEDULED'].includes(campaign.status)) {
  if (startDays !== null && startDays > 0) countdownLabel = `${startDays} days to start`
  else if (startDays === 0) countdownLabel = 'Starts today'
  else if (startDays !== null && startDays < 0) countdownLabel = 'Started'
} else if (['LIVE','ACTIVE'].includes(campaign.status)) {
  if (endDays !== null && endDays > 0) countdownLabel = `${endDays} days to end`
  else if (endDays === 0) countdownLabel = 'Ends today'
} else if (campaign.status === 'CLOSED') {
  countdownLabel = 'Awaiting draw'
}




  const quote = calculateQuote({
    campaignId:    source.id,
    tsCode:        source.tsCode,
    campaignName:  source.name,
    promoStart:    source.promoStart,
    promoEnd:      source.promoEnd,
    drawMechanic:  source.drawMechanic,
    drawFrequency: source.drawFrequency,
    prizes:        source.prizes,
  })

  const status = statusConfig[campaign.status] ?? statusConfig.DRAFT

  // ── Region helpers ──
  const hasNational = draft.regions.includes('national_au')
  const hasStates   = draft.regions.some(r => AU_STATES.includes(r))

  function toggleRegion(region: string) {
    updateDraft('regions', draft!.regions.includes(region)
      ? draft!.regions.filter(r => r !== region)
      : [...draft!.regions, region]
    )
  }

  function toggleNational() {
    if (hasNational) {
      updateDraft('regions', draft!.regions.filter(r => r !== 'national_au'))
    } else {
      updateDraft('regions', [...draft!.regions.filter(r => !AU_STATES.includes(r) && r !== 'national_au'), 'national_au'])
    }
  }

  function toggleAustStates() {
    if (hasStates) {
      updateDraft('regions', draft!.regions.filter(r => !AU_STATES.includes(r)))
    } else {
      updateDraft('regions', [...draft!.regions.filter(r => r !== 'national_au'), 'NSW'])
    }
  }

  function toggleState(state: string) {
    updateDraft('regions', draft!.regions.includes(state)
      ? draft!.regions.filter(r => r !== state)
      : [...draft!.regions, state]
    )
  }

  function updatePrize(i: number, field: keyof PrizeTier, value: string | number) {
    updateDraft('prizes', draft!.prizes.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  function addPrize() {
    const tiers = ['1st', '2nd', '3rd', '4th', '5th']
    updateDraft('prizes', [...draft!.prizes, { tier: tiers[draft!.prizes.length] ?? '', description: '', qty: 1, unitValue: 0 }])
  }

  function removePrize(i: number) {
    updateDraft('prizes', draft!.prizes.filter((_, idx) => idx !== i))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />

      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white transition-colors text-sm">Campaigns</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold truncate max-w-xs">{campaign.name}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Approval warning */}
        {approvalWarning && (
          <div className="mb-6 bg-amber-400/10 border border-amber-400/30 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">⚠</span>
            <div>
              <p className="text-amber-400 font-bold text-sm">Quote approval will be invalidated</p>
              <p className="text-amber-400/70 text-xs mt-0.5">You've changed fields that affect the quote. Saving will revert this campaign to Draft and require re-approval.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-white/30 text-sm font-mono font-bold">{campaign.tsCode}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${status.color} ${status.bg} ${status.border}`}>
                {status.label}
              </span>
            </div>
            {editing ? (
              <input value={draft.name} onChange={e => updateDraft('name', e.target.value)}
                className="text-white font-black text-3xl bg-transparent border-b border-white/30 focus:outline-none focus:border-white pb-1 w-full max-w-lg" />
            ) : (
              <h1 className="text-white font-black text-3xl mb-1">{campaign.name}</h1>
            )}
            <p className="text-white/40 mt-1">{campaign.promoter?.name ?? '—'}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <>
                <button onClick={cancelEditing}
                  className="bg-white/[0.06] border border-white/[0.10] text-white/60 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button onClick={saveEdits} disabled={saving}
                  className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : approvalWarning ? 'Save & Revert to Draft' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button onClick={startEditing}
                  className="bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/10 transition-all">
                  ✏ Edit Campaign
                </button>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-500/20 transition-all">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

       {/* Metrics + status pills */}
{(() => {
  const r = source.regions
  const prize = prizePoolTotal
  const permitStates: string[] = []
  if ((r.includes('national_au') || r.includes('ACT')) && prize > 3500)  permitStates.push('ACT')
  if ((r.includes('national_au') || r.includes('SA'))  && prize > 5000)  permitStates.push('SA')
  if ((r.includes('national_au') || r.includes('NSW')) && prize > 10000) permitStates.push('NSW')
  const permitColors: Record<string, string> = {
    ACT: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    SA:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
    NSW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }

  const now = new Date()
  const nowMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const daysUntil = (d: string | null) => {
    if (!d) return null
    const dd = new Date(d)
    const t = Date.UTC(dd.getFullYear(), dd.getMonth(), dd.getDate())
    return Math.round((t - nowMs) / 86400000)
  }
  const startDays = daysUntil(source.promoStart)
  const endDays   = daysUntil(source.promoEnd)
  let countdownLabel: string | null = null
  if (['DRAFT','APPROVED','REVIEW','PENDING','SCHEDULED'].includes(campaign.status)) {
    if (startDays !== null && startDays > 0) countdownLabel = `${startDays} days to start`
    else if (startDays === 0) countdownLabel = 'Starts today'
    else if (startDays !== null && startDays < 0) countdownLabel = 'Started'
  } else if (['LIVE','ACTIVE'].includes(campaign.status)) {
    if (endDays !== null && endDays > 0) countdownLabel = `${endDays} days to end`
    else if (endDays === 0) countdownLabel = 'Ends today'
  } else if (campaign.status === 'CLOSED') {
    countdownLabel = 'Awaiting draw'
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Prize Pool',  value: formatMoney(prizePoolTotal) },
          { label: 'Quote Total', value: formatMoney(quote.totalExGst), sub: 'excl GST' },
          { label: 'Countdown', value: countdownLabel ?? '—' },
          { label: 'Final Draw',  value: quote.finalDrawDate },
        ].map(m => (
          <div key={m.label} className={`bg-white/[0.03] border rounded-xl p-4 transition-all ${editing ? 'border-white/[0.10]' : 'border-white/[0.06]'}`}>
            <div className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">{m.label}</div>
            <div className="text-white font-black text-xl">{m.value}</div>
            {m.sub && <div className="text-white/30 text-xs mt-0.5">{m.sub}</div>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {countdownLabel && (
          <div className="px-3 py-1 rounded-md bg-sky-400/10 border border-sky-400/20">
            <span className="text-sky-400 text-xs font-bold">{countdownLabel}</span>
          </div>
        )}
        {permitStates.length > 0 && (
          <>
            <span className="text-white/30 text-xs">Permits required</span>
            {permitStates.map(state => (
              <span key={state} className={`text-xs font-bold px-2 py-1 rounded-md border ${permitColors[state]}`}>
                {state}
              </span>
            ))}
          </>
        )}
        {permitStates.length === 0 && (
          <span className="text-white/20 text-xs">No permits required</span>
        )}
        <div className="ml-auto">
        {(() => {
          const isConfirmedOrBeyond = ['CONFIRMED','COMPILED','REVIEW','PENDING','SCHEDULED','LIVE','CLOSED','DRAWN','ARCHIVED'].includes(campaign.status)
          
          return !isConfirmedOrBeyond ? (
            <button
              onClick={async () => {
                try {
                  const result = await confirmQuote(id)
                  setConfirmedAt(result.confirmedAt)
                  setCampaign(prev => prev ? { ...prev, status: 'CONFIRMED' } : prev)
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Failed to confirm quote')
                }
              }}
              className="bg-white text-[#0a0a0f] font-black text-xs px-4 py-1.5 rounded-md hover:bg-white/90 transition-all">
              Confirm & Proceed →
            </button>
          ) : null
        })()}
      </div>
      </div>
    </>
  )
})()}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06]">
          {(['overview', 'quote', 'terms', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab ? 'text-white border-white' : 'text-white/30 border-transparent hover:text-white/60'
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-4">

            <div className={`border rounded-2xl p-6 transition-all ${editing ? 'bg-white/[0.04] border-white/[0.12]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-4 opacity-60">Campaign Details</h2>
              <div className="space-y-3">

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Start Date</span>
                  {editing ? (
                    <input type="date" value={draft.promoStart} min={new Date().toISOString().split('T')[0]}
                      onChange={e => updateDraft('promoStart', e.target.value)}
                      className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none" />
                  ) : <span className="text-white/80 text-sm">{formatDate(campaign.promoStart)}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">End Date</span>
                  {editing ? (
                    <input type="date" value={draft.promoEnd} min={draft.promoStart || new Date().toISOString().split('T')[0]}
                      onChange={e => updateDraft('promoEnd', e.target.value)}
                      className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none" />
                  ) : <span className="text-white/80 text-sm">{formatDate(campaign.promoEnd)}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Mechanic</span>
                  {editing ? <EditSelect value={draft.drawMechanic} onChange={v => updateDraft('drawMechanic', v)} options={MECHANIC_OPTIONS} />
                  : <span className="text-white/80 text-sm">{campaign.drawMechanic}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Draw Frequency</span>
                  {editing ? <EditSelect value={draft.drawFrequency} onChange={v => updateDraft('drawFrequency', v)} options={FREQUENCY_OPTIONS} />
                  : <span className="text-white/80 text-sm">{campaign.drawFrequency}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Entry Method</span>
                  {editing ? <EditTextarea value={draft.entryMechanic} onChange={v => updateDraft('entryMechanic', v)} />
                  : <span className="text-white/80 text-sm">{campaign.entryMechanic || '—'}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Regions</span>
                  {editing ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'national_au', label: 'Australia',   toggle: toggleNational,    active: hasNational },
                          { key: 'states',      label: 'Aust States', toggle: toggleAustStates,  active: hasStates },
                          { key: 'NZ',          label: 'NZ',          toggle: () => toggleRegion('NZ'),  active: draft.regions.includes('NZ') },
                          { key: 'USA',         label: 'USA',         toggle: () => toggleRegion('USA'), active: draft.regions.includes('USA') },
                          { key: 'EU',          label: 'EU',          toggle: () => toggleRegion('EU'),  active: draft.regions.includes('EU') },
                        ].map(r => (
                          <button key={r.key} type="button" onClick={r.toggle}
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                              r.active ? 'bg-white text-black' : 'bg-white/[0.05] border border-white/[0.10] text-white/40 hover:text-white hover:bg-white/10'
                            }`}>{r.label}</button>
                        ))}
                      </div>
                      {hasStates && (
                        <div className="flex flex-wrap gap-1">
                          {AU_STATES.map(state => (
                            <button key={state} type="button" onClick={() => toggleState(state)}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                                draft.regions.includes(state) ? 'bg-white text-black' : 'bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-white'
                              }`}>{state}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <span className="text-white/80 text-sm">{formatRegions(campaign.regions)}</span>}
                </div>

                <div className="flex gap-4 items-start">
                  <span className="text-white/30 text-sm w-32 shrink-0">Notes</span>
                  {editing ? <EditTextarea value={draft.notes} onChange={v => updateDraft('notes', v)} />
                  : <span className="text-white/80 text-sm">{campaign.notes || '—'}</span>}
                </div>

              </div>
            </div>

            {/* Promoter */}
            <div className={`border rounded-2xl p-6 transition-all ${editing ? 'bg-white/[0.04] border-white/[0.12]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-4 opacity-60">Promoter</h2>
              <div className="space-y-3">
                {[
                  { label: 'Company', key: 'name' },
                  { label: 'ABN',     key: 'abn' },
                  { label: 'Contact', key: 'contactName' },
                  { label: 'Email',   key: 'contactEmail' },
                  { label: 'Phone',   key: 'contactPhone' },
                ].map(row => (
                  <div key={row.label} className="flex gap-4 items-start">
                    <span className="text-white/30 text-sm w-32 shrink-0">{row.label}</span>
                    {editing ? (
                      <EditInput
                        value={(draft.promoter as any)?.[row.key] ?? ''}
                        onChange={v => updateDraft('promoter', { ...draft.promoter!, [row.key]: v })}
                      />
                    ) : (
                      <span className="text-white/80 text-sm">{(campaign.promoter as any)?.[row.key] || '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Prizes */}
            <div className={`border rounded-2xl p-6 md:col-span-2 transition-all ${editing ? 'bg-white/[0.04] border-white/[0.12]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest mb-4 opacity-60">Prize Structure</h2>
              {editing ? (
                <div className="space-y-3">
                  {draft.prizes.map((prize, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1">
                        <input value={prize.tier} onChange={e => updatePrize(i, 'tier', e.target.value)} placeholder="1st"
                          className="bg-white/[0.06] border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-full text-center font-bold" />
                      </div>
                      <div className="col-span-5">
                        <input value={prize.description} onChange={e => updatePrize(i, 'description', e.target.value)} placeholder="Description"
                          className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-full" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" value={prize.qty} onChange={e => updatePrize(i, 'qty', parseInt(e.target.value) || 1)} placeholder="Qty"
                          className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-full" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" value={prize.unitValue || ''} onChange={e => updatePrize(i, 'unitValue', parseFloat(e.target.value) || 0)} placeholder="Unit value"
                          className="bg-white/[0.06] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none w-full" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {draft.prizes.length > 1 && (
                          <button onClick={() => removePrize(i)} className="text-white/20 hover:text-red-400 transition-colors text-lg">×</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addPrize} className="text-white/30 hover:text-white/60 text-sm font-semibold transition-colors">+ Add tier</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaign.prizes.length === 0 ? (
                    <p className="text-white/30 text-sm">No prizes added yet</p>
                  ) : campaign.prizes.map((prize, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-white/30 text-xs font-mono w-8">{prize.tier}</span>
                        <span className="text-white/80 text-sm">{prize.description}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold text-sm">{prize.qty} × {formatMoney(prize.unitValue)}</span>
                        <span className="text-white/30 text-xs ml-2">= {formatMoney(prize.qty * prize.unitValue)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2">
                    <span className="text-white/40 text-sm font-semibold">Total Prize Pool</span>
                    <span className="text-white font-black">{formatMoney(prizePoolTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lifecycle Bar */}
            <div className="mt-6 pt-6 border-t border-white/[0.05]">
              <CampaignLifecycleBar
                campaignId={id}
                currentStatus={campaign.status}
                campaign={campaign}
                onStatusUpdated={(newStatus) => {
                  setCampaign(prev => prev ? { ...prev, status: newStatus } : prev)
                }}
              />
            </div>

          </div>
        )}

        {/* ── Quote ── */}
        {activeTab === 'quote' && (
          <div className="max-w-2xl">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Quote Number</div>
                  <div className="text-white font-black text-2xl">{quote.quoteNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Valid Until</div>
                  <div className="text-white/80 text-sm font-semibold">{formatDate(quote.validUntil)}</div>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                {quote.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
                    <div>
                      <div className="text-white/80 text-sm font-semibold">{line.label}</div>
                      <div className="text-white/30 text-xs mt-0.5">{line.note}</div>
                    </div>
                    <div className="text-white font-bold">{formatMoney(line.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl p-4">
                <div className="text-black/60 text-xs font-semibold uppercase tracking-widest">Total Estimate</div>
                <div className="text-black font-black text-2xl">{formatMoney(quote.totalExGst)}</div>
                <div className="text-black/40 text-xs">excl GST · +{formatMoney(quote.gstAmount)} GST = {formatMoney(quote.totalIncGst)} incl</div>
              </div>
            </div>
            <div className="flex gap-3">
            <div className="flex flex-col gap-2 w-full">
              {/* Lifecycle Bar */}
              <div className="mb-4 pt-4 border-t border-white/[0.05]">
                <CampaignLifecycleBar
                  campaignId={id}
                  currentStatus={campaign.status}
                  campaign={campaign}
                  onStatusUpdated={(newStatus) => {
                    setCampaign(prev => prev ? { ...prev, status: newStatus } : prev)
                  }}
                />
              </div>
              {(() => {
                const isConfirmedOrBeyond = ['CONFIRMED','COMPILED','REVIEW','PENDING','SCHEDULED','LIVE','CLOSED','DRAWN','ARCHIVED'].includes(campaign.status)
                
                return !isConfirmedOrBeyond ? (
                  <button
                    onClick={async () => {
                      try {
                        const result = await confirmQuote(id)
                        setConfirmedAt(result.confirmedAt)
                        setCampaign(prev => prev ? { ...prev, status: 'CONFIRMED' } : prev)
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to confirm quote')
                      }
                    }}
                    className="flex-1 bg-white text-[#0a0a0f] font-black text-sm py-3 rounded-xl hover:bg-white/90 transition-all">
                    Confirm & Proceed →
                  </button>
                ) : null
              })()}
            </div>
              
              
              
              <button onClick={() => window.open(`/dashboard/${id}/quote`, '_blank')}
  className="bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-white/10 transition-all">
  Export PDF
</button>
<button
  onClick={() => window.open(`/dashboard/${id}/abbrev-terms`, '_blank')}
  className="bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-white/10 transition-all">
  Abbrev T&Cs
</button>




            </div>
          </div>
        )}

        {/* ── Tab: Terms ── */}
        {activeTab === 'terms' && (
          <TermsTab campaignId={id} campaignStatus={campaign.status} />
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          <div className="max-w-2xl">
            {campaign.auditLogs && campaign.auditLogs.length > 0 ? (
              <div className="space-y-3">
                {campaign.auditLogs.map((entry: any) => (
                  <div key={entry.id} className="flex items-start gap-4 py-3 border-b border-white/[0.05] last:border-0">
                    <div className="w-2 h-2 rounded-full bg-white/20 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-white/80 text-sm capitalize">{entry.action.replace(/_/g, ' ')}</div>
                      <div className="text-white/30 text-xs mt-0.5">
                        {new Date(entry.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No history yet</p>
            )}
          </div>
        )}
{showDeleteConfirm && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
    <div className="bg-[#111118] border border-white/[0.10] rounded-2xl p-8 max-w-sm w-full">
      <h2 className="text-white font-black text-xl mb-2">Delete campaign?</h2>
      <p className="text-white/40 text-sm mb-2">
        This will permanently delete <span className="text-white font-semibold">{campaign.name}</span> and all associated quotes, approvals and documents.
      </p>
      <p className="text-red-400/70 text-xs mb-6">This action cannot be undone.</p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowDeleteConfirm(false)}
          className="flex-1 bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-white/10 transition-all">
          Cancel
        </button>
        <button
          onClick={async () => {
            await deleteCampaign(id)
          }}
          className="flex-1 bg-red-500 text-white font-black text-sm py-2.5 rounded-xl hover:bg-red-600 transition-all">
          Yes, Delete
        </button>
      </div>
    </div>
  </div>
)}
      </main>
    </div>
  )
}