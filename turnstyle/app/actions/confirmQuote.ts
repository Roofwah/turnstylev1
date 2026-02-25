'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function confirmQuote(campaignId: string) {
  const now = new Date()

  await prisma.campaign.update({
    where: { id: campaignId },
    data:  { status: 'CONFIRMATION' },
  })

  await prisma.quote.updateMany({
    where:  { campaignId, status: 'DRAFT' },
    data:   { status: 'ACCEPTED', approvedAt: now },
  })

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/${campaignId}`)

  return { confirmedAt: now.toISOString() }
}