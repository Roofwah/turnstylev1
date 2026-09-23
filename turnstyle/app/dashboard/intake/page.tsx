'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ExtractedCampaignIntake, ExtractedRegion } from '@/lib/intake/types'
import { mapIntakeToBuilder } from '@/lib/intake/mapToBuilder'
import { saveIntakePrefill } from '@/lib/intake/storage'
import { generateSummary } from '@/lib/intake/generateSummary'

type Phase = 'input' | 'review' | 'edit'

function formatMoney(n: number | null): string {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function confidenceLabel(score: number | undefined): string {
  if (score == null) return '—'
  if (score >= 0.85) return 'High'
  if (score >= 0.6) return 'Medium'
  return 'Low'
}

function confidenceColor(score: number | undefined): string {
  if (score == null) return 'text-white/30'
  if (score >= 0.85) return 'text-emerald-400'
  if (score >= 0.6) return 'text-amber-400'
  return 'text-orange-400'
}

function RegionCard({
  region,
  confidence,
  editing,
  onChange,
}: {
  region: ExtractedRegion
  confidence: Record<string, number>
  editing: boolean
  onChange: (updated: ExtractedRegion) => void
}) {
  const prefix = region.region_name
  const pool =
    region.total_prize_value ??
    region.prizes.reduce((s, p) => s + (p.total_value ?? 0), 0)

  const field = (label: string, value: string | number | boolean | null, key: keyof ExtractedRegion) => (
    <div>
      <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">{label}</dt>
      {editing && (key === 'entry_threshold' || key === 'start_date' || key === 'end_date' || key === 'entry_mechanic') ? (
        <input
          type={key === 'entry_threshold' ? 'number' : key.includes('date') ? 'date' : 'text'}
          value={String(region[key] ?? '')}
          onChange={e => {
            const v = key === 'entry_threshold' ? (e.target.value ? Number(e.target.value) : null) : e.target.value || null
            onChange({ ...region, [key]: v })
          }}
          className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-2 py-1.5 text-white text-sm"
        />
      ) : (
        <dd className="text-white text-sm">
          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value ?? '—'}
        </dd>
      )}
    </div>
  )

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">{region.region_name}</h3>
        <span className={`text-xs font-semibold ${confidenceColor(confidence[`${prefix}.prizes`] ?? confidence.campaign_name)}`}>
          {confidenceLabel(confidence[`${prefix}.prizes`] ?? confidence[`${prefix}.entry_threshold`])} confidence
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('Start date', region.start_date, 'start_date')}
        {field('End date', region.end_date, 'end_date')}
        {field('Entry threshold', region.entry_threshold != null ? `$${region.entry_threshold}` : null, 'entry_threshold')}
        {field('Loyalty required', region.loyalty_required, 'loyalty_required' as keyof ExtractedRegion)}
        {field('Subsequent entries', region.subsequent_entries_allowed, 'subsequent_entries_allowed' as keyof ExtractedRegion)}
        {field('Draw date', formatDate(region.draw_date), 'draw_date' as keyof ExtractedRegion)}
        {field('Winner publication', formatDate(region.winner_publication_date), 'winner_publication_date' as keyof ExtractedRegion)}
        {field('Total prize pool', formatMoney(pool), 'total_prize_value' as keyof ExtractedRegion)}
      </dl>

      {region.participating_brands.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Participating brands</p>
          <p className="text-white/80 text-sm">{region.participating_brands.join(', ')}</p>
        </div>
      )}

      {region.prizes.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Prizes</p>
          <ul className="space-y-1.5">
            {region.prizes.map((p, i) => (
              <li key={i} className="text-sm text-white/80 flex justify-between gap-2">
                <span>{p.quantity} × {formatMoney(p.unit_value)} {p.description}</span>
                <span className="text-white/50 shrink-0">{formatMoney(p.total_value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {region.permit_flags.filter(f => f !== 'NONE_REQUIRED').length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {region.permit_flags.filter(f => f !== 'NONE_REQUIRED').map(f => (
            <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 font-semibold">
              {f.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CampaignIntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    }>
      <CampaignIntakePageInner />
    </Suspense>
  )
}

const INTAKE_EMAIL = process.env.NEXT_PUBLIC_INTAKE_EMAIL || 'intake@status.turnstylehost.com'

function CampaignIntakePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenParam = searchParams.get('token')
  const [phase, setPhase] = useState<Phase>('input')
  const [rawInput, setRawInput] = useState('')
  const [intake, setIntake] = useState<ExtractedCampaignIntake | null>(null)
  const [source, setSource] = useState<'ai' | 'mock' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('AU')
  const [copied, setCopied] = useState(false)
  const [draftToken, setDraftToken] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenParam) return
    setLoading(true)
    setError(null)
    fetch(`/api/intake/draft/${tokenParam}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Draft not found')
        setIntake(data.intake)
        setRawInput(data.rawInput)
        setSource(data.source === 'ai' ? 'ai' : 'mock')
        setSelectedRegion(data.intake.regions[0]?.region_name ?? 'AU')
        setDraftToken(tokenParam)
        setPhase('review')
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load draft'))
      .finally(() => setLoading(false))
  }, [tokenParam])

  const handleInterpret = useCallback(async () => {
    if (!rawInput.trim()) {
      setError('Please paste a campaign brief first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/intake/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: rawInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Interpretation failed')
      setIntake(data.intake)
      setSource(data.source)
      setSelectedRegion(data.intake.regions[0]?.region_name ?? 'AU')
      setPhase('review')
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [rawInput])

  function handleStartAgain() {
    setPhase('input')
    setIntake(null)
    setSource(null)
    setEditing(false)
    setError(null)
    setCopied(false)
  }

  function handleCopySummary() {
    if (!intake) return
    navigator.clipboard.writeText(intake.generated_summary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleSendToBuilder() {
    if (!intake) return
    const prefill = mapIntakeToBuilder(intake, selectedRegion)
    saveIntakePrefill(prefill)
    router.push('/dashboard/new?from=intake')
  }

  function updateRegion(index: number, updated: ExtractedRegion) {
    if (!intake) return
    const regions = [...intake.regions]
    regions[index] = updated
    const next = { ...intake, regions }
    next.generated_summary = generateSummary(next)
    setIntake(next)
  }

  function updateCampaignField(field: 'campaign_name' | 'promoter_name' | 'retailer', value: string) {
    if (!intake) return
    const next = { ...intake, [field]: value || null }
    next.generated_summary = generateSummary(next)
    setIntake(next)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
          <Link href="/dashboard" className="text-white/40 hover:text-white text-sm">← Campaigns</Link>
          <span className="text-white/20">/</span>
          <span className="text-white text-sm font-semibold">Campaign Intake</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-w-0">
        {phase === 'input' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-white font-black text-3xl mb-2">Describe your campaign</h1>
              <p className="text-white/40 text-sm">
                Paste an email, brief, or promotion summary. Turnstyle will extract key details for review before you continue in the campaign builder.
              </p>
              <p className="text-white/30 text-sm mt-2">
                Or email your brief to{' '}
                <a href={`mailto:${INTAKE_EMAIL}`} className="text-white/60 hover:text-white underline underline-offset-2">
                  {INTAKE_EMAIL}
                </a>
                {' '}— we&apos;ll reply with a review link.
              </p>
            </div>

            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="Paste an email, brief, campaign notes or promotion summary here…"
              rows={14}
              className="w-full bg-white/[0.04] border border-white/[0.10] rounded-2xl px-5 py-4 text-white placeholder-white/25 text-sm focus:outline-none focus:border-white/25 resize-y min-h-[280px]"
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <button
              type="button"
              onClick={handleInterpret}
              disabled={loading || !rawInput.trim()}
              className="bg-white text-[#0a0a0f] font-black text-sm px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Interpreting…' : 'Interpret Campaign'}
            </button>
          </div>
        )}

        {phase === 'review' && intake && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-white font-black text-2xl sm:text-3xl mb-1">Extracted Campaign Summary</h1>
                <p className="text-white/40 text-sm">
                  Review extracted details before sending to the campaign builder.
                  {source === 'mock' && ' (Deterministic extraction — AI not configured)'}
                  {draftToken && ' · Opened from email link'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(e => !e)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 transition-all"
                >
                  {editing ? 'Done editing' : 'Edit extracted details'}
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 transition-all"
                >
                  {copied ? 'Copied!' : 'Copy campaign summary'}
                </button>
                <button
                  type="button"
                  onClick={handleStartAgain}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-all"
                >
                  Start again
                </button>
              </div>
            </div>

            {intake.missing_fields.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3">
                <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Missing or uncertain fields</p>
                <p className="text-orange-300/80 text-sm">{intake.missing_fields.join(', ')}</p>
              </div>
            )}

            {intake.assumptions.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">Assumptions applied</p>
                <ul className="space-y-1">
                  {intake.assumptions.map((a, i) => (
                    <li key={i} className="text-amber-200/80 text-sm">• {a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">Original brief</h2>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 max-h-[520px] overflow-y-auto">
                  <pre className="text-white/60 text-sm whitespace-pre-wrap font-sans leading-relaxed">{intake.raw_input}</pre>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">Campaign summary</h2>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                  {editing ? (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="text-white/40 text-xs uppercase tracking-wider">Campaign name</label>
                        <input
                          value={intake.campaign_name ?? ''}
                          onChange={e => updateCampaignField('campaign_name', e.target.value)}
                          className="w-full mt-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-xs uppercase tracking-wider">Promoter / retailer</label>
                        <input
                          value={intake.promoter_name ?? intake.retailer ?? ''}
                          onChange={e => {
                            updateCampaignField('promoter_name', e.target.value)
                            updateCampaignField('retailer', e.target.value)
                          }}
                          className="w-full mt-1 bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 space-y-1">
                      <p className="text-white font-bold text-lg">{intake.campaign_name ?? '—'}</p>
                      <p className="text-white/50 text-sm">{intake.promoter_name ?? intake.retailer ?? '—'}</p>
                    </div>
                  )}
                  <p className="text-white/80 text-sm leading-relaxed">{intake.generated_summary}</p>
                </div>

                {intake.regions.length > 1 && (
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Send to builder as</p>
                    <div className="flex gap-2">
                      {intake.regions.map(r => (
                        <button
                          key={r.region_name}
                          type="button"
                          onClick={() => setSelectedRegion(r.region_name)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                            selectedRegion === r.region_name
                              ? 'bg-white text-[#0a0a0f]'
                              : 'bg-white/[0.06] text-white/60 hover:text-white'
                          }`}
                        >
                          {r.region_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {intake.regions.map((r, i) => (
                    <RegionCard
                      key={r.region_name}
                      region={r}
                      confidence={intake.confidence_scores}
                      editing={editing}
                      onChange={updated => updateRegion(i, updated)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={handleSendToBuilder}
                className="bg-white text-[#0a0a0f] font-black text-sm px-8 py-3.5 rounded-xl hover:bg-white/90 transition-all"
              >
                Send to Campaign Builder
              </button>
              <Link
                href="/dashboard/new"
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white border border-white/[0.10] hover:border-white/20 transition-all text-center"
              >
                Skip — manual entry
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
