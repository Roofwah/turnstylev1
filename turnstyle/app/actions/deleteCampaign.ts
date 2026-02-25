'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteCampaign(id: string) {
  // Delete related records first
  await prisma.quote.deleteMany({ where: { campaignId: id } })
  await prisma.summary.deleteMany({ where: { campaignId: id } })
  await prisma.generatedDocument.deleteMany({ where: { campaignId: id } })
  await prisma.auditLog.deleteMany({ where: { entityId: id } })

  // Delete campaign (promoter stays — may have other campaigns)
  await prisma.campaign.delete({ where: { id } })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}