// ─────────────────────────────────────────────
// Turnstyle Preflight Extraction — Shared Helpers
//
// Low-level utilities used by extractors.ts.
// All functions are pure, synchronous and side-effect-free.
// ─────────────────────────────────────────────

import type { EvidenceRef, ExtractedField, ExtractionConfidence } from './types'

// ─── Match helpers ────────────────────────────

export interface MatchResult {
  match: string
  groups: Record<string, string | undefined>
  offset: number
}

/**
 * Returns the first match of `pattern` in `text`, or null.
 * Pattern MUST have the `d` flag for offset tracking, OR we
 * fall back to `index` on the match object.
 */
export function findFirst(pattern: RegExp, text: string): MatchResult | null {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  re.lastIndex = 0
  const m = re.exec(text)
  if (!m) return null
  return {
    match: m[0],
    groups: (m.groups ?? {}) as Record<string, string | undefined>,
    offset: m.index,
  }
}

/** Returns ALL matches of `pattern` in `text`. */
export function findAll(pattern: RegExp, text: string): MatchResult[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  re.lastIndex = 0
  const results: MatchResult[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    results.push({
      match: m[0],
      groups: (m.groups ?? {}) as Record<string, string | undefined>,
      offset: m.index,
    })
    // Guard against zero-width matches causing infinite loop
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return results
}

/**
 * Returns the body text that immediately follows a section heading in
 * `text`.  Handles both `\n---\n`-separated documents and blank-line
 * separated ones.
 */
export function getSectionBody(headingPattern: RegExp, text: string): string | null {
  // Try ---  separator format first
  const sections = text.split(/\n\s*---\s*\n/)
  for (const section of sections) {
    const lines = section.trim().split('\n')
    const heading = lines[0].trim()
    if (headingPattern.test(heading)) {
      return lines.slice(1).join('\n').trim()
    }
  }
  // Fall back: find heading paragraph and grab next paragraph(s)
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  for (let i = 0; i < paragraphs.length; i++) {
    if (headingPattern.test(paragraphs[i]) && paragraphs[i].split('\n').length === 1) {
      // Return next paragraph(s) until the next heading
      const bodyParts: string[] = []
      for (let j = i + 1; j < paragraphs.length; j++) {
        const nextPara = paragraphs[j]
        // Stop at the next known heading
        if (nextPara.split('\n').length === 1 && nextPara.length < 80 && !nextPara.endsWith('.')) break
        bodyParts.push(nextPara)
      }
      return bodyParts.join('\n\n') || null
    }
  }
  return null
}

// ─── Dollar / numeric helpers ─────────────────

/**
 * Extracts the first Australian dollar amount from a string.
 * Handles: $1,234.56  $1234  $1.2m  $1.2 million  etc.
 * Returns the numeric value in full dollars (e.g. 1234.56).
 */
export function extractDollarAmount(text: string): number | null {
  // Millions shorthand: $1.2m / $1.2 million
  const millMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:m(?:illion)?)\b/i)
  if (millMatch) {
    const raw = parseFloat(millMatch[1].replace(/,/g, ''))
    if (!isNaN(raw)) return raw * 1_000_000
  }
  // Standard: $1,234.56 or $1234
  const stdMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)\b/)
  if (stdMatch) {
    const raw = parseFloat(stdMatch[1].replace(/,/g, ''))
    if (!isNaN(raw)) return raw
  }
  return null
}

/**
 * Parses a variety of Australian date formats to ISO string (YYYY-MM-DD).
 * Handles: 1 January 2026 / 01/01/2026 / January 1, 2026 / 1st Jan 2026
 */
export function parseAustralianDate(text: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04',
    jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }

  // "1 January 2026" / "1st January 2026"
  const longMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/i)
  if (longMatch) {
    const day = longMatch[1].padStart(2, '0')
    const mon = months[longMatch[2].toLowerCase()]
    return `${longMatch[3]}-${mon}-${day}`
  }

  // "January 1, 2026" / "January 1 2026"
  const usMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i)
  if (usMatch) {
    const mon = months[usMatch[1].toLowerCase()]
    const day = usMatch[2].padStart(2, '0')
    return `${usMatch[3]}-${mon}-${day}`
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const numericMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/)
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0')
    const mon = numericMatch[2].padStart(2, '0')
    const year = numericMatch[3]
    // Sanity check
    if (parseInt(mon) <= 12 && parseInt(day) <= 31) {
      return `${year}-${mon}-${day}`
    }
  }

  return null
}

/**
 * Extracts all date-like strings from a body of text.
 * Returns them in order of appearance with their offsets.
 */
