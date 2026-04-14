'use client'

// ─────────────────────────────────────────────
// Turnstyle — Preflight Upload Report Component
//
// Renders the full 4-layer preflight report:
//   1. Recommendation banner  (new)
//   2. Concept review grid    (new)
//   3. Composite score panel  (new)
//   4. Extracted data panel   (new)
//   5. Structural score dial  (existing)
//   6. Issues by category     (existing)
// ─────────────────────────────────────────────

import type { PreflightReport, PreflightIssue, IssueSeverity, IssueCategory } from '@/lib/preflight/types'
import type { ExtractedCampaignSchema, ExtractedField, ExtractionConfidence } from '@/lib/preflight-extraction/types'
import type { DocumentReview, ConceptReview, PresenceState, RecommendationCode } from '@/lib/preflight-review/types'
import type { CampaignDraftSeed } from '@/lib/preflight-rebuild/types'

// ─── Severity config ──────────────────────────

const SEV: Record<IssueSeverity, { label: string; color: string; bg: string; dot: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20',       dot: 'bg-red-400' },
  ERROR:    { label: 'Error',    color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20',  dot: 'bg-orange-400' },
  WARNING:  { label: 'Warning',  color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20',   dot: 'bg-amber-400' },
  NOTICE:   { label: 'Notice',   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20',     dot: 'bg-blue-400' },
}

const RISK_BAND_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  EXCELLENT:      { label: 'Excellent',      color: 'text-emerald-400', bg: 'bg-emerald-400/10', ring: 'text-emerald-400' },
  LOW_RISK:       { label: 'Low Risk',       color: 'text-emerald-400', bg: 'bg-emerald-400/10', ring: 'text-emerald-400' },
  MODERATE_RISK:  { label: 'Moderate Risk',  color: 'text-amber-400',   bg: 'bg-amber-400/10',   ring: 'text-amber-400' },
  HIGH_RISK:      { label: 'High Risk',      color: 'text-orange-400',  bg: 'bg-orange-400/10',  ring: 'text-orange-400' },
  NOT_READY:      { label: 'Not Ready',      color: 'text-red-400',     bg: 'bg-red-400/10',     ring: 'text-red-400' },
}

const CATEGORY_LABELS: Partial<Record<IssueCategory, string>> = {
  STRUCTURAL:          'Structure',
  DATE_TIMELINE:       'Dates & Timeline',
  ELIGIBILITY:         'Eligibility',
  ENTRY_MECHANIC:      'Entry Mechanic',
  PRIZE:               'Prize',
  DRAW_MECHANICS:      'Draw Mechanics',
  WINNER_NOTIFICATION: 'Winner Notification',
  UNCLAIMED_PRIZE:     'Unclaimed Prizes',
  TRAVEL_PRIZE:        'Travel Prize',
  EVENT_PRIZE:         'Event Prize',
  PRIVACY_LIABILITY:   'Privacy & Liability',
  BUILDER_MISMATCH:    'Builder Mismatch',
}

// ─── Presence config ──────────────────────────

const PRESENCE_CONFIG: Record<PresenceState, { label: string; color: string; bg: string; dot: string }> = {
  strong:   { label: 'Strong',    color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  embedded: { label: 'Embedded',  color: 'text-sky-400',     bg: 'bg-sky-400/10 border-sky-400/20',         dot: 'bg-sky-400' },
  partial:  { label: 'Partial',   color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',     dot: 'bg-amber-400' },
  absent:   { label: 'Absent',    color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',         dot: 'bg-red-400' },
}

const RECOMMENDATION_CONFIG: Record<RecommendationCode, { icon: string; color: string; bg: string; border: string }> = {
  refine_existing_terms:        { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-500/[0.06]', border: 'border-emerald-500/20' },
  normalize_into_turnstyle:     { icon: '⟳', color: 'text-sky-400',     bg: 'bg-sky-500/[0.06]',     border: 'border-sky-500/20' },
  complete_rebuild_recommended: { icon: '↺', color: 'text-amber-400',   bg: 'bg-amber-500/[0.06]',   border: 'border-amber-500/20' },
}

const CONFIDENCE_CONFIG: Record<ExtractionConfidence, { color: string; label: string }> = {
  high:   { color: 'text-emerald-400', label: 'High' },
  medium: { color: 'text-amber-400',   label: 'Med' },
  low:    { color: 'text-orange-400',  label: 'Low' },
  none:   { color: 'text-white/20',    label: '—' },
}

// ─── Sub-components ───────────────────────────

function ScoreDial({ score, band }: { score: number; band: string }) {
  const cfg = RISK_BAND_CONFIG[band] ?? RISK_BAND_CONFIG.NOT_READY
  const radius = 52
  const circ = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score))
  const offset = circ * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cfg.ring}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${cfg.color}`}>{score}</span>
          <span className="text-white/30 text-xs">/100</span>
        </div>
      </div>
      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    </div>
  )
}

function IssuePill({ sev }: { sev: IssueSeverity }) {
  const cfg = SEV[sev]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function IssueCard({ issue }: { issue: PreflightIssue }) {
  const cfg = SEV[issue.severity]
  return (
    <div className={`border rounded-xl p-4 space-y-2 ${cfg.bg}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <IssuePill sev={issue.severity} />
          <span className="text-white/30 text-[10px] font-mono">{issue.ruleId}</span>
        </div>
        {issue.affectedClause && (
          <span className="text-white/25 text-[10px] font-mono">{issue.affectedClause}</span>
        )}
      </div>
      <p className="text-white/80 text-sm font-semibold">{issue.title}</p>
      <p className="text-white/50 text-xs leading-relaxed">{issue.description}</p>
      {issue.suggestedFix && (
        <p className="text-white/35 text-xs leading-relaxed">
          <span className="text-white/20 font-semibold mr-1">Fix →</span>
          {issue.suggestedFix}
        </p>
      )}
      {issue.suggestedRewrite && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 mt-1">
          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-1">Suggested rewrite</p>
          <p className="text-white/50 text-xs leading-relaxed italic">{issue.suggestedRewrite}</p>
        </div>
      )}
    </div>
  )
}

function ConceptCard({ concept }: { concept: ConceptReview }) {
  const cfg = PRESENCE_CONFIG[concept.presence]
  return (
    <div className={`border rounded-xl p-3 space-y-2 ${cfg.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white/70 text-xs font-semibold">{concept.label}</span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
      {concept.gaps.length > 0 && (
        <ul className="space-y-0.5">
          {concept.gaps.map((g, i) => (
            <li key={i} className="text-amber-400/70 text-[10px] flex items-start gap-1">
              <span className="mt-0.5 shrink-0">·</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      )}
      {concept.notes.map((n, i) => (
        <p key={i} className="text-white/25 text-[10px]">{n}</p>
      ))}
    </div>
  )
}

function ExtractedFieldRow<T>({ label, field }: { label: string; field: ExtractedField<T> | undefined }) {
  if (!field) return null
  const cfg = CONFIDENCE_CONFIG[field.confidence]
  const displayValue = field.value === null
    ? '—'
    : Array.isArray(field.value)
      ? (field.value as unknown[]).join(', ')
      : typeof field.value === 'object' && field.value !== null
        ? JSON.stringify(field.value)
        : String(field.value)

  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-white/30 text-xs w-40 shrink-0">{label}</span>
      <span className={`text-xs flex-1 ${field.confidence === 'none' ? 'text-white/20 italic' : 'text-white/60'}`}>
        {displayValue}
      </span>
      <span className={`text-[10px] font-bold shrink-0 ${cfg.color}`}>{cfg.label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────

interface Props {
  report: PreflightReport
  filename: string
  wordCount: number
  uploadedAt: string
  extraction: ExtractedCampaignSchema | null
  review: DocumentReview | null
  draftSeed: CampaignDraftSeed | null
}

export function PreflightUploadReportView({
  report,
  filename,
  wordCount,
  uploadedAt,
  extraction,
  review,
  draftSeed,
}: Props) {
  const { score, summary, issues, missingClauses } = report
  const bandCfg = RISK_BAND_CONFIG[score.riskBand] ?? RISK_BAND_CONFIG.NOT_READY

  // Group issues by category
  const grouped = issues.reduce<Record<string, PreflightIssue[]>>((acc, issue) => {
    const key = CATEGORY_LABELS[issue.category] ?? issue.category
    ;(acc[key] ??= []).push(issue)
    return acc
  }, {})

  const groupedEntries = Object.entries(grouped).sort((a, b) => {
    const aHasCrit = a[1].some(i => i.severity === 'CRITICAL')
    const bHasCrit = b[1].some(i => i.severity === 'CRITICAL')
    if (aHasCrit && !bHasCrit) return -1
    if (!aHasCrit && bHasCrit) return 1
    return 0
  })

  const rec = review?.recommendation
  const recCfg = rec ? (RECOMMENDATION_CONFIG[rec.code] ?? RECOMMENDATION_CONFIG.normalize_into_turnstyle) : null

  return (
    <div className="space-y-8">

      {/* ── Recommendation banner ── */}
      {rec && recCfg && (
        <div className={`border rounded-2xl p-6 space-y-4 ${recCfg.bg} ${recCfg.border}`}>
          <div className="flex items-start gap-4">
            <span className={`text-2xl font-black ${recCfg.color} mt-0.5`}>{recCfg.icon}</span>
            <div className="flex-1 space-y-1">
              <p className={`text-base font-black ${recCfg.color}`}>{rec.headline}</p>
              <p className="text-white/50 text-sm leading-relaxed">{rec.rationale}</p>
            </div>
            {review.isSeedable && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/40">
                Seedable
              </span>
            )}
          </div>
          {rec.actions.length > 0 && (
            <ul className="space-y-1 pl-10">
              {rec.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                  <span className={`shrink-0 font-bold ${recCfg.color}`}>{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Concept review grid ── */}
      {review && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider">
              Concept Review
            </h3>
            {/* Presence summary pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['strong', 'embedded', 'partial', 'absent'] as PresenceState[]).map((s) => {
                const count = review.presenceSummary[s]
                if (count === 0) return null
                const cfg = PRESENCE_CONFIG[s]
                return (
                  <span key={s} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {count} {cfg.label}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {review.concepts
              .filter((c) => !c.conditional || c.conditionMet)
              .map((concept) => (
                <ConceptCard key={concept.conceptId} concept={concept} />
              ))}
          </div>

          {/* Conditional concepts not triggered */}
          {review.concepts.some((c) => c.conditional && !c.conditionMet) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
              <span className="text-white/20 text-[10px] font-semibold uppercase tracking-wider w-full">Conditional (not applicable)</span>
              {review.concepts
                .filter((c) => c.conditional && !c.conditionMet)
                .map((c) => (
                  <span key={c.conceptId} className="text-[10px] text-white/20 border border-white/[0.06] px-2 py-0.5 rounded-full">
                    {c.label}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Composite score ── */}
      {review?.compositeScore && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider">
              Composite Score
            </h3>
            <span className={`text-2xl font-black ${
              review.compositeScore.total >= 80 ? 'text-emerald-400'
              : review.compositeScore.total >= 60 ? 'text-amber-400'
              : 'text-red-400'
            }`}>
              {review.compositeScore.total}<span className="text-white/20 text-sm font-normal">/100</span>
            </span>
          </div>
          <div className="space-y-3">
            {review.compositeScore.breakdown.map((b) => (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{b.label}</span>
                  <span className="text-white/30">{b.raw}/100 <span className="text-white/15">× {b.weight}%</span></span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={[
                      'h-full rounded-full transition-all',
                      b.raw >= 80 ? 'bg-emerald-400' : b.raw >= 55 ? 'bg-amber-400' : 'bg-red-400',
                    ].join(' ')}
                    style={{ width: `${b.raw}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/20 text-[10px]">
            Weighted: Component Completeness 60% · Drafting Quality 25% · Commercial Clarity 15%
          </p>
        </div>
      )}

      {/* ── Extracted data panel ── */}
      {extraction && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider">
              Extracted Data
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-white/25">
              <span>{extraction.diagnostics.highConfidenceCount} high</span>
              <span>{extraction.diagnostics.mediumConfidenceCount} medium</span>
              <span>{extraction.diagnostics.lowConfidenceCount} low</span>
              <span>{extraction.diagnostics.noneCount} missing</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
            {/* Column 1: Identity + Timing */}
            <div>
              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-2">Identity</p>
              <ExtractedFieldRow label="Campaign name" field={extraction.core.campaignName} />
              <ExtractedFieldRow label="Promoter" field={extraction.core.promoterName} />
              <ExtractedFieldRow label="ABN" field={extraction.core.promoterAbn} />
              <ExtractedFieldRow label="Website" field={extraction.core.website} />
              <ExtractedFieldRow label="Jurisdiction" field={extraction.core.jurisdiction} />
              <ExtractedFieldRow label="Promotion type" field={extraction.core.promotionType} />

              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4">Timing</p>
              <ExtractedFieldRow label="Promo start" field={extraction.timing.promotionStart} />
              <ExtractedFieldRow label="Promo end" field={extraction.timing.promotionEnd} />
              <ExtractedFieldRow label="Draw date" field={extraction.timing.drawDate} />
              <ExtractedFieldRow label="Draw time" field={extraction.timing.drawTime} />
              <ExtractedFieldRow label="Draw location" field={extraction.timing.drawLocation} />
              <ExtractedFieldRow label="Claim deadline" field={extraction.timing.claimDeadline} />
            </div>

            {/* Column 2: Entry + Prizes + Compliance */}
            <div>
              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-2">Eligibility &amp; Entry</p>
              <ExtractedFieldRow label="Min age" field={extraction.eligibilityAndEntry.ageMinimum} />
              <ExtractedFieldRow label="Minors permitted" field={extraction.eligibilityAndEntry.minorsPermitted} />
              <ExtractedFieldRow label="Purchase required" field={extraction.eligibilityAndEntry.purchaseRequired} />
              <ExtractedFieldRow label="Purchase threshold" field={extraction.eligibilityAndEntry.purchaseThreshold} />
              <ExtractedFieldRow label="Entry limit" field={extraction.eligibilityAndEntry.entryLimit} />
              <ExtractedFieldRow label="Loyalty required" field={extraction.eligibilityAndEntry.loyaltyRequired} />

              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4">Prizes</p>
              <ExtractedFieldRow label="Total prize pool" field={extraction.prizeModel.totalPrizePool} />
              <ExtractedFieldRow label="No. of winners" field={extraction.prizeModel.numberOfWinners} />
              {extraction.prizeModel.prizes.slice(0, 3).map((p, i) => (
                <ExtractedFieldRow key={i} label={`Prize ${p.rank}`} field={p.description} />
              ))}

              <p className="text-white/20 text-[10px] font-semibold uppercase tracking-wider mb-2 mt-4">Compliance</p>
              <ExtractedFieldRow label="Permit numbers" field={extraction.compliance.permitNumbers} />
              <ExtractedFieldRow label="Permit states" field={extraction.compliance.permitStates} />
              <ExtractedFieldRow label="Notification" field={extraction.compliance.notificationMethod} />
              <ExtractedFieldRow label="Privacy URL" field={extraction.compliance.privacyPolicyUrl} />
              <ExtractedFieldRow label="GST treatment" field={extraction.compliance.gstTreatment} />
            </div>
          </div>

          {/* Diagnostics warnings */}
          {extraction.diagnostics.warnings.length > 0 && (
            <div className="pt-3 border-t border-white/[0.04] space-y-1">
              {extraction.diagnostics.warnings.map((w, i) => (
                <p key={i} className="text-white/25 text-[10px] flex items-start gap-1.5">
                  <span className="text-amber-400/50 shrink-0">△</span>
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Structural score banner ── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">

          {/* Dial */}
          <ScoreDial score={score.total} band={score.riskBand} />

          {/* Summary stats */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <p className="text-white/40 text-xs mb-1">{filename}</p>
              <p className="text-white/20 text-xs">
                {wordCount.toLocaleString()} words ·{' '}
                {new Date(uploadedAt).toLocaleString('en-AU', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>

            {/* Counts row */}
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {summary.criticalCount > 0 && (
                <div className="flex items-center gap-1.5 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-red-400 text-xs font-bold">{summary.criticalCount} Critical</span>
                </div>
              )}
              {summary.errorCount > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-400/10 border border-orange-400/20 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  <span className="text-orange-400 text-xs font-bold">{summary.errorCount} Error{summary.errorCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {summary.warningCount > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-400 text-xs font-bold">{summary.warningCount} Warning{summary.warningCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {summary.noticeCount > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-400/10 border border-blue-400/20 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-blue-400 text-xs font-bold">{summary.noticeCount} Notice{summary.noticeCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {issues.length === 0 && (
                <div className="flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 text-xs font-bold">No issues found</span>
                </div>
              )}
            </div>

            {/* Publish readiness */}
            <p className={`text-sm font-semibold ${bandCfg.color}`}>
              {summary.isPublishReady
                ? '✓ Document-mode checks passed — no critical or blocking issues detected.'
                : `${summary.criticalCount + summary.errorCount} blocking issue${summary.criticalCount + summary.errorCount !== 1 ? 's' : ''} require attention before distribution.`}
            </p>

            {/* Document-only notice */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
              <p className="text-white/25 text-xs leading-relaxed">
                <span className="text-white/35 font-semibold">Document mode</span> — date consistency,
                prize pool maths and builder-vs-terms mismatch checks were skipped.
                Link this document to a campaign for a full check.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Missing clauses ── */}
      {missingClauses.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider">
            Missing Clauses ({missingClauses.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingClauses.map((c) => (
              <span
                key={c}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400"
              >
                {c.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <p className="text-white/25 text-xs">
            These required clause types were not detected by the structural checker.
            The Concept Review above may show them as embedded if present under non-standard headings.
          </p>
        </div>
      )}

      {/* ── Issues by category ── */}
      {groupedEntries.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">
            Structural Issues ({issues.length})
          </h3>
          {groupedEntries.map(([cat, catIssues]) => (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-white/60 text-xs font-bold uppercase tracking-wider">{cat}</p>
                <span className="text-white/20 text-xs">({catIssues.length})</span>
              </div>
              <div className="space-y-2">
                {catIssues.map((issue) => (
                  <IssueCard key={issue.ruleId} issue={issue} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-emerald-500/[0.04] border border-emerald-500/10 rounded-2xl p-8 text-center space-y-2">
          <p className="text-emerald-400 text-sm font-semibold">All structural checks passed</p>
          <p className="text-white/30 text-xs">No issues detected in the checks applicable to this document.</p>
        </div>
      )}

      {/* ── Category score breakdown ── */}
      {score.categoryScores.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">
            Structural Category Scores
          </h3>
          <div className="space-y-2">
            {score.categoryScores
              .filter(cs => cs.rawScore < 100)
              .sort((a, b) => a.rawScore - b.rawScore)
              .map((cs) => (
              <div key={cs.category} className="flex items-center gap-3">
                <span className="text-white/40 text-xs w-36 shrink-0 truncate">
                  {CATEGORY_LABELS[cs.category as IssueCategory] ?? cs.category}
                </span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={[
                      'h-full rounded-full transition-all',
                      cs.rawScore >= 90 ? 'bg-emerald-400' : cs.rawScore >= 70 ? 'bg-amber-400' : 'bg-red-400',
                    ].join(' ')}
                    style={{ width: `${cs.rawScore}%` }}
                  />
                </div>
                <span className="text-white/40 text-xs w-8 text-right shrink-0">{cs.rawScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
