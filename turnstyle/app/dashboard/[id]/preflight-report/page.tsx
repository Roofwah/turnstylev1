'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ─── Types (inline to avoid import issues in print page) ─────────────────────

type IssueSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'NOTICE'

interface PreflightIssue {
  ruleId: string
  severity: IssueSeverity
  category: string
  title: string
  description: string
  affectedClause?: string
  suggestedFix?: string
  suggestedRewrite?: string
  sourceLayer: 'rules' | 'ai'
}

interface PreflightReport {
  reportId: string
  campaignId: string
  generatedAt: string
  score: {
    total: number
    riskBand: string
    readinessStatus: string
    categoryScores: {
      category: string
      weight: number
      rawScore: number
      weightedScore: number
      issueCount: { critical: number; error: number; warning: number; notice: number }
    }[]
  }
  issues: PreflightIssue[]
  summary: {
    criticalCount: number
    errorCount: number
    warningCount: number
    noticeCount: number
    isPublishReady: boolean
  }
  aiReviewUsed: boolean
}

// ─── Helpers ──────────────────────────────────

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  CRITICAL: '#e24b4a',
  ERROR:    '#d85a30',
  WARNING:  '#ba7517',
  NOTICE:   '#185fa5',
}

const SEVERITY_BG: Record<IssueSeverity, string> = {
  CRITICAL: '#fcebeb',
  ERROR:    '#faece7',
  WARNING:  '#faeeda',
  NOTICE:   '#e6f1fb',
}

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  EXCELLENT:     { label: 'Excellent',     color: '#1d9e75' },
  LOW_RISK:      { label: 'Low Risk',      color: '#639922' },
  MODERATE_RISK: { label: 'Moderate Risk', color: '#ba7517' },
  HIGH_RISK:     { label: 'High Risk',     color: '#d85a30' },
  NOT_READY:     { label: 'Not Ready',     color: '#e24b4a' },
}

const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURAL:          'Structural completeness',
  DATE_TIMELINE:       'Date & timeline',
  ELIGIBILITY:         'Eligibility',
  ENTRY_MECHANIC:      'Entry mechanic',
  PRIZE:               'Prize clarity',
  DRAW_MECHANICS:      'Draw mechanics',
  WINNER_NOTIFICATION: 'Winner notification',
  UNCLAIMED_PRIZE:     'Unclaimed prizes',
  TRAVEL_PRIZE:        'Travel prize',
  EVENT_PRIZE:         'Event prize',
  PRIVACY_LIABILITY:   'Privacy & liability',
  BUILDER_MISMATCH:    'Builder vs terms',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

// ─── Main component ───────────────────────────

function PreflightPrintInner() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const campaignId   = params.id as string

  const [report, setReport]           = useState<PreflightReport | null>(null)
  const [campaignName, setCampaignName] = useState<string>('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    // Report is passed via sessionStorage to avoid URL size limits
    try {
      const stored = sessionStorage.getItem(`preflight-report-${campaignId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setReport(parsed.report)
        setCampaignName(parsed.campaignName ?? '')
      }
    } catch (e) {
      console.error('Failed to load preflight report from sessionStorage', e)
    }
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    if (!loading && report) {
      // Auto-trigger print after a short delay to allow render
      const timer = setTimeout(() => window.print(), 800)
      return () => clearTimeout(timer)
    }
  }, [loading, report])

  if (loading) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>Loading...</div>
  )

  if (!report) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>
      No preflight report found. Please run preflight from the terms wizard and try again.
    </div>
  )

  const risk          = RISK_CONFIG[report.score.riskBand] ?? RISK_CONFIG.NOT_READY
  const now           = new Date(report.generatedAt)
  const generated     = formatDate(report.generatedAt) + ' · ' + formatTime(report.generatedAt)
  const issuesBySev   = (['CRITICAL', 'ERROR', 'WARNING', 'NOTICE'] as IssueSeverity[])
    .map(sev => ({ sev, items: report.issues.filter(i => i.severity === sev) }))
    .filter(g => g.items.length > 0)

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #1a1a1a; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page { box-shadow: none !important; }
          .issue-block { break-inside: avoid; }
          .print-dark-header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Print / Back buttons */}
      <div className="no-print" style={{ background: '#0a0a0f', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href={`/dashboard/${campaignId}`} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>← Back to Campaign</a>
        <button
          onClick={() => window.print()}
          style={{ marginLeft: 'auto', background: 'white', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Document */}
      <div className="page" style={{ maxWidth: 720, margin: '32px auto', background: '#fff', boxShadow: '0 4px 40px rgba(0,0,0,0.10)', borderRadius: 4 }}>

        {/* Header */}
        <div className="print-dark-header" style={{ background: '#0a0a0f', padding: '32px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <img src="/tstyle.png" alt="Turnstyle" style={{ height: 36, marginBottom: 20 }} />
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Preflight Report</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>{campaignName || campaignId}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>Generated</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{generated}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8, marginBottom: 4 }}>Report ID</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}>{report.reportId.slice(0, 8)}</div>
          </div>
        </div>

        {/* Score block */}
        <div style={{ padding: '28px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Overall score</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: '#0a0a0f', letterSpacing: -3, lineHeight: 1 }}>{report.score.total}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>out of 100</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Risk band</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: risk.color }}>{risk.label}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4, maxWidth: 220 }}>{report.score.readinessStatus}</div>
            <div style={{
              marginTop: 12,
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: report.summary.isPublishReady ? '#eaf3de' : '#fcebeb',
              color: report.summary.isPublishReady ? '#3b6d11' : '#a32d2d',
            }}>
              {report.summary.isPublishReady ? '✓ Ready to publish' : '✕ Not ready to publish'}
            </div>
          </div>
        </div>

        {/* Issue summary counts */}
        <div style={{ padding: '20px 40px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 16 }}>
          {[
            { label: 'Critical', count: report.summary.criticalCount, color: SEVERITY_COLOR.CRITICAL },
            { label: 'Errors',   count: report.summary.errorCount,    color: SEVERITY_COLOR.ERROR },
            { label: 'Warnings', count: report.summary.warningCount,  color: SEVERITY_COLOR.WARNING },
            { label: 'Notices',  count: report.summary.noticeCount,   color: SEVERITY_COLOR.NOTICE },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ flex: 1, background: '#f8f8f8', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Full scorecard — all 12 categories */}
        <div style={{ padding: '24px 40px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>Full scorecard</div>
            <div style={{ fontSize: 11, color: '#bbb' }}>
              {report.score.categoryScores.filter(c => {
                if (c.category === 'TRAVEL_PRIZE' || c.category === 'EVENT_PRIZE') {
                  const t = c.issueCount.critical + c.issueCount.error + c.issueCount.warning + c.issueCount.notice
                  return !(c.rawScore === 100 && t === 0)
                }
                return true
              }).length} compliance categories checked · AI + rules engine
            </div>
          </div>

          {/* Scorecard header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 48px 80px 28px', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Weight</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Score</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Result</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Issues</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {report.score.categoryScores
              .filter(cat => {
                // Exclude travel/event categories if they were never tested
                // (score 100 + zero issues = not applicable, not a pass)
                if (cat.category === 'TRAVEL_PRIZE' || cat.category === 'EVENT_PRIZE') {
                  const total = cat.issueCount.critical + cat.issueCount.error + cat.issueCount.warning + cat.issueCount.notice
                  return !(cat.rawScore === 100 && total === 0)
                }
                return true
              })
              .map((cat, i) => {
              const totalIssues = cat.issueCount.critical + cat.issueCount.error + cat.issueCount.warning + cat.issueCount.notice
              const isPerfect = cat.rawScore === 100
              const barColor = cat.rawScore >= 95 ? '#1d9e75' : cat.rawScore >= 85 ? '#639922' : cat.rawScore >= 70 ? '#ba7517' : '#e24b4a'
              const rowBg = i % 2 === 0 ? '#fff' : '#fafafa'
              return (
                <div key={cat.category} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 48px 48px 80px 28px',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: '1px solid #f5f5f5',
                  background: rowBg,
                  alignItems: 'center',
                }}>
                  {/* Category name */}
                  <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: isPerfect ? 400 : 600 }}>
                    {CATEGORY_LABELS[cat.category] ?? cat.category}
                  </div>

                  {/* Weight */}
                  <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>{cat.weight}%</div>

                  {/* Score with bar */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isPerfect ? '#1d9e75' : barColor }}>{cat.rawScore}</div>
                  </div>

                  {/* Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${cat.rawScore}%`, background: barColor }} />
                    </div>
                  </div>

                  {/* Issue count */}
                  <div style={{ textAlign: 'center' }}>
                    {totalIssues === 0 ? (
                      <span style={{ color: '#1d9e75', fontSize: 12, fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: cat.issueCount.critical > 0 ? '#e24b4a' : cat.issueCount.error > 0 ? '#d85a30' : '#ba7517' }}>
                        {totalIssues}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scorecard total row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 48px 48px 80px 28px',
            gap: 8,
            padding: '12px 0 0',
            borderTop: '2px solid #0a0a0f',
            marginTop: 4,
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0a0a0f' }}>Overall</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0f', textAlign: 'center' }}>100%</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: risk.color, textAlign: 'center' }}>{report.score.total}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${report.score.total}%`, background: risk.color }} />
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#0a0a0f' }}>
              {report.summary.criticalCount + report.summary.errorCount + report.summary.warningCount + report.summary.noticeCount}
            </div>
          </div>

          {/* Legend */}
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { color: '#1d9e75', label: 'Excellent (95–100)' },
              { color: '#639922', label: 'Good (85–94)' },
              { color: '#ba7517', label: 'Moderate (70–84)' },
              { color: '#e24b4a', label: 'Needs work (<70)' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#999' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issues */}
        <div style={{ padding: '24px 40px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#999', marginBottom: 16 }}>Issues found</div>
          {issuesBySev.length === 0 ? (
            <div style={{ padding: '24px', background: '#eaf3de', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#3b6d11' }}>No issues found — terms passed all checks</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {issuesBySev.map(({ sev, items }) => (
                <div key={sev}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: SEVERITY_COLOR[sev], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {sev} · {items.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(issue => (
                      <div key={issue.ruleId} className="issue-block" style={{
                        background: SEVERITY_BG[issue.severity],
                        borderRadius: 6,
                        padding: '14px 16px',
                        borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity]}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: SEVERITY_COLOR[issue.severity] }}>{issue.title}</span>
                          <span style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{issue.ruleId}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6, marginBottom: issue.suggestedFix ? 8 : 0 }}>
                          {issue.description}
                        </div>
                        {issue.suggestedFix && (
                          <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
                            <span style={{ fontWeight: 700 }}>Fix: </span>{issue.suggestedFix}
                          </div>
                        )}
                        {issue.suggestedRewrite && (
                          <div style={{ fontSize: 11, color: '#555', marginTop: 6, fontStyle: 'italic', borderLeft: '2px solid #ccc', paddingLeft: 8 }}>
                            <span style={{ fontWeight: 700, fontStyle: 'normal' }}>Rewrite: </span>{issue.suggestedRewrite}
                          </div>
                        )}
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          {issue.affectedClause && (
                            <span style={{ fontSize: 10, color: '#999', background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '2px 6px' }}>
                              Clause: {issue.affectedClause}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: '#999', background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '2px 6px' }}>
                            {issue.sourceLayer === 'ai' ? 'AI review' : 'Rules engine'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 40px 28px', borderTop: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
            This preflight report is a compliance-oriented drafting quality review, not legal advice.
            Issues should be reviewed by a qualified legal professional before publication.
          </p>
          <p style={{ fontSize: 10, color: '#ddd', marginTop: 6 }}>
            Turnstyle Preflight · Flow Marketing · {report.reportId}
          </p>
        </div>

      </div>
      <div style={{ height: 48 }} />
    </>
  )
}

export default function PreflightPrintPage() {
  return (
    <Suspense fallback={<div style={{ fontFamily: 'sans-serif', padding: 40, color: '#666' }}>Loading...</div>}>
      <PreflightPrintInner />
    </Suspense>
  )
}
