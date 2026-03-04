'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { QuoteStatus, CampaignStatus } from '@prisma/client'

export async function updateCampaign(id: string, data: {
  name?: string
  promoStart?: string
  promoEnd?: string
  drawMechanic?: string
  drawFrequency?: string
  entryMechanic?: string
  regions?: string[]
  prizes?: { tier: string; description: string; qty: number; unitValue: number }[]
  notes?: string
  promoter?: {
    name?: string
    abn?: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
  }
  revertToDraft?: boolean
}) {
  const prizePoolTotal = data.prizes
    ? data.prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
    : undefined

  // Define quote-affecting fields that should invalidate approval
  const quoteAffectingFields: (keyof typeof data)[] = [
    'promoStart', 'promoEnd', 'drawMechanic', 'drawFrequency', 'prizes', 'regions'
  ]
  
  // Check if any quote-affecting fields are being changed
  const hasQuoteAffectingChanges = quoteAffectingFields.some(field => data[field] !== undefined)
  
  // If quote-affecting changes are made, check for approved quotes and revert them
  if (hasQuoteAffectingChanges) {
    const approvedQuotes = await prisma.quote.findMany({
      where: {
        campaignId: id,
        status: QuoteStatus.APPROVED,
      },
    })
    
    if (approvedQuotes.length > 0) {
      // Get quote IDs before updating
      const approvedQuoteIds = approvedQuotes.map(q => q.id)
      
      // Delete ApprovalRecords for these quotes (one-to-one relationship)
      await prisma.approvalRecord.deleteMany({
        where: {
          quoteId: { in: approvedQuoteIds },
        },
      })
      
      // Revert approved quotes back to DRAFT and clear approval data
      await prisma.quote.updateMany({
        where: {
          campaignId: id,
          status: QuoteStatus.APPROVED,
        },
        data: {
          status: QuoteStatus.DRAFT,
          approvedAt: null,
          approvedById: null,
        },
      })
      
      // Also check if campaign status is CONFIRMED and revert it to DRAFT
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { status: true },
      })
      
      if (campaign?.status === CampaignStatus.CONFIRMED) {
        // Campaign status will be updated below with revertToDraft flag
        // But we'll ensure it happens even if revertToDraft wasn't explicitly set
        data.revertToDraft = true
      }
    }
  }

  const frequencyMap: Record<string, any> = {
    at_conclusion: 'AT_CONCLUSION',
    daily:         'DAILY',
    weekly:        'WEEKLY',
    fortnightly:   'FORTNIGHTLY',
    monthly:       'MONTHLY',
  }

  const mechanicMap: Record<string, any> = {
    'Sweepstakes - Random Draw': 'SWEEPSTAKES',
    'Sweepstakes - Instant Win':  'SWEEPSTAKES',
    'Limited Offer':              'LIMITED_OFFER',
    'Other':                      'OTHER',
  }
  console.log('Saving regions:', data.regions)
  await prisma.campaign.update({
    where: { id },
    data: {
      ...(data.name        && { name: data.name }),
      ...(data.promoStart  && { promoStart: new Date(data.promoStart) }),
      ...(data.promoEnd    && { promoEnd: new Date(data.promoEnd) }),
      ...(data.drawFrequency && { drawFrequency: frequencyMap[data.drawFrequency] ?? 'AT_CONCLUSION' }),
      ...(data.drawMechanic  && { mechanicType: mechanicMap[data.drawMechanic] ?? 'OTHER' }),
      ...(data.entryMechanic !== undefined && { entryMechanic: data.entryMechanic }),
      ...(data.regions       !== undefined && { regions: data.regions }),
      ...(data.prizes        && { prizes: data.prizes, prizePoolTotal }),
      ...(data.notes         !== undefined && { notes: data.notes }),
      ...(data.revertToDraft && { status: CampaignStatus.DRAFT }),
    },
  })

  if (data.promoter) {
    const campaign = await prisma.campaign.findUnique({
      where: { id }, select: { promoterId: true }
    })
    if (campaign?.promoterId) {
      await prisma.promoter.update({
        where: { id: campaign.promoterId },
        data: {
          ...(data.promoter.name         && { name: data.promoter.name }),
          ...(data.promoter.abn          !== undefined && { abn: data.promoter.abn }),
          ...(data.promoter.contactName  !== undefined && { contactName: data.promoter.contactName }),
          ...(data.promoter.contactEmail !== undefined && { contactEmail: data.promoter.contactEmail }),
          ...(data.promoter.contactPhone !== undefined && { contactPhone: data.promoter.contactPhone }),
        },
      })
    }
  }

  // Regenerate quote with updated campaign data
  const updated = await prisma.campaign.findUnique({ where: { id } })
  if (updated) {
    const { calculateQuote } = await import('@/lib/quote-engine')
    const prizes = Array.isArray(updated.prizes) ? updated.prizes as any[] : []
    const drawMechanic = updated.mechanicType === 'SWEEPSTAKES'   ? 'Sweepstakes - Random Draw'
                       : updated.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer'
                       : 'Other'
    const quote = calculateQuote({
      campaignId:    updated.id,
      tsCode:        updated.tsCode,
      campaignName:  updated.name,
      promoStart:    updated.promoStart?.toISOString().split('T')[0] ?? '',
      promoEnd:      updated.promoEnd?.toISOString().split('T')[0] ?? '',
      drawMechanic,
      drawFrequency: (updated.drawFrequency ?? 'AT_CONCLUSION').toLowerCase(),
      prizes,
    })

    await prisma.quote.updateMany({
      where: { campaignId: id, status: QuoteStatus.DRAFT },
      data: {
        quoteNumber:  quote.quoteNumber,
        quoteHash:    quote.quoteHash,
        termsFee:     quote.termsFee,
        mgmtFee:      quote.mgmtFee,
        permitFee:    quote.permitFee,
        drawFee:      quote.drawFee,
        totalExGst:   quote.totalExGst,
        gstAmount:    quote.gstAmount,
        totalIncGst:  quote.totalIncGst,
        validUntil:   new Date(quote.validUntil),
        snapshotJson: { campaign: updated, quote },
      },
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/${id}`)
}