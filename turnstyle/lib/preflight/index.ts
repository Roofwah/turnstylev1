// ─────────────────────────────────────────────
// Turnstyle Preflight — Main Orchestrator
// Drop this into /app/actions/runPreflight.ts
// ─────────────────────────────────────────────
// 'use server'   ← uncomment when moving to /app/actions/

import { randomUUID } from 'crypto'
import {
  CampaignBuilderInput,
  PreflightReport,
  PreflightIssue,
  ClauseType,
} from './types'
import { classifyClauses, findMissingClauses } from './classifier'
import { runRules } from './rules/index'
import { calculateScore } from './scorer'
import { runAiReview } from './aiReview'

// ─── Missing clause → issue converter ────────

function missingClauseIssues(missing: ClauseType[]): PreflightIssue[] {
  const labels: Record<ClauseType, string> = {
    promoter:           'Promoter clause',
    promotional_period: 'Promotional period clause',
    eligibility:        'Eligibility clause',
    entry_mechanic:     'Entry mechanic clause',
    prize_description:  'Prize description clause',
    draw_mechanics:     'Draw mechanics clause',
    travel_conditions:  'Travel prize conditions clause',
    event_conditions:   'Event prize conditions clause',
    winner_notification:'Winner notification clause',
    unclaimed_prizes:   'Unclaimed prizes clause',
    privacy:            'Privacy clause',
    liability:          'Liability clause',
    permits:            'Permit numbers clause',
    miscellaneous:      'Miscellaneous provisions clause',
    unknown:            'Unknown clause',
  }

  return missing.map((type) => ({
    ruleId: `RULE-MISSING-${type.toUpperCase().replace(/_/g, '-')}`,
    severity: 'CRITICAL' as const,
    category: 'STRUCTURAL' as const,
    title: `Missing clause: ${labels[type] ?? type}`,
    description: `The ${labels[type] ?? type} was not found in the generated terms.`,
    affectedClause: type,
    suggestedFix: `Add a ${labels[type] ?? type} to the terms.`,
    sourceLayer: 'rules' as const,
  }))
}

// ─── Build summary ────────────────────────────

function buildSummary(issues: PreflightIssue[]) {
  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
  const errorCount    = issues.filter((i) => i.severity === 'ERROR').length
  const warningCount  = issues.filter((i) => i.severity === 'WARNING').length
  const noticeCount   = issues.filter((i) => i.severity === 'NOTICE').length

  // Top issues: all criticals first, then errors, capped at 3
  const topIssues = [
    ...issues.filter((i) => i.severity === 'CRITICAL'),
    ...issues.filter((i) => i.severity === 'ERROR'),
  ].slice(0, 3)

  return {
    criticalCount,
    errorCount,
    warningCount,
    noticeCount,
    isPublishReady: criticalCount === 0 && errorCount === 0,
    topIssues,
  }
}

// ─── Main function ────────────────────────────

export async function runPreflight(
  builder: CampaignBuilderInput,
  rawTermsText: string,
  options: { skipAiReview?: boolean; documentOnly?: boolean } = {}
): Promise<PreflightReport> {
  // ── Layer 1: Classify clauses ──────────────
  const doc = classifyClauses(rawTermsText, builder.campaignId)

  // ── Layer 2: Find structurally missing clauses
  const missingClauses = findMissingClauses(
    doc,
    builder.hasTravelPrize,
    builder.hasEventPrize,
    builder.promotionType === 'chance'
  )
  const missingIssues = missingClauseIssues(missingClauses)

  // ── Layer 3: Run deterministic rules ───────
  // documentOnly: true restricts to text-safe rules only (upload preflight path)
  const ruleIssues = runRules(builder, doc, { documentOnly: options.documentOnly })

  // ── Layer 4: AI review (optional, default on)
  let aiIssues: PreflightIssue[] = []
  let aiTokensUsed = 0

  if (!options.skipAiReview) {
    try {
      const { issues, tokensUsed } = await runAiReview(builder, doc)
      aiIssues = issues
      aiTokensUsed = tokensUsed
    } catch (err) {
      console.error('[runPreflight] AI review failed, continuing without it:', err)
    }
  }

  // ── Combine all issues ─────────────────────
  const allIssues: PreflightIssue[] = [
    ...missingIssues,
    ...ruleIssues,
    ...aiIssues,
  ]

  // ── Score ───────────────────────────────────
  const score = calculateScore(allIssues)

  // ── Builder mismatches (surfaced separately) 
  const builderMismatches = allIssues.filter(
    (i) => i.category === 'BUILDER_MISMATCH'
  )

  return {
    reportId: randomUUID(),
    campaignId: builder.campaignId,
    generatedAt: new Date(),
    score,
    issues: allIssues,
    missingClauses,
    builderMismatches,
    summary: buildSummary(allIssues),
    aiReviewUsed: !options.skipAiReview && aiIssues.length >= 0,
    aiReviewTokensUsed: aiTokensUsed || undefined,
  }
}
