'use server'

import { prisma } from '@/lib/prisma'

export async function getCampaign(id: string) {
  const raw = await prisma.campaign.findUnique({
    where: { id },
    include: {
      promoter: true,
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!raw) return null

  // Serialise to plain object — no Decimal or Date objects
  return {
    ...raw,
    prizePoolTotal: Number(raw.prizePoolTotal),
    promoStart: raw.promoStart?.toISOString() ?? null,
    promoEnd:   raw.promoEnd?.toISOString()   ?? null,
    createdAt:  raw.createdAt.toISOString(),
    updatedAt:  raw.updatedAt.toISOString(),
    quotes: raw.quotes.map(q => ({
      ...q,
      totalExGst:  Number(q.totalExGst),
      totalIncGst: Number(q.totalIncGst),
      gstAmount:   Number(q.gstAmount),
      termsFee:    Number(q.termsFee),
      mgmtFee:     Number(q.mgmtFee),
      permitFee:   Number(q.permitFee),
      drawFee:     Number(q.drawFee),
      validUntil:  q.validUntil.toISOString(),
      createdAt:   q.createdAt.toISOString(),
    })),
    auditLogs: raw.auditLogs.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}