import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { interpretCampaignBrief } from './interpret'
import { sendPacketFlowNotifyEmail, sendPacketSubmitterEmail } from './packet-email'
import { buildPacketPresentation } from './presentation'
import type { PacketSubmitInput, ProcessPacketResult } from './packet-types'
import type { ExtractedCampaignIntake } from './types'

const MAX_CONCEPT_CHARS = 4000
const MAX_FIELD_CHARS = 200

export function newPacketRef(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase()
  return `TS-PKT-${suffix}`
}

function newReviewToken(): string {
  return randomBytes(24).toString('base64url')
}

export function validatePacketSubmitInput(input: Partial<PacketSubmitInput>): {
  ok: true
  data: PacketSubmitInput
} | { ok: false; error: string; status: number } {
  const concept = typeof input.concept === 'string' ? input.concept.trim() : ''
  const submitterName = typeof input.submitterName === 'string' ? input.submitterName.trim() : ''
  const submitterEmail = typeof input.submitterEmail === 'string' ? input.submitterEmail.trim() : ''
  const submitterCompany = typeof input.submitterCompany === 'string' ? input.submitterCompany.trim() : ''
  const partnerId = typeof input.partnerId === 'string' ? input.partnerId.trim() : ''
  const source = input.source

  if (!concept) return { ok: false, error: 'concept is required', status: 400 }
  if (concept.length > MAX_CONCEPT_CHARS) {
    return { ok: false, error: `concept must be under ${MAX_CONCEPT_CHARS} characters`, status: 400 }
  }
  if (!submitterName || submitterName.length > MAX_FIELD_CHARS) {
    return { ok: false, error: 'submitterName is required', status: 400 }
  }
  if (!submitterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    return { ok: false, error: 'valid submitterEmail is required', status: 400 }
  }
  if (!submitterCompany || submitterCompany.length > MAX_FIELD_CHARS) {
    return { ok: false, error: 'submitterCompany is required', status: 400 }
  }
  if (!partnerId) return { ok: false, error: 'partnerId is required', status: 400 }
  if (!source || !['partner', 'demo', 'email', 'paste'].includes(source)) {
    return { ok: false, error: 'invalid source', status: 400 }
  }

  return {
    ok: true,
    data: {
      concept,
      submitterName,
      submitterEmail,
      submitterCompany,
      partnerId,
      partnerDisplayName: input.partnerDisplayName,
      source,
      externalRef: input.externalRef?.trim() || null,
      idempotencyKey: input.idempotencyKey?.trim() || null,
    },
  }
}

async function findIdempotentDraft(partnerId: string, idempotencyKey: string) {
  return prisma.campaignIntakeDraft.findFirst({
    where: { partnerId, idempotencyKey },
  })
}

function draftToResult(
  draft: {
    packetRef: string | null
    reviewToken: string
    rawInput: string
    intakeJson: unknown
    source: string
    submitterName: string | null
    submitterEmail: string | null
    submitterCompany: string | null
    partnerId: string | null
    createdAt: Date
  },
  interpretationSource: 'ai' | 'heuristic',
  idempotentReplay: boolean,
  emails: ProcessPacketResult['emails'],
  degradedReason?: string | null
): ProcessPacketResult {
  const packetRef = draft.packetRef ?? 'UNKNOWN'
  const intake = draft.intakeJson as unknown as ExtractedCampaignIntake
  const presentation = buildPacketPresentation({
    packetRef,
    intake,
    concept: draft.rawInput,
    submitterName: draft.submitterName ?? '',
    submitterEmail: draft.submitterEmail ?? '',
    submitterCompany: draft.submitterCompany ?? '',
    partnerId: draft.partnerId ?? 'unknown',
    source: (draft.source === 'demo' || draft.source === 'partner' ? draft.source : 'partner') as 'partner' | 'demo',
    createdAt: draft.createdAt.toISOString(),
  })

  return {
    packetRef,
    reviewToken: draft.reviewToken,
    intake,
    presentation,
    interpretationSource,
    idempotentReplay,
    emails,
    degradedReason: degradedReason ?? null,
  }
}

/**
 * Shared Intake → Packet pipeline for Partner API and Demo.
 * Does not create Campaign records or open Campaign Builder.
 */
export async function processIntakePacket(input: PacketSubmitInput): Promise<ProcessPacketResult> {
  if (input.idempotencyKey) {
    const existing = await findIdempotentDraft(input.partnerId, input.idempotencyKey)
    if (existing?.packetRef) {
      return draftToResult(
        existing,
        existing.source.includes('ai') ? 'ai' : 'heuristic',
        true,
        { submitterSent: false, flowSent: false },
        null
      )
    }
  }

  const { intake, source, degradedReason } = await interpretCampaignBrief(input.concept)
  const packetRef = newPacketRef()
  const reviewToken = newReviewToken()

  const draft = await prisma.campaignIntakeDraft.create({
    data: {
      reviewToken,
      packetRef,
      partnerId: input.partnerId,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      submitterCompany: input.submitterCompany,
      externalRef: input.externalRef,
      idempotencyKey: input.idempotencyKey,
      fromEmail: input.submitterEmail,
      rawInput: input.concept,
      intakeJson: intake as object,
      source: `${input.source}:${source}`,
      status: 'submitted',
    },
  })

  const presentation = buildPacketPresentation({
    packetRef,
    intake,
    concept: input.concept,
    submitterName: input.submitterName,
    submitterEmail: input.submitterEmail,
    submitterCompany: input.submitterCompany,
    partnerId: input.partnerId,
    source: input.source,
    createdAt: draft.createdAt.toISOString(),
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reviewUrl = `${appUrl}/dashboard/intake?token=${reviewToken}`

  // Emails must not fail the stored packet
  const emails: ProcessPacketResult['emails'] = {
    submitterSent: false,
    flowSent: false,
  }

  const submitterResult = await sendPacketSubmitterEmail(presentation, intake)
  emails.submitterSent = submitterResult.ok
  if (!submitterResult.ok) emails.submitterError = submitterResult.error

  const flowResult = await sendPacketFlowNotifyEmail(presentation, reviewUrl)
  emails.flowSent = flowResult.ok
  if (!flowResult.ok) emails.flowError = flowResult.error

  return {
    packetRef,
    reviewToken,
    intake,
    presentation,
    interpretationSource: source,
    idempotentReplay: false,
    emails,
    degradedReason,
  }
}
