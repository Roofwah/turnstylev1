import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { ExtractedCampaignIntake } from './types'

function newReviewToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function saveIntakeDraft(params: {
  rawInput: string
  intake: ExtractedCampaignIntake
  source: string
  fromEmail?: string | null
  subject?: string | null
  resendEmailId?: string | null
}) {
  const reviewToken = newReviewToken()
  const draft = await prisma.campaignIntakeDraft.create({
    data: {
      reviewToken,
      fromEmail: params.fromEmail ?? null,
      subject: params.subject ?? null,
      resendEmailId: params.resendEmailId ?? null,
      rawInput: params.rawInput,
      intakeJson: params.intake as object,
      source: params.source,
      status: 'pending_review',
    },
  })
  return { draft, reviewToken }
}

export async function getIntakeDraftByToken(reviewToken: string) {
  const draft = await prisma.campaignIntakeDraft.findUnique({
    where: { reviewToken },
  })
  if (!draft) return null
  return {
    id: draft.id,
    reviewToken: draft.reviewToken,
    fromEmail: draft.fromEmail,
    subject: draft.subject,
    rawInput: draft.rawInput,
    intake: draft.intakeJson as unknown as ExtractedCampaignIntake,
    source: draft.source,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
  }
}

export async function updateIntakeDraftJson(reviewToken: string, intake: ExtractedCampaignIntake) {
  return prisma.campaignIntakeDraft.update({
    where: { reviewToken },
    data: { intakeJson: intake as object },
  })
}