export function extractAllDates(text: string): { raw: string; iso: string | null; offset: number }[] {
  const results: { raw: string; iso: string | null; offset: number }[] = []
  const datePattern = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}|(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/gi
  let m: RegExpExecArray | null
  while ((m = datePattern.exec(text)) !== null) {
    results.push({ raw: m[0], iso: parseAustralianDate(m[0]), offset: m.index })
  }
  return results
}

// ─── ABN / identifier helpers ─────────────────

const ABN_PATTERN = /\bABN[:\s#]*(\d{2}\s*\d{3}\s*\d{3}\s*\d{3})\b/i

/** Extracts Australian Business Number from text. Returns formatted string or null. */
export function extractAbn(text: string): string | null {
  const m = ABN_PATTERN.exec(text)
  if (!m) return null
  // Normalise to "XX XXX XXX XXX"
  return m[1].replace(/\s+/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
}

// ─── URL helpers ──────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s)>\]"']+/gi

/** Extracts all URLs from text. */
export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((m) => m[0].replace(/[.,;:]+$/, ''))
}

/** Extracts the first URL containing 'privacy' in text, or first URL found. */
export function extractPrivacyUrl(text: string): string | null {
  const urls = extractUrls(text)
  return urls.find((u) => /privacy/i.test(u)) ?? urls[0] ?? null
}

// ─── Permit number helpers ────────────────────

/**
 * Detects permit numbers in Australian T&C format:
 *   NSW: TP26/1234 or TP26/XXXX
 *   SA:  T26/1234 or T26/XXXX
 *   ACT: TP 26/1234
 */
export function extractPermitNumbers(text: string): Record<string, string> {
  const found: Record<string, string> = {}

  // NSW: TP\d{2}/\d+ or TP\d{2}/X+
  const nswMatches = findAll(/\bTP\s*(\d{2})\s*\/\s*([\dX#]+)\b/gi, text)
  if (nswMatches.length > 0) {
    found['NSW'] = nswMatches[0].match.replace(/\s/g, '')
  }

  // SA: T\d{2}/\d+ (not TP)
  const saMatches = findAll(/\bT(\d{2})\s*\/\s*([\dX#]+)\b/gi, text)
    .filter((m) => !m.match.startsWith('TP'))
  if (saMatches.length > 0) {
    found['SA'] = saMatches[0].match.replace(/\s/g, '')
  }

  // ACT: ACT\s*TP\s*\d+ or similar
  const actMatches = findAll(/\bACT\s+(?:TP\s*)?\d+\/[\dX#]+\b/gi, text)
  if (actMatches.length > 0) {
    found['ACT'] = actMatches[0].match
  }

  return found
}

/** Returns true if a permit number appears to be a placeholder (XXXX / ####) */
export function isPermitPlaceholder(permitNumber: string): boolean {
  return /[X#]{2,}/i.test(permitNumber)
}

// ─── Field construction helpers ──────────────

/** Builds an ExtractedField with a single evidence snippet. */
export function fieldOf<T>(
  value: T,
  confidence: ExtractionConfidence,
  snippet: string,
  offset?: number
): ExtractedField<T> {
  return {
    value,
    confidence,
    evidence: snippet ? [{ snippet: snippet.slice(0, 250), offset }] : [],
  }
}

/** Builds an absent ExtractedField (not found). */
export function fieldAbsent<T>(): ExtractedField<T> {
  return { value: null, confidence: 'none', evidence: [] }
}

/** Combines confidence from multiple sub-extractions. */
export function combineConfidence(...confidences: ExtractionConfidence[]): ExtractionConfidence {
  const order: ExtractionConfidence[] = ['high', 'medium', 'low', 'none']
  let lowest = 0
  for (const c of confidences) {
    const idx = order.indexOf(c)
    if (idx > lowest) lowest = idx
  }
  return order[lowest]
}

// ─── Text scanning helpers ────────────────────

/**
 * Looks for a value that follows a label in the text.
 * e.g. findAfterLabel("Promoter:", text) finds the line/sentence after "Promoter:"
 */
export function findAfterLabel(labelPattern: RegExp, text: string, maxChars = 300): string | null {
  const m = labelPattern.exec(text)
  if (!m) return null
  const rest = text.slice(m.index + m[0].length).trimStart()
  // Take up to end of sentence / next newline / maxChars
  const end = Math.min(
    rest.search(/\n\n|\n(?=[A-Z])/),
    rest.search(/(?<=[.!?])\s/),
    maxChars
  )
  return end > 0 ? rest.slice(0, end).trim() : rest.slice(0, maxChars).trim()
}

/** Returns the sentence(s) in `text` that contain `keyword`. */
export function sentencesContaining(keyword: RegExp, text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => keyword.test(s))
    .slice(0, 3)
}
