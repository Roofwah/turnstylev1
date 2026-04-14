// ─────────────────────────────────────────────
// Turnstyle Preflight Extraction — Main Entry Point
//
// extractCampaignSchemaFromTerms(rawText, filename?)
//
// Orchestrates all field extractors and assembles the
// complete ExtractedCampaignSchema.  No AI required.
// ─────────────────────────────────────────────

import type {
  ExtractedCampaignSchema,
  SourceDocumentMeta,
  ExtractionDiagnostics,
  ExtractionConfidence,
  ExtractedField,
} from './types'

import {
  extractCampaignCore,
  extractCampaignTiming,
  extractEligibilityAndEntry,
  extractPrizeModel,
  extractCompliance,
} from './extractors'

// ─── Format detection ─────────────────────────

function detectFormat(rawText: string): SourceDocumentMeta['detectedFormat'] {
  if (rawText.includes('\n---\n')) return 'turnstyle_native'
  // Word table: alternating single-line headings and body paragraphs
  const paragraphs = rawText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const singleLineCount = paragraphs.filter((p) => !p.includes('\n') && p.length < 80).length
  const ratio = paragraphs.length > 0 ? singleLineCount / paragraphs.length : 0
  if (ratio > 0.35) return 'word_table'
  if (ratio > 0.15) return 'free_form'
  return 'unknown'
}

function countSections(rawText: string): number {
  if (rawText.includes('\n---\n')) return rawText.split('\n---\n').length
  // Approximate heading-separated sections
  const paragraphs = rawText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return paragraphs.filter((p) => !p.includes('\n') && p.length < 80 && !p.endsWith('.')).length
}

// ─── Diagnostics ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countConfidences(schema: Record<string, any>, path = '', diagnostics: ExtractionDiagnostics): void {
  for (const [key, val] of Object.entries(schema)) {
    if (val && typeof val === 'object' && 'confidence' in val && 'value' in val) {
      // It's an ExtractedField
      const field = val as ExtractedField<unknown>
      diagnostics.totalFieldsAttempted++
      switch (field.confidence as ExtractionConfidence) {
        case 'high':   diagnostics.highConfidenceCount++;   break
        case 'medium': diagnostics.mediumConfidenceCount++; break
        case 'low':    diagnostics.lowConfidenceCount++;    break
        case 'none':   diagnostics.noneCount++;             break
      }
      if (field.ambiguous) diagnostics.ambiguousFields.push(`${path}.${key}`)
    } else if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      countConfidences(val, `${path}.${key}`, diagnostics)
    }
  }
}

// ─── Main export ──────────────────────────────

export function extractCampaignSchemaFromTerms(
  rawText: string,
  filename: string | null = null
): ExtractedCampaignSchema {
  const meta: SourceDocumentMeta = {
    filename,
    wordCount: rawText.split(/\s+/).filter(Boolean).length,
    charCount: rawText.length,
    detectedFormat: detectFormat(rawText),
    sectionCount: countSections(rawText),
    extractedAt: new Date(),
  }

  const core = extractCampaignCore(rawText, filename)
  const timing = extractCampaignTiming(rawText)
  const eligibilityAndEntry = extractEligibilityAndEntry(rawText)
  const prizeModel = extractPrizeModel(rawText)
  const compliance = extractCompliance(rawText)

  const diagnostics: ExtractionDiagnostics = {
    totalFieldsAttempted: 0,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    noneCount: 0,
    ambiguousFields: [],
    warnings: [],
  }

  countConfidences({ core, timing, eligibilityAndEntry, prizeModel, compliance }, '', diagnostics)

  // Add warnings for likely problems
  if (core.promoterName.confidence === 'none') {
    diagnostics.warnings.push('Could not extract promoter name — check Promoter section heading')
  }
  if (timing.promotionStart.confidence === 'none' && timing.promotionEnd.confidence === 'none') {
    diagnostics.warnings.push('No promotion dates detected — check Promotional Period section')
  }
  if (prizeModel.prizes.length === 0) {
    diagnostics.warnings.push('No individual prizes extracted — prize section may use non-standard structure')
  }
  if (compliance.permitNumbers.confidence === 'none') {
    diagnostics.warnings.push('No permit numbers detected — may be in planning stage')
  }

  return {
    schemaVersion: '1.0',
    meta,
    core,
    timing,
    eligibilityAndEntry,
    prizeModel,
    compliance,
    diagnostics,
  }
}
