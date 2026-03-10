'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteCampaign(id: string) {
  // Get all termsDraft IDs for this campaign first
  const drafts = await prisma.termsDraft.findMany({ 
    where: { campaignId: id },
    select: { id: true }
  })
  const draftIds = drafts.map(d => d.id)

  // Delete terms comments
  await prisma.termsComment.deleteMany({ 
    where: { termsDraftId: { in: draftIds } } 
  })

  // Delete terms approvals
  await prisma.termsApproval.deleteMany({ 
    where: { termsDraftId: { in: draftIds } } 
  })

  // Delete terms drafts
  await prisma.termsDraft.deleteMany({ where: { campaignId: id } })

  // Delete quotes
  // Delete approval records (linked to quotes)
  const quotes = await prisma.quote.findMany({ where: { campaignId: id }, select: { id: true } })
  const quoteIds = quotes.map(q => q.id)
  await prisma.approvalRecord.deleteMany({ where: { quoteId: { in: quoteIds } } })
  // Delete quotes
  await prisma.quote.deleteMany({ where: { campaignId: id } })
  // Delete other related records
  await prisma.generatedDocument.deleteMany({ where: { campaignId: id } })
  await prisma.auditLog.deleteMany({ where: { entityId: id } })

  // Delete campaign
  await prisma.campaign.delete({ where: { id } })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}