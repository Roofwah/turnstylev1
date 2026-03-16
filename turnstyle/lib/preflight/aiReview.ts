// ─────────────────────────────────────────────
// Turnstyle Preflight — AI Review Layer
// Qualitative analysis via Claude API
// Only called after deterministic rules pass
// ─────────────────────────────────────────────

import { CampaignBuilderInput, TermsDocument, PreflightIssue } from './types'

const AI_REVIEW_SYSTEM = `You are a senior compliance reviewer specialising in Australian trade promotions.
You review Terms & Conditions for drafting quality, ambiguity, contradictions, and operational risks.

This is NOT legal advice. This is a drafting quality assurance review.

You will be given:
1. Structured campaign data (the builder inputs)
2. Extracted clause content from the generated terms

Your job is to identify issues that deterministic rules CANNOT catch:
- Ambiguous wording that could be interpreted multiple ways
- Contradictory clauses
- Operationally impractical conditions
- Missing nuance for special prize types (travel, event)
- Vague prize descriptions
- Risky promoter discretion wording
- Duplicate wording that creates inconsistency risk
- Readability or drafting quality issues

Return ONLY a valid JSON array of issues. No markdown, no preamble.

Each issue must match this schema:
{
  "ruleId": "AI-001",   // increment per issue
  "severity": "CRITICAL" | "ERROR" | "WARNING" | "NOTICE",
  "category": "STRUCTURAL" | "DATE_TIMELINE" | "ELIGIBILITY" | "ENTRY_MECHANIC" | "PRIZE" | "DRAW_MECHANICS" | "WINNER_NOTIFICATION" | "UNCLAIMED_PRIZE" | "TRAVEL_PRIZE" | "EVENT_PRIZE" | "PRIVACY_LIABILITY" | "BUILDER_MISMATCH",
  "title": "short issue title",
  "description": "specific description of the problem, referencing actual clause wording",
  "affectedClause": "clause type",
  "suggestedFix": "what to do",
  "suggestedRewrite": "optional — replacement wording if applicable"
}

Severity guide:
- CRITICAL: Terms cannot be published as-is
- ERROR: Major issue requiring correction
- WARNING: Should be fixed before launch
- NOTICE: Optional improvement

Focus on issues that matter. Return 3–8 issues maximum. Do not fabricate issues.
If the terms are well-drafted, return a short list or empty array [].`

function buildUserPrompt(
  builder: CampaignBuilderInput,
  doc: TermsDocument
): string {
  // Summarise builder data concisely
  const builderSummary = `
CAMPAIGN BUILDER DATA:
- Promoter: ${builder.promoter}
- Type: ${builder.promotionType} | Trade: ${builder.isTradePromotion}
- States: ${builder.states.join(', ')}
- Period: ${builder.promoStart.toDateString()} → ${builder.promoEnd.toDateString()}
- Draw: ${builder.drawDate?.toDateString() ?? 'N/A'} at ${builder.drawLocation ?? 'N/A'}
- Winners: ${builder.numberOfWinners} | Reserves: ${builder.numberOfReserveEntries ?? 0}
- Prize pool: $${builder.totalPrizePoolIncGst.toFixed(2)} incl. GST
- Travel prize: ${builder.hasTravelPrize} | Event prize: ${builder.hasEventPrize}
- Minors can enter: ${builder.minorsCanEnter} | Min age: ${builder.minAge ?? 'not set'}
- Permit states: ${builder.permitStates.join(', ') || 'none'}
`.trim()

  // Include only the most relevant clauses — keeps tokens low
  const relevantClauses = doc.clauses
    .filter((c) =>
      [
        'prize_description',
        'travel_conditions',
        'eligibility',
        'draw_mechanics',
        'unclaimed_prizes',
        'winner_notification',
      ].includes(c.type)
    )
    .map((c) => `=== ${c.heading.toUpperCase()} ===\n${c.body}`)
    .join('\n\n')

  return `${builderSummary}\n\nEXTRACTED CLAUSES:\n${relevantClauses}`
}

export async function runAiReview(
  builder: CampaignBuilderInput,
  doc: TermsDocument
): Promise<{ issues: PreflightIssue[]; tokensUsed: number }> {
  const userPrompt = buildUserPrompt(builder, doc)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: AI_REVIEW_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
  const text = data.content?.[0]?.text ?? '[]'

  let rawIssues: Partial<PreflightIssue>[]
  try {
    rawIssues = JSON.parse(text)
  } catch {
    console.error('[aiReview] Failed to parse response:', text)
    return { issues: [], tokensUsed }
  }

  const issues: PreflightIssue[] = rawIssues
    .filter((i) => i.ruleId && i.severity && i.title)
    .map((i) => ({
      ruleId: i.ruleId!,
      severity: i.severity!,
      category: i.category ?? 'STRUCTURAL',
      title: i.title!,
      description: i.description ?? '',
      affectedClause: i.affectedClause,
      suggestedFix: i.suggestedFix,
      suggestedRewrite: i.suggestedRewrite,
      sourceLayer: 'ai' as const,
    }))

  return { issues, tokensUsed }
}
