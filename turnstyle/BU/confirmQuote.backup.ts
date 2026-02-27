'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { CampaignStatus, QuoteStatus } from '@prisma/client'

export async function confirmQuote(campaignId: string, approvedById?: string) {
  const now = new Date()

  try {
    console.log('🔍 confirmQuote called for campaign:', campaignId)
    
    // First, validate that the campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      throw new Error(`Campaign with id ${campaignId} not found`)
    }

    console.log('📊 Campaign found, status:', campaign.status)

    // Get all DRAFT quotes for this campaign
    const draftQuotes = await prisma.quote.findMany({
      where: {
        campaignId,
        status: QuoteStatus.DRAFT,
      },
    })
    
    console.log('📋 Found DRAFT quotes:', draftQuotes.length)

    if (draftQuotes.length === 0) {
      // Check if quotes are already approved (ACCEPTED)
      const allQuotes = await prisma.quote.findMany({
        where: { campaignId },
        select: { id: true, status: true },
      })
      
      const approvedQuotes = allQuotes.filter(q => q.status === QuoteStatus.ACCEPTED)
      
      if (approvedQuotes.length > 0) {
        // Quotes are already approved - ensure campaign status is also CONFIRMED
        if (campaign.status !== CampaignStatus.CONFIRMED) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: CampaignStatus.CONFIRMED },
          })
          revalidatePath('/dashboard')
          revalidatePath(`/dashboard/${campaignId}`)
        }
        
        return {
          confirmedAt: now.toISOString(),
          quotesApproved: approvedQuotes.length,
          message: `Quote(s) already approved.`,
          alreadyApproved: true,
        }
      }
      
      // No draft quotes and no approved quotes
      const existingStatuses = allQuotes.map(q => q.status).join(', ')
      throw new Error(
        `No DRAFT quotes found for this campaign. Found quotes with status: ${existingStatuses || 'none'}. ` +
        'Please generate a quote first.'
      )
    }

    console.log('✅ Proceeding to approve', draftQuotes.length, 'quote(s)')
    
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update campaign status to CONFIRMED when quote is approved
      console.log('🔄 Updating campaign status to CONFIRMED...')
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.CONFIRMED },
      })

      // Update all DRAFT quotes to ACCEPTED and create ApprovalRecords
      const updatedQuotes = []
      
      for (const quote of draftQuotes) {
        console.log('📝 Updating quote', quote.id, 'to ACCEPTED')
        // Update the quote
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