// ─────────────────────────────────────────────
// Turnstyle Preflight — Score Aggregator
// ─────────────────────────────────────────────

import {
  PreflightIssue,
  PreflightScore,
  CategoryScore,
  IssueCategory,
  IssueSeverity,
  RiskBand,
} from './types'

// Penalty per severity
const SEVERITY_PENALTY: Record<IssueSeverity, number> = {
  CRITICAL: 20,
  ERROR:    10,
  WARNING:   5,
  NOTICE:    2,
}

// Category weights (must sum to 100)
const CATEGORY_WEIGHTS: Record<string, number> = {
  STRUCTURAL:          15,
  DATE_TIMELINE:       10,
  ELIGIBILITY:         10,
  ENTRY_MECHANIC:      10,
  PRIZE:               10,
  DRAW_MECHANICS:      10,
  WINNER_NOTIFICATION:  8,
  UNCLAIMED_PRIZE:      8,
  TRAVEL_PRIZE:         5,
  EVENT_PRIZE:          3,
  PRIVACY_LIABILITY:    6,
  BUILDER_MISMATCH:     5,
}

// Map issue category → scoring category
const CATEGORY_MAP: Record<IssueCategory, string> = {
  STRUCTURAL:          'STRUCTURAL',
  DATE_TIMELINE:       'DATE_TIMELINE',
  ELIGIBILITY:         'ELIGIBILITY',
  ENTRY_MECHANIC:      'ENTRY_MECHANIC',
  PRIZE:               'PRIZE',
  DRAW_MECHANICS:      'DRAW_MECHANICS',
  WINNER_NOTIFICATION: 'WINNER_NOTIFICATION',
  UNCLAIMED_PRIZE:     'UNCLAIMED_PRIZE',
  TRAVEL_PRIZE:        'TRAVEL_PRIZE',
  EVENT_PRIZE:         'EVENT_PRIZE',
  PRIVACY_LIABILITY:   'PRIVACY_LIABILITY',
  BUILDER_MISMATCH:    'BUILDER_MISMATCH',
}

function getRiskBand(score: number): RiskBand {
  if (score >= 95) return 'EXCELLENT'
  if (score >= 85) return 'LOW_RISK'
  if (score >= 70) return 'MODERATE_RISK'
  if (score >= 50) return 'HIGH_RISK'
  return 'NOT_READY'
}

function getReadinessStatus(score: number, hasCritical: boolean): string {
  if (hasCritical) return 'Not publish ready — critical issues must be resolved'
  if (score >= 95) return 'Excellent — ready to publish'
  if (score >= 85) return 'Low risk — minor improvements recommended'
  if (score >= 70) return 'Moderate risk — review warnings before publishing'
  if (score >= 50) return 'High risk — significant issues require attention'
  return 'Not ready — major issues must be resolved'
}

export function calculateScore(issues: PreflightIssue[]): PreflightScore {
  // Group issues by scoring category
  const byCategory: Record<string, PreflightIssue[]> = {}
  for (const cat of Object.keys(CATEGORY_WEIGHTS)) {
    byCategory[cat] = []
  }
  for (const issue of issues) {
    const cat = CATEGORY_MAP[issue.category] ?? 'STRUCTURAL'
    byCategory[cat].push(issue)
  }

  // Calculate penalties
  const penaltyBreakdown: PreflightScore['penaltyBreakdown'] = []
  let totalPenalty = 0

  for (const issue of issues) {
    const penalty = SEVERITY_PENALTY[issue.severity]
    totalPenalty += penalty
    penaltyBreakdown.push({ ruleId: issue.ruleId, severity: issue.severity, penalty })
  }

  const total = Math.max(0, Math.min(100, 100 - totalPenalty))

  // Category scores
  const categoryScores: CategoryScore[] = Object.entries(CATEGORY_WEIGHTS).map(
    ([category, weight]) => {
      const catIssues = byCategory[category] ?? []
      const catPenalty = catIssues.reduce((s, i) => s + SEVERITY_PENALTY[i.severity], 0)
      const rawScore = Math.max(0, 100 - catPenalty)
      return {
        category,
        weight,
        rawScore,
        weightedScore: parseFloat(((rawScore * weight) / 100).toFixed(2)),
        issueCount: {
          critical: catIssues.filter((i) => i.severity === 'CRITICAL').length,
          error:    catIssues.filter((i) => i.severity === 'ERROR').length,
          warning:  catIssues.filter((i) => i.severity === 'WARNING').length,
          notice:   catIssues.filter((i) => i.severity === 'NOTICE').length,
        },
      }
    }
  )

  const hasCritical = issues.some((i) => i.severity === 'CRITICAL')

  return {
    total,
    riskBand: getRiskBand(total),
    readinessStatus: getReadinessStatus(total, hasCritical),
    categoryScores,
    penaltyBreakdown,
  }
}
