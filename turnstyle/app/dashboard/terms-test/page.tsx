'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { getCampaignByTsCode } from '@/app/actions/getCampaign'
import { getTemplatesForCampaign, getAllTemplates, mergeSubTemplatesIntoClauses, type TemplateEntry } from '@/lib/terms-templates'
import { preflightCampaign } from '@/app/actions/preflightCampaign'
import { buildPermitClause } from '@/lib/preflight/permitClause'
import type { PreflightReport, PreflightIssue, IssueSeverity } from '@/lib/preflight/types'

interface PrizeTier { tier: string; description: string; qty: number; unitValue: number }

interface GapFollowUp {
  key: string
  question: string
  placeholder?: string
  multiline?: boolean
  showWhen: number
}

interface Gap {
  key: string
  question: string
  options?: string[]
  optionLabels?: string[]
  placeholder?: string
  multiline?: boolean
  multiple?: boolean
  default?: string
  hidden?: boolean
  followUp?: GapFollowUp
}

interface Clause {
  slug: string
  label: string
  text: string
  gaps?: Gap[]
}

type QuestionGap = Gap | GapFollowUp

interface Question {
  gap: QuestionGap
  isFollowUp: boolean
  parentGap?: Gap
}

function formatMoney(n: number) {
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2 })
}

function formatDateLong(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRegion(regions: string[]) {
  const AU = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'ACT', 'TAS', 'NT']
  if (regions?.includes('national_au')) return 'throughout Australia'
  const states = (regions || []).filter((r: string) => AU.includes(r))
  return states.length ? `in ${states.join(', ')}` : 'in selected regions'
}

