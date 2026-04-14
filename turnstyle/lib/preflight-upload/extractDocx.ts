// ─────────────────────────────────────────────
// Turnstyle Preflight Upload — .docx Extractor
//
// Uses `mammoth` (pure Node.js, no native deps) to
// extract plain text from a Word document buffer.
//
// Why mammoth:
//   - No subprocess / external binary required
//   - Works in Next.js server actions and API routes
//   - extractRawText() strips all formatting and returns
//     clean UTF-8 text suitable for the preflight classifier
//   - 1M+ weekly downloads, actively maintained
// ─────────────────────────────────────────────

import mammoth from 'mammoth'

export interface DocxExtractionResult {
  /** Plain text content extracted from the document */
  text: string
  /** Number of whitespace-separated words */
  wordCount: number
  /** Rough page estimate at 250 words/page */
  pageEstimate: number
  /** Non-fatal mammoth warnings (e.g. unsupported formatting) */
  warnings: string[]
}

export async function extractTextFromDocx(
  buffer: Buffer
): Promise<DocxExtractionResult> {
  const result = await mammoth.extractRawText({ buffer })

  const text = result.value.trim()

  // Normalise excessive whitespace that mammoth can produce
  // from tables, text boxes, or heading-only sections
  const normalised = text
    .replace(/\r\n/g, '\n')          // Windows line endings
    .replace(/\r/g, '\n')            // Old Mac line endings
    .replace(/\n{4,}/g, '\n\n\n')   // Cap consecutive blank lines at 3

  const words = normalised.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const pageEstimate = Math.max(1, Math.ceil(wordCount / 250))

  const warnings = result.messages
    .filter((m) => m.type === 'warning')
    .map((m) => m.message)

  return {
    text: normalised,
    wordCount,
    pageEstimate,
    warnings,
  }
}
