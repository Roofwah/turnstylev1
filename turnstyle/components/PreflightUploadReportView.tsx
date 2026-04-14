'use client'

// ─────────────────────────────────────────────
// Turnstyle — Preflight Upload Report Component
//
// Renders a PreflightReport that came from the document
// upload path.  Self-contained — no campaign context.
// ─────────────────────────────────────────────

import type { PreflightReport, PreflightIssue, IssueSeverity, IssueCategory } from '@/lib/preflight/types'

// ─── Severity config ──────────────────────────

const SEV: Record<IssueSeverity, { label: string; color: string; bg: string; dot: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20',    dot: 'bg-red-400' },
  ERROR:    { label: 'Error',    color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', dot: 'bg-orange-400' },
  WARNING:  { label: 'Warning',  color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20',  dot: 'bg-amber-400' },
  NOTICE:   { label: 'Notice',   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20',    dot: 'bg-blue-400' },
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

// ─── Helpers ──────────────────────────────────

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

// ─── Main component ───────────────────────────

interface Props {
  report: PreflightReport
  filename: string
  wordCount: number
  uploadedAt: string
}

export function PreflightUploadReportView({ report, filename, wordCount, uploadedAt }: Props) {
  const { score, summary, issues, missingClauses } = report
  const bandCfg = RISK_BAND_CONFIG[score.riskBand] ?? RISK_BAND_CONFIG.NOT_READY

  // Group issues by category
  const grouped = issues.reduce<Record<string, PreflightIssue[]>>((acc, issue) => {
    const key = CATEGORY_LABELS[issue.category] ?? issue.category
    ;(acc[key] ??= []).push(issue)
    return acc
  }, {})

  const groupedEntries = Object.entries(grouped).sort((a, b) => {
    // Sort: CRITICAL categories first
    const aHasCrit = a[1].some(i => i.severity === 'CRITICAL')
    const bHasCrit = b[1].some(i => i.severity === 'CRITICAL')
    if (aHasCrit && !bHasCrit) return -1
    if (!aHasCrit && bHasCrit) return 1
    return 0
  })

  return (
    <div className="space-y-8">

      {/* ── Score banner ── */}
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
            These required clause types were not detected in the document. They may be present
            under non-standard headings — review the document manually if unexpected.
          </p>
        </div>
      )}

      {/* ── Issues by category ── */}
      {groupedEntries.length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">
            Issues ({issues.length})
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
          <p className="text-emerald-400 text-sm font-semibold">All document-mode checks passed</p>
          <p className="text-white/30 text-xs">No issues detected in the checks applicable to this document.</p>
        </div>
      )}

      {/* ── Category score breakdown ── */}
      {score.categoryScores.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
          <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">
            Category Scores
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
                      cs.rawScore >= 90 ? 'bg-emerald-400'
                      : cs.rawScore >= 70 ? 'bg-amber-400'
                      : 'bg-red-400',
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