function calcDrawDate(promoEnd: string) {
  if (!promoEnd) return 'TBC'
  const d = new Date(promoEnd)
  let added = 0
  while (added < 5) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function calcUnclaimed(promoEnd: string) {
  if (!promoEnd) return { deadline: 'TBC', redraw: 'TBC' }
  const d = new Date(promoEnd)
  const dl = new Date(d)
  dl.setDate(dl.getDate() + 60)
  const rd = new Date(dl)
  rd.setDate(rd.getDate() + 1)
  return {
    deadline: dl.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    redraw: rd.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function normaliseCampaign(raw: any) {
  const prizes: PrizeTier[] = Array.isArray(raw.prizes) ? raw.prizes : []
  const prizePool = prizes.reduce((s: number, p: PrizeTier) => s + p.qty * p.unitValue, 0)
  const totalWinners = prizes.reduce((s: number, p: PrizeTier) => s + p.qty, 0)
  return {
    id: raw.id,
    tsCode: raw.tsCode ?? '',
    name: raw.name ?? '',
    promoter: raw.promoter ?? null,
    promoStart: raw.promoStart ? new Date(raw.promoStart).toISOString().split('T')[0] : '',
    promoEnd: raw.promoEnd ? new Date(raw.promoEnd).toISOString().split('T')[0] : '',
    drawMechanic: raw.mechanicType === 'SWEEPSTAKES' ? 'Trade Lottery' : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer' : 'Prize Draw',
    entryMechanic: raw.entryMechanic ?? '',
    regions: raw.regions ?? [],
    prizes,
    prizePool,
    totalWinners,
    prizeList: prizes.map((p: PrizeTier) => `${p.qty} x ${p.description} valued at ${formatMoney(p.unitValue)} (incl. GST)`).join('\n'),
    // Permit fields
    requiredPermits: raw.requiredPermits ?? [],
    permitNSW: raw.permitNSW ?? null,
    permitSA:  raw.permitSA  ?? null,
    permitACT: raw.permitACT ?? null,
  }
}

function isFullGap(gap: QuestionGap): gap is Gap {
  return 'options' in gap || 'optionLabels' in gap || 'followUp' in gap
}

function formatAddress(address: any): string {
  if (!address) return '[Address]'
  if (typeof address === 'string') return address
  if (typeof address === 'object') {
    const parts = [address.street, address.suburb, address.state, address.postcode].filter(Boolean)
    return parts.join(', ') || '[Address]'
  }
  return '[Address]'
}

// ─── Preflight UI helpers ─────────────────────

const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { label: 'Critical', bg: 'bg-red-500/10',    text: 'text-red-400',    dot: 'bg-red-400' },
  ERROR:    { label: 'Error',    bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  WARNING:  { label: 'Warning',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  NOTICE:   { label: 'Notice',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: 'bg-blue-400' },
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EXCELLENT:     { label: 'Excellent',     color: 'text-emerald-400', bg: 'bg-emerald-400' },
  LOW_RISK:      { label: 'Low Risk',      color: 'text-green-400',   bg: 'bg-green-400' },
  MODERATE_RISK: { label: 'Moderate Risk', color: 'text-amber-400',   bg: 'bg-amber-400' },
  HIGH_RISK:     { label: 'High Risk',     color: 'text-orange-400',  bg: 'bg-orange-400' },
  NOT_READY:     { label: 'Not Ready',     color: 'text-red-400',     bg: 'bg-red-400' },
}

function IssueCard({ issue }: { issue: PreflightIssue }) {
  const [open, setOpen] = useState(false)
  const cfg = SEVERITY_CONFIG[issue.severity]
  return (
    <div className={`rounded-lg border border-white/10 overflow-hidden ${cfg.bg}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
            <span className="text-white/20 text-xs">{issue.ruleId}</span>
          </div>
          <p className="text-white/90 text-sm font-medium leading-snug">{issue.title}</p>
        </div>
        <span className="text-white/30 text-xs mt-1 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          <p className="text-white/60 text-sm leading-relaxed">{issue.description}</p>
          {issue.suggestedFix && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Suggested fix</p>
              <p className="text-white/70 text-sm leading-relaxed">{issue.suggestedFix}</p>
            </div>
          )}
          {issue.suggestedRewrite && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Suggested rewrite</p>
              <p className="text-white/70 text-sm leading-relaxed italic border-l-2 border-white/20 pl-3">{issue.suggestedRewrite}</p>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {issue.affectedClause && (
              <span className="text-white/30 text-xs bg-white/5 rounded px-2 py-0.5">Clause: {issue.affectedClause}</span>
            )}
            {issue.sourceLayer && (
              <span className="text-white/30 text-xs bg-white/5 rounded px-2 py-0.5">{issue.sourceLayer === 'ai' ? 'AI review' : 'Rules engine'}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PreflightPanel({ report, onClose }: { report: PreflightReport; onClose: () => void }) {
  const risk = RISK_CONFIG[report.score.riskBand] ?? RISK_CONFIG.NOT_READY
  const { criticalCount, errorCount, warningCount, noticeCount, isPublishReady } = report.summary

  const grouped = useMemo(() => {
    const order: IssueSeverity[] = ['CRITICAL', 'ERROR', 'WARNING', 'NOTICE']
    return order
      .map(sev => ({
        severity: sev,
        issues: report.issues.filter(i => i.severity === sev),
      }))
      .filter(g => g.issues.length > 0)
  }, [report])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#0f0f18] border-l border-white/10 flex flex-col h-full shadow-2xl animate-slide-in">

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" fill="currentColor" className="text-white/60"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Preflight Report</p>
              <p className="text-white/40 text-xs">{new Date(report.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Score block */}
        <div className="px-5 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Overall score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-black text-4xl">{report.score.total}</span>
                <span className="text-white/30 text-lg">/100</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${risk.color}`}>{risk.label}</span>
              <p className="text-white/40 text-xs mt-1 max-w-[160px] leading-snug">{report.score.readinessStatus}</p>
            </div>
          </div>

          {/* Score bar */}
          <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${risk.bg}`}
              style={{ width: `${report.score.total}%` }}
            />
          </div>

          {/* Issue counts */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Critical', count: criticalCount, color: 'text-red-400' },
              { label: 'Errors',   count: errorCount,    color: 'text-orange-400' },
              { label: 'Warnings', count: warningCount,  color: 'text-amber-400' },
              { label: 'Notices',  count: noticeCount,   color: 'text-blue-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-white/5 rounded-lg px-2 py-2 text-center">
                <p className={`text-lg font-black ${color}`}>{count}</p>
                <p className="text-white/30 text-xs">{label}</p>
              </div>
            ))}
          </div>

          {/* Publish readiness */}
          <div className={`mt-3 rounded-lg px-3 py-2 flex items-center gap-2 ${isPublishReady ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <span className={`text-sm ${isPublishReady ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPublishReady ? '✓' : '✕'}
            </span>
            <span className={`text-sm font-medium ${isPublishReady ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPublishReady ? 'Ready to publish' : 'Not ready to publish'}
            </span>
            {report.aiReviewUsed && (
              <span className="ml-auto text-white/20 text-xs">AI + Rules</span>
            )}
          </div>
        </div>

        {/* Issues list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {grouped.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-emerald-400 text-lg font-bold mb-1">No issues found</p>
              <p className="text-white/40 text-sm">Terms passed all checks.</p>
            </div>
          ) : (
            grouped.map(({ severity, issues }) => {
              const cfg = SEVERITY_CONFIG[severity]
              return (
                <div key={severity}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${cfg.text}`}>
                    {cfg.label} · {issues.length}
                  </p>
                  <div className="space-y-2">
                    {issues.map(issue => (
                      <IssueCard key={issue.ruleId} issue={issue} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 shrink-0">
          <p className="text-white/20 text-xs text-center">
            Turnstyle Preflight · {report.reportId.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────

export default function TermsTestPage() {
  const [campaignCode, setCampaignCode] = useState('')
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<TemplateEntry[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('repco-trade')
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({})

  // Preflight state
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null)
  const [preflightError, setPreflightError] = useState<string | null>(null)
  const [showPreflight, setShowPreflight] = useState(false)

  function answer(key: string, value: string | number) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleMultiAnswer(key: string, value: string) {
    setAnswers(prev => {
      const current = prev[key]
      const arr = Array.isArray(current) ? [...current] : []
      const i = arr.indexOf(value)
      if (i >= 0) arr.splice(i, 1)
      else arr.push(value)
      return { ...prev, [key]: arr }
    })
  }

  async function loadCampaign() {
    const code = campaignCode.trim().toUpperCase()
    if (!code) {
      setError('Enter a campaign code (e.g. R98V8)')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const raw = await getCampaignByTsCode(code)
      if (!raw) {
        setCampaign(null)
        setError(`No campaign found for code "${code}"`)
        return
      }
      const c = normaliseCampaign(raw)
      setCampaign(c)
      const { deadline, redraw } = calcUnclaimed(c.promoEnd)
      setAnswers({
        UNCLAIMED_DEADLINE: deadline,
        UNCLAIMED_REDRAW: redraw,
      })
      const templates = getTemplatesForCampaign(
        c.promoter?.name ?? '',
        c.drawMechanic
      )
      setAvailableTemplates(templates)
      if (templates.length > 0 && !templates.find(t => t.meta.id === selectedTemplate)) {
        setSelectedTemplate(templates[0].meta.id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function runPreflight() {
    if (!campaign?.id) return
    setPreflightLoading(true)
    setPreflightError(null)
    try {
      // Build the full rendered terms string from live clause content
      // This is exactly what the user sees in the preview — no save step needed
      const renderedTerms = clausesForDocument
        .map((clause: Clause) => {
          const { resolved } = resolveText(clause.text)
          return `${clause.label}\n\n${resolved}`
        })
        .join('\n\n---\n\n')

      // Append permit clause automatically if required
      const permitClause = buildPermitClause(campaign)
      const fullTerms = permitClause
        ? `${renderedTerms}\n\n---\n\n${permitClause}`
        : renderedTerms

      const result = await preflightCampaign(campaign.id, fullTerms, answers)
      if ('error' in result) {
        setPreflightError(result.error)
        return
      }
      setPreflightReport(result.report)
      setShowPreflight(true)
    } catch (e) {
      setPreflightError('Preflight failed. Check console for details.')
      console.error('[preflight]', e)
    } finally {
      setPreflightLoading(false)
    }
  }

  const currentTemplate =
    availableTemplates.find(t => t.meta.id === selectedTemplate) ??
    availableTemplates[0] ??
    getAllTemplates()[0]
  const templateMeta = currentTemplate?.meta
  const baseClauses = currentTemplate?.clauses ?? []
  const selectedSubTemplateIds = useMemo(() => {
    const v = answers.PRIZE_TYPES
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
  }, [answers])
  const currentClauses = mergeSubTemplatesIntoClauses(baseClauses, selectedSubTemplateIds, { insertAfterSlug: 'prizes' })
  const clausesForDocument = useMemo(() => {
    const base = currentClauses.filter((c: Clause) => c.slug !== 'sub_template_choice')
    if (!campaign) return base
    // Append permit clause dynamically if permits are required
    const permitClause = buildPermitClause(campaign)
    if (!permitClause) return base
    // Remove any hardcoded permit clause from the template
    const withoutHardcoded = base.filter((c: Clause) => c.slug !== 'permits')
    // Parse the clause string into a Clause object for rendering
    const [heading, ...bodyLines] = permitClause.split('\n\n')
    return [
      ...withoutHardcoded,
      {
        slug: 'permits-dynamic',
        label: heading,
        text: bodyLines.join('\n\n'),
      } as Clause,
    ]
  }, [currentClauses, campaign])

  const allQuestions: Question[] = useMemo(() => {
    const questions: Question[] = []
    const defaultsToApply: Record<string, string> = {}

    currentClauses.forEach((clause: Clause) => {
      if (!clause.gaps) return
      clause.gaps.forEach((gap: Gap) => {
        // Collect defaults for gaps that have them and aren't already answered
        if (gap.default && answers[gap.key] === undefined) {
          defaultsToApply[gap.key] = gap.default
        }
        // Only add to visible questions if not hidden
        if (!gap.hidden) {
          questions.push({ gap, isFollowUp: false })
          if (gap.followUp) {
            const parentAnswer = answers[gap.key]
            if (parentAnswer !== undefined && Number(parentAnswer) === gap.followUp.showWhen) {
              questions.push({ gap: gap.followUp, isFollowUp: true, parentGap: gap })
            }
          }
        }
      })
    })

    // Apply defaults without triggering re-render loop
    if (Object.keys(defaultsToApply).length > 0) {
      setAnswers(prev => ({ ...defaultsToApply, ...prev }))
    }

    return questions
  }, [answers, currentClauses])

  const AUTO_VARS: Record<string, string> = useMemo(() => {
    if (!campaign) {
      return {
        PROMOTER_NAME: '[Promoter name]', PROMOTER_ABN: '[ABN]', PROMOTER_ADDRESS: '[Address]',
        PROMO_START: '[Start date]', PROMO_END: '[End date]', DRAW_MECHANIC: '[Draw mechanic]',
        CAMPAIGN_URL: '[Campaign URL]', REGION: '[Region]', ENTRY_MECHANIC: '[entry mechanic]',
        TOTAL_WINNERS: '0', DRAW_DATE: '[Draw date]', PRIZE_LIST: '[Prize list]', PRIZE_POOL: '$0.00',
        UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
        UNCLAIMED_REDRAW: String(answers.UNCLAIMED_REDRAW ?? '[redraw date]'),
      }
    }
    return {
      PROMOTER_NAME: campaign.promoter?.name ?? '[Promoter name]',
      PROMOTER_ABN: campaign.promoter?.abn ?? '[ABN]',
      PROMOTER_ADDRESS: formatAddress(campaign.promoter?.address),
      PROMO_START: formatDateLong(campaign.promoStart),
      PROMO_END: formatDateLong(campaign.promoEnd),
      DRAW_MECHANIC: campaign.drawMechanic,
      CAMPAIGN_URL: `https://turnstylehost.com/campaign/${campaign.tsCode.toLowerCase()}/`,
      REGION: formatRegion(campaign.regions),
      ENTRY_MECHANIC: campaign.entryMechanic || '[entry mechanic]',
      TOTAL_WINNERS: String(campaign.totalWinners),
      DRAW_DATE: calcDrawDate(campaign.promoEnd),
      PRIZE_LIST: campaign.prizeList,
      PRIZE_POOL: formatMoney(campaign.prizePool),
      UNCLAIMED_DEADLINE: String(answers.UNCLAIMED_DEADLINE ?? '[deadline]'),
      UNCLAIMED_REDRAW: String(answers.UNCLAIMED_REDRAW ?? '[redraw date]'),
    }
  }, [campaign, answers])

  const resolveText = useMemo(() => {
    return (text: string): { resolved: string; hasUnfilledGaps: boolean } => {
      if (!text) return { resolved: '', hasUnfilledGaps: false }
      let out = String(text)
      let hasUnfilledGaps = false
      out = out.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        const value = AUTO_VARS[key]
        if (value !== undefined && value !== null) return String(value)
        return `[${key}]`
      })
      out = out.replace(/\[\[(\w+)\]\]/g, (_match, key) => {
        const answerVal = answers[key]
        if (answerVal !== undefined && answerVal !== null && String(answerVal).trim() !== '') return String(answerVal)
        hasUnfilledGaps = true
        return `▓▓▓`
      })
      return { resolved: out, hasUnfilledGaps }
    }
  }, [AUTO_VARS, answers])

  // No campaign: show code entry
  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
          style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
        <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm transition-colors">Dashboard</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Terms Test</span>
          </div>
        </nav>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full">
            <h1 className="text-white font-black text-2xl mb-2">Terms Test</h1>
            <p className="text-white/50 text-sm mb-6">Enter a campaign code to open the terms wizard with a live preview.</p>
            <div className="space-y-4">
              <label className="block text-white/70 text-sm font-medium">Campaign code</label>
              <input
                type="text"
                value={campaignCode}
                onChange={e => { setCampaignCode(e.target.value); setError(null) }}
                onKeyDown={e => e.key === 'Enter' && loadCampaign()}
                placeholder="e.g. R98V8"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 font-mono uppercase"
              />
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button
                onClick={loadCampaign}
                disabled={loading}
                className="w-full bg-white text-[#0a0a0f] font-bold py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Open wizard'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Split screen: wizard left, live terms right
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out forwards; }
      `}</style>

      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />

      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10 shrink-0">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/tstyle.png" alt="Turnstyle" className="h-6 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm">Dashboard</Link>
            <span className="text-white/20">/</span>
            <Link href="/dashboard/terms-test" className="text-white/60 text-sm">Terms Test</Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">{campaign.name} ({campaign.tsCode})</span>
          </div>
          <button
            onClick={() => { setCampaign(null); setCampaignCode(''); setError(null) }}
            className="text-white/50 hover:text-white text-sm"
          >
            Change campaign
          </button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        {/* Left: Wizard */}
        <div className="border-r border-white/10 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-white/10 shrink-0">
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">Template</label>
            <select
              value={selectedTemplate}
              onChange={e => {
                setSelectedTemplate(e.target.value)
                setAnswers(prev => {
                  const { UNCLAIMED_DEADLINE, UNCLAIMED_REDRAW } = prev
                  return { UNCLAIMED_DEADLINE: UNCLAIMED_DEADLINE ?? '', UNCLAIMED_REDRAW: UNCLAIMED_REDRAW ?? '' }
                })
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            >
              {availableTemplates.map(t => (
                <option key={t.meta.id} value={t.meta.id}>
                  {t.meta.name}{t.meta.description ? ` — ${t.meta.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-white font-bold text-sm">Gap answers (updates preview live)</h3>
            {allQuestions.length === 0 ? (
              <p className="text-white/40 text-sm">No questions for this template.</p>
            ) : (
              allQuestions.map((q, i) => (
                <div key={`question-${i}`} className="space-y-1">
                  <label className="block text-white/70 text-xs font-medium">
                    {i + 1}. {q.gap.question}
                  </label>
                  {isFullGap(q.gap) && q.gap.multiple && q.gap.options && q.gap.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(q.gap as Gap).options!.map((opt: string, j: number) => {
                        const label = (q.gap as Gap).optionLabels?.[j] ?? opt
                        const selected: string[] = Array.isArray(answers[q.gap.key]) ? (answers[q.gap.key] as string[]) : []
                        const isSelected = selected.includes(opt)
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => toggleMultiAnswer(q.gap.key, opt)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-2 ${
                              isSelected ? 'bg-white text-[#0a0a0f] border-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#0a0a0f] border-[#0a0a0f]' : 'border-white/40'}`}>
                              {isSelected && <span className="text-white text-[10px]">✓</span>}
                            </span>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : isFullGap(q.gap) && q.gap.options && q.gap.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(q.gap as Gap).options!.map((opt: string, j: number) => {
                        const label = (q.gap as Gap).optionLabels?.[j] ?? opt
                        const isSelected = String(answers[q.gap.key]) === String(j)
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => answer(q.gap.key, j)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                              isSelected ? 'bg-white text-[#0a0a0f] border-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    q.gap.multiline ? (
                      <textarea
                        value={String(answers[q.gap.key] ?? '')}
                        onChange={e => answer(q.gap.key, e.target.value)}
                        placeholder={q.gap.placeholder ?? 'Type your answer...'}
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(answers[q.gap.key] ?? '')}
                        onChange={e => answer(q.gap.key, e.target.value)}
                        placeholder={q.gap.placeholder ?? 'Type your answer...'}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                      />
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Live terms preview */}
        <div className="flex flex-col min-h-0 overflow-hidden bg-[#0a0a0f]">
          <div className="px-4 py-2 border-b border-white/10 shrink-0">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Live terms (built from wizard)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-1">{templateMeta?.name}</p>
                <h1 className="text-white font-black text-2xl mb-1">{campaign.name}</h1>
              </div>
              <div className="bg-white rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-gray-900 font-black text-lg">{campaign.name}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">Terms & Conditions · {templateMeta?.name}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {clausesForDocument.length > 0 ? (
                    clausesForDocument.map((clause, ci) => {
                      const { resolved, hasUnfilledGaps } = resolveText(clause.text)
                      const textToShow = resolved?.trim() ? resolved : clause.text || 'No content'
                      return (
                        <div key={clause.slug} className={`px-6 py-4 ${ci % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{clause.label}</div>
                          <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                            {hasUnfilledGaps && clause.gaps ? (
                              <span className="text-amber-600 italic">Answer in wizard to generate this clause</span>
                            ) : (
                              textToShow
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">No clauses in template.</div>
                  )}
                </div>

                {/* Footer with preflight button */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-gray-300 text-xs">Turnstyle · {campaign.tsCode}</p>
                  <div className="flex items-center gap-2">
                    {preflightError && (
                      <p className="text-red-400 text-xs">{preflightError}</p>
                    )}
                    {preflightReport && !showPreflight && (
                      <button
                        onClick={() => setShowPreflight(true)}
                        className="text-xs text-white/50 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-all"
                      >
                        View report
                      </button>
                    )}
                    <button
                      onClick={runPreflight}
                      disabled={preflightLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0f] text-white text-xs font-semibold hover:bg-black transition-all disabled:opacity-50"
                    >
                      {preflightLoading ? (
                        <>
                          <span className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          Run Preflight
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preflight slide-in panel */}
      {showPreflight && preflightReport && (
        <PreflightPanel
          report={preflightReport}
          onClose={() => setShowPreflight(false)}
        />
      )}
    </div>
  )
}
