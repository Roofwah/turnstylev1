// ─────────────────────────────────────────────
// Turnstyle Preflight Upload — Document Normaliser
//
// Real-world .docx T&C documents are NOT in Turnstyle's
// native `\n---\n` section-separated format.  They are
// typically either:
//
//   (a) A two-column Word table (Item | Details), which
//       mammoth flattens to alternating:
//         [Heading line]
//         [blank line]
//         [Body paragraph(s)]
//         [blank line]
//         [Heading line]
//         ...
//
//   (b) A free-form document with bold/heading-styled
//       section titles followed by body text.
//
// Either way, mammoth produces paragraphs separated by
// blank lines, with recognised clause headings appearing
// as short, single-line paragraphs.
//
// This module detects those headings and inserts the
// `\n---\n` separators the classifier expects — without
// modifying the classifier itself.
//
// Turnstyle-generated terms (which already contain ---
// separators) are returned unchanged.
// ─────────────────────────────────────────────

/**
 * Heading patterns — superset of the classifier's CLAUSE_PATTERNS,
 * extended to cover real-world Australian T&C heading variations.
 *
 * A line must match at least one of these to be treated as a
 * section boundary.  False positives from body text are prevented
 * by also requiring the paragraph to be a single short line.
 */
const HEADING_PATTERNS: RegExp[] = [
  // Promoter
  /^promoter$/i,

  // Promotional / Promotion Period
  /^promotion(?:al)?\s+period$/i,

  // Eligibility
  /^(who\s+can\s+enter|eligibilit)/i,
  /^who\s+is\s+ineligible/i,
  /^(participant\s+eligibility|eligible\s+entrant)/i,

  // Entry mechanic
  /^(how\s+to\s+enter|entry\s+method|entry\s+mechanic|how\s+often|additionals)/i,
  /^entry\s+(detail|period|type)/i,

  // Prize
  /^(what\s+you\s+could\s+win|prize|prizes|total\s+prize\s+pool)/i,
  /^prize\s+(detail|description|structure|value|winner)/i,
  /^prize\s+pool/i,

  // Draw
  /^(number\s+of\s+winners|draw\s+(method|mechanic|date|detail|schedule))/i,
  /^(how\s+.*\s+winner.*\s+selected|winner\s+selection)/i,

  // Travel conditions
  /^travel\s+prize\s+conditions?/i,
  /^travel\s+(detail|condition|term)/i,

  // Event conditions
  /^event\s+prize\s+conditions?/i,
  /^event\s+(detail|condition|term)/i,

  // Winner notification
  /^winner\s+notification/i,
  /^(how\s+will\s+the\s+winner|notification\s+of\s+winner)/i,
  /^contacting\s+the\s+winner/i,

  // Unclaimed prizes
  /^unclaimed\s+prize/i,
  /^(unclaimed|outstanding)\s+(prize|award)/i,

  // Privacy / Miscellaneous
  /^(privacy|personal\s+information|miscellaneous)/i,
  /^(privacy\s+policy|privacy\s+notice)/i,

  // Liability
  /^(liability|limitation\s+of\s+liability|exclusion\s+of\s+liability)/i,
  /^(indemnit|responsibilit)/i,

  // Permits
  /^permit\s+numbers?$/i,
  /^(permit|authoris|licen[cs]e)/i,

  // Miscellaneous / administrative
  /^(acceptance\s+of\s+terms|acceptance)$/i,
  /^promotion\s+type$/i,
  /^website$/i,
  /^(where\s+is\s+it\s+operating|jurisdiction|governing\s+law)/i,
  /^(general\s+condition|general\s+term|additional\s+term)/i,
]

function isKnownHeading(line: string): boolean {
  const trimmed = line.trim()
  // Headings are short single lines
  if (!trimmed || trimmed.length > 100) return false
  // Body sentences end with a period; headings don't
  // (questions ending in ? and headings ending in ) are still valid)
  if (trimmed.endsWith('.')) return false
  return HEADING_PATTERNS.some((p) => p.test(trimmed))
}

/**
 * Converts external document plain text into the Turnstyle classifier's
 * expected `\n---\n`-separated section format.
 *
 * If the text already contains `\n---\n` (i.e. Turnstyle-generated),
 * it is returned unchanged.
 */
export function normaliseForClassifier(rawText: string): string {
  // ── Passthrough for Turnstyle-generated terms ──
  if (rawText.includes('\n---\n')) return rawText

  // ── Split into blank-line-delimited paragraphs ──
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const sections: Array<{ heading: string; bodyParts: string[] }> = []
  let current: { heading: string; bodyParts: string[] } | null = null

  for (const para of paragraphs) {
    const lines = para.split('\n')
    const firstLine = lines[0].trim()
    const isSingleLine = lines.length === 1

    if (isSingleLine && isKnownHeading(firstLine)) {
      // Start a new section
      if (current) sections.push(current)
      current = { heading: firstLine, bodyParts: [] }
    } else if (current) {
      // Accumulate body under current heading
      current.bodyParts.push(para)
    }
    // Paragraphs before the first recognised heading (document title,
    // table column headers like "Item" / "Details", etc.) are silently
    // dropped — they carry no compliance-relevant content.
  }

  if (current) sections.push(current)

  if (sections.length === 0) {
    // No recognisable headings found — return raw text so the classifier
    // can attempt its own parsing rather than returning an empty document.
    return rawText
  }

  return sections
    .map((s) => `${s.heading}\n\n${s.bodyParts.join('\n\n')}`)
    .join('\n\n---\n\n')
}
