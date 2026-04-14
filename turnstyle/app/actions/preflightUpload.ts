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
//   4. Run runPreflightOnDocument()
//   5. Persist TermsUploadReport
//   6. Return the uploadId for redirect
// ─────────────────────────────────────────────

import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { extractTextFromDocx } from '@/lib/preflight-upload/extractDocx'
import { runPreflightOnDocument } from '@/lib/preflight-upload/runPreflightOnDocument'

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

  // ── 4. Run preflight ─────────────────────────
  let report: Awaited<ReturnType<typeof runPreflightOnDocument>>

  try {
    report = await runPreflightOnDocument(extraction.text, uploadId, {
      filename: file.name,
      skipAiReview: true,
    })
  } catch (err) {
    console.error('[preflightUpload] preflight error:', err)
    // Best-effort cleanup — don't fail silently if delete fails
    await prisma.termsUpload.delete({ where: { id: uploadId } }).catch(() => undefined)
    return {
      success: false,
      error: 'Preflight analysis encountered an unexpected error. Please try again.',
    }
  }

  // ── 5. Persist report ────────────────────────
  await prisma.termsUploadReport.create({
    data: {
      uploadId,
      score: report.score.total,
      riskBand: report.score.riskBand,
      issueCount: report.issues.length,
      // Store the full report as JSON for the report page to read
      // Prisma expects Prisma.InputJsonValue — round-trip through JSON to satisfy the type
      reportJson: JSON.parse(JSON.stringify(report)),
    },
  })

  // ── 6. Return ────────────────────────────────
  return { success: true, uploadId }
}
