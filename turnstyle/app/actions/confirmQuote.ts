'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { CampaignStatus, QuoteStatus } from '@prisma/client'

export async function confirmQuote(campaignId: string, approvedById?: string) {
  const now = new Date()

  try {
    // First, validate that the campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      throw new Error(`Campaign with id ${campaignId} not found`)
    }

    // Get all quotes for this campaign to check what exists
    const allQuotes = await prisma.quote.findMany({
      where: { campaignId },
      select: { id: true, status: true, quoteNumber: true },
    })

    if (allQuotes.length === 0) {
      throw new Error('No quotes found for this campaign. Please generate a quote first.')
    }

    // Get all DRAFT quotes for this campaign
    const draftQuotes = await prisma.quote.findMany({
      where: {
        campaignId,
        status: QuoteStatus.DRAFT,
      },
    })

    if (draftQuotes.length === 0) {
      // Check if quotes are already approved
      const approvedQuotes = allQuotes.filter(q => q.status === QuoteStatus.ACCEPTED)
      
      if (approvedQuotes.length > 0) {
        // Quotes are already approved - ensure campaign status is also APPROVED
        if (campaign.status !== CampaignStatus.CONFIRMED) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: CampaignStatus.CONFIRMED },
          })
          revalidatePath('/dashboard')
          revalidatePath(`/dashboard/${campaignId}`)
        }
        
        return {
          confirmedAt: new Date().toISOString(),
          quotesApproved: approvedQuotes.length,
          message: `Quote(s) already approved.`,
          alreadyApproved: true,
        }
      }
      
      // No draft quotes and no approved quotes - need to generate a quote
      const existingStatuses = allQuotes.map(q => q.status).join(', ')
      throw new Error(
        `No DRAFT quotes found for this campaign. Found quotes with status: ${existingStatuses}. ` +
        'Please generate a new quote first.'
      )
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update campaign status
      // Using APPROVED since CONFIRMATION may not exist in database enum yet
      // TODO: Run migration to add CONFIRMATION, REVIEW, PENDING, etc. to CampaignStatus enum
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.CONFIRMED },
      })

      // Update all DRAFT quotes to APPROVED and create ApprovalRecords
      const updatedQuotes = []
      
      for (const quote of draftQuotes) {
        // Update the quote
        // Using APPROVED since ACCEPTED may not exist in database enum yet
        const updatedQuote = await tx.quote.update({
          where: { id: quote.id },
          data: {
            status: QuoteStatus.ACCEPTED,
            approvedAt: now,
            ...(approvedById && { approvedById }),
          },
        })

        // Create ApprovalRecord for this quote
        // Note: approvedById is required for ApprovalRecord, so we need a user ID
        // For now, if no approvedById is provided, we'll skip creating the record
        // This can be updated when authentication is fully implemented
        if (approvedById) {
          await tx.approvalRecord.create({
            data: {
              quoteId: quote.id,
              campaignId: campaignId,
              approvedById: approvedById,
              approvedAt: now,
              totalSnapshot: quote.totalExGst,
              quoteHashSnapshot: quote.quoteHash,
            },
          })
        }

        updatedQuotes.push(updatedQuote)
      }

      return { updatedQuotes, count: updatedQuotes.length }
    })

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/${campaignId}`)

    return {
      confirmedAt: now.toISOString(),
      quotesApproved: result.count,
      message: `Successfully approved ${result.count} quote(s)`,
    }
  } catch (error) {
    console.error('Error confirming quote:', error)
    throw error instanceof Error
      ? error
      : new Error('Failed to confirm quote. Please try again.')
  }
}