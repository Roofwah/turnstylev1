'use server'

// ─────────────────────────────────────────────
// Turnstyle — Upload & Preflight Server Action
//
// Entry point for the standalone document preflight path.
// Completely separate from preflightCampaign.ts.
//
// Flow:
//   1. Validate the uploaded File (type, size)
//   2. Extract plain text via mammoth
//   3. Persist TermsUpload record
//   4. Run runPreflightOnDocument() (structural/rule checks)
//   5. Run extractCampaignSchemaFromTerms() (field extraction)
//   6. Run reviewDocument() (concept review + scoring)
//   7. Run mapExtractedSchemaToCampaignDraftSeed() (rebuild seed)
//   8. Persist TermsUploadReport with all payloads
//   9. Return the uploadId for redirect
// ─────────────────────────────────────────────

import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { extractTextFromDocx } from '@/lib/preflight-upload/extractDocx'
import { runPreflightOnDocument } from '@/lib/preflight-upload/runPreflightOnDocument'
import { normaliseForClassifier } from '@/lib/preflight-upload/normaliseForClassifier'
import { extractCampaignSchemaFromTerms } from '@/lib/preflight-extraction'
import { reviewDocument } from '@/lib/preflight-review'
import { mapExtractedSchemaToCampaignDraftSeed } from '@/lib/preflight-rebuild'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  // Some browsers send a generic octet-stream for .docx
  'application/octet-stream',
])

export type UploadPreflightResult =
  | { success: true; uploadId: string }
  | { success: false; error: string }

export async function uploadAndPreflightTerms(
  formData: FormData
): Promise<UploadPreflightResult> {
  // ── 1. Validate ────────────────────────────
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided.' }
  }

  if (!file.name.endsWith('.docx') && !ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      success: false,
      error: 'Only .docx Word documents are supported in this version.',
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `File exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    }
  }

  if (file.size < 100) {
    return { success: false, error: 'File appears to be empty.' }
  }

  // ── 2. Extract text ─────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())

  let extraction: Awaited<ReturnType<typeof extractTextFromDocx>>

  try {
    extraction = await extractTextFromDocx(buffer)
  } catch (err) {
    console.error('[preflightUpload] extraction error:', err)
    return {
      success: false,
      error:
        'Could not extract text from this document. Make sure it is a valid, non-password-protected .docx file.',
    }
  }

  if (extraction.text.length < 100) {
    return {
      success: false,
      error:
        'The document contains too little text to run a preflight check. Minimum 100 characters required.',
    }
  }

  // ── 3. Persist upload ───────────────────────
  const uploadId = randomUUID()

  await prisma.termsUpload.create({
    data: {
      id: uploadId,
      filename: file.name,
      fileSize: file.size,
      extractedText: extraction.text,
      wordCount: extraction.wordCount,
    },
  })

  // ── 4. Run structural preflight ──────────────
  let report: Awaited<ReturnType<typeof runPreflightOnDocument>>

  try {
    report = await runPreflightOnDocument(extraction.text, uploadId, {
      filename: file.name,
      skipAiReview: true,
    })
  } catch (err) {
    console.error('[preflightUpload] preflight error:', err)
    await prisma.termsUpload.delete({ where: { id: uploadId } }).catch(() => undefined)
    return {
      success: false,
      error: 'Preflight analysis encountered an unexpected error. Please try again.',
    }
  }

  // ── 5. Run extraction ────────────────────────
  // Use normalised text (same as preflight engine used)
  const normalisedText = normaliseForClassifier(extraction.text)
  let extractionSchema: Awaited<ReturnType<typeof extractCampaignSchemaFromTerms>>
  let reviewResult: Awaited<ReturnType<typeof reviewDocument>>
  let draftSeed: Awaited<ReturnType<typeof mapExtractedSchemaToCampaignDraftSeed>>

  try {
    extractionSchema = extractCampaignSchemaFromTerms(normalisedText, file.name)
    reviewResult = reviewDocument(normalisedText, extractionSchema)
    draftSeed = mapExtractedSchemaToCampaignDraftSeed(extractionSchema)
  } catch (err) {
    // Extraction/review failures are non-fatal — we still have the structural report
    console.error('[preflightUpload] extraction/review error:', err)
    // Fall through with nulls — handled below
    extractionSchema = null as never
    reviewResult = null as never
    draftSeed = null as never
  }

  // ── 6. Persist report ────────────────────────
  await prisma.termsUploadReport.create({
    data: {
      uploadId,
      score: report.score.total,
      riskBand: report.score.riskBand,
      issueCount: report.issues.length,
      reportJson: JSON.parse(JSON.stringify(report)),
      ...(extractionSchema && {
        extractionJson: JSON.parse(JSON.stringify(extractionSchema)),
      }),
      ...(reviewResult && {
        reviewJson: JSON.parse(JSON.stringify(reviewResult)),
        recommendation: reviewResult.recommendation.code,
      }),
      ...(draftSeed && {
        draftSeedJson: JSON.parse(JSON.stringify(draftSeed)),
      }),
    },
  })

  // ── 7. Return ────────────────────────────────
  return { success: true, uploadId }
}
