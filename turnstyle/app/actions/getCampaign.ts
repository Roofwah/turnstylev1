'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const campaignInclude = {
  promoter: true,
  quotes: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  auditLogs: { orderBy: { createdAt: 'desc' as const }, take: 10 },
} as const

type RawCampaign = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>

async function serializeCampaign(raw: RawCampaign) {
  return {
    ...raw,
    prizePoolTotal: Number(raw.prizePoolTotal),
    promoStart: raw.promoStart?.toISOString() ?? null,
    promoEnd: raw.promoEnd?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    quotes: raw.quotes.map((q) => ({
      ...q,
      totalExGst: Number(q.totalExGst),
      totalIncGst: Number(q.totalIncGst),
      gstAmount: Number(q.gstAmount),
      termsFee: Number(q.termsFee),
      mgmtFee: Number(q.mgmtFee),
      permitFee: Number(q.permitFee),
      drawFee: Number(q.drawFee),
      validUntil: q.validUntil?.toISOString(),
      createdAt: q.createdAt?.toISOString(),
    })),
    auditLogs: raw.auditLogs.map((a) => ({
      ...a,
      createdAt: a.createdAt?.toISOString(),
    })),
  }
}

export async function getCampaign(id: string) {
  const raw = await prisma.campaign.findUnique({
    where: { id },
    include: campaignInclude,
  })
  if (!raw) return null
  return serializeCampaign(raw)
}

/** Find campaign by tsCode (e.g. R98V8). Returns same shape as getCampaign. */
export async function getCampaignByTsCode(tsCode: string) {
  const raw = await prisma.campaign.findFirst({
    where: { tsCode: tsCode.trim().toUpperCase() },
    include: campaignInclude,
  })
  if (!raw) return null
  return serializeCampaign(raw)
}