// ─────────────────────────────────────────────
// Turnstyle Preflight — Clause Classifier
// Extracts named sections from raw terms text
// No AI required — heading pattern matching
// ─────────────────────────────────────────────

import { Clause, ClauseType, TermsDocument } from './types'

// Maps heading patterns → clause types
const CLAUSE_PATTERNS: { pattern: RegExp; type: ClauseType }[] = [
  { pattern: /^promoter$/i,                                         type: 'promoter' },
  { pattern: /^promotional\s+period$/i,                             type: 'promotional_period' },
  { pattern: /^(who\s+can\s+enter|eligibilit)/i,                   type: 'eligibility' },
  { pattern: /^who\s+is\s+ineligible/i,                            type: 'eligibility' },
  { pattern: /^(how\s+to\s+enter|entry\s+method|entry\s+mechanic)/i, type: 'entry_mechanic' },
  { pattern: /^(what\s+you\s+could\s+win|prize|prizes|total\s+prize\s+pool)/i, type: 'prize_description' },
  { pattern: /^(number\s+of\s+winners|how.*selected|draw)/i,       type: 'draw_mechanics' },
  { pattern: /^travel\s+prize\s+condition/i,                       type: 'travel_conditions' },
  { pattern: /^event\s+prize\s+condition/i,                        type: 'event_conditions' },
  { pattern: /^winner\s+notification/i,                            type: 'winner_notification' },
  { pattern: /^unclaimed\s+prize/i,                                type: 'unclaimed_prizes' },
  { pattern: /^(privacy|personal\s+information|miscellaneous)/i,   type: 'privacy' },
  { pattern: /^(liability|limitation)/i,                           type: 'liability' },
  { pattern: /^permit\s+number/i,                                  type: 'permits' },
  { pattern: /^(how\s+often|additionals)/i,                        type: 'entry_mechanic' },
  { pattern: /^(acceptance|promotion\s+type|website|where\s+is)/i, type: 'miscellaneous' },
]

function detectClauseType(heading: string): ClauseType {
  for (const { pattern, type } of CLAUSE_PATTERNS) {
    if (pattern.test(heading.trim())) return type
  }
  return 'unknown'
}

export function classifyClauses(rawText: string, campaignId: string): TermsDocument {
  const clauses: Clause[] = []

  // Terms format: sections separated by '---' dividers
  // Each section: heading on first line, blank line, then body text
  // e.g. "Promoter\n\nRepco Australia...\n\n---\n\nPromotional Period\n\n..."
  const sections = rawText.split(/\n\s*---\s*\n/)

  let charIndex = 0

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed) { charIndex += section.length + 5; continue }

    // First non-empty line is the heading
    const sectionLines = trimmed.split('\n')
    const heading = sectionLines[0].trim()

    // Everything after the heading (skip blank line) is the body
    const body = sectionLines.slice(1).join('\n').trim()

    if (!heading) { charIndex += section.length + 5; continue }

    const startIndex = charIndex
    const endIndex = charIndex + section.length

    clauses.push({
      id: `clause-${clauses.length + 1}`,
      type: detectClauseType(heading),
      heading,
      body,
      startIndex,
      endIndex,
    })

    charIndex = endIndex + 5 // account for '\n---\n'
  }

  return {
    campaignId,
    rawText,
    clauses,
    wordCount: rawText.split(/\s+/).filter(Boolean).length,
    generatedAt: new Date(),
  }
}

// Returns which expected clause types are missing
export function findMissingClauses(
  doc: TermsDocument,
  hasTravelPrize: boolean,
  hasEventPrize: boolean,
  isChance: boolean
): ClauseType[] {
  const found = new Set(doc.clauses.map((c) => c.type))
  const missing: ClauseType[] = []

  const required: ClauseType[] = [
    'promoter',
    'promotional_period',
    'eligibility',
    'entry_mechanic',
    'prize_description',
    'winner_notification',
    'unclaimed_prizes',
    'privacy',
  ]

  if (isChance) required.push('draw_mechanics')
  if (hasTravelPrize) required.push('travel_conditions')
  if (hasEventPrize) required.push('event_conditions')

  for (const type of required) {
    if (!found.has(type)) missing.push(type)
  }

  return missing
}

// Extracts body text for a specific clause type
export function getClauseBody(doc: TermsDocument, type: ClauseType): string | null {
  return doc.clauses.find((c) => c.type === type)?.body ?? null
}
