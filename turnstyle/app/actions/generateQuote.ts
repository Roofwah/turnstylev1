'use server'

import { prisma } from '@/lib/prisma'
import { calculateQuote } from '@/lib/quote-engine'
import { revalidatePath } from 'next/cache'
import { QuoteStatus } from '@prisma/client'

export async function generateQuote(campaignId: string) {
  const raw = await prisma.campaign.findUnique({
    where: { id: campaignId },
  })

  if (!raw) throw new Error('Campaign not found')

  const prizes = Array.isArray(raw.prizes) ? raw.prizes as any[] : []

  const drawMechanic = raw.mechanicType === 'SWEEPSTAKES'   ? 'Sweepstakes - Random Draw'
                     : raw.mechanicType === 'LIMITED_OFFER' ? 'Limited Offer'
                     : 'Other'

  const drawFrequency = (raw.drawFrequency ?? 'AT_CONCLUSION').toLowerCase().replace('at_conclusion', 'at_conclusion')

  // If a confirmed draw schedule exists, use its actual length as the draw count
  // rather than calculating it from drawFrequency + promo period length
  const drawSchedule = Array.isArray(raw.drawSchedule) ? raw.drawSchedule as any[] : []
  const overrideDrawCount = drawSchedule.length > 0 ? drawSchedule.length : undefined

  const quote = calculateQuote({
    campaignId:        raw.id,
    tsCode:            raw.tsCode,
    campaignName:      raw.name,
    promoStart:        raw.promoStart?.toISOString().split('T')[0] ?? '',
    promoEnd:          raw.promoEnd?.toISOString().split('T')[0] ?? '',
    drawMechanic,
    drawFrequency,
    prizes,
    overrideDrawCount,
  })

  // Supersede any existing draft quotes
  await prisma.quote.updateMany({
    where: { campaignId, status: QuoteStatus.DRAFT },
    data:  { status: QuoteStatus.SUPERSEDED },
  })

  // Save new quote — use direct fields from quote result, not lines.find()
  await prisma.quote.create({
    data: {
      campaignId,
      quoteNumber:   quote.quoteNumber,
      quoteHash:     quote.quoteHash,
      status:        QuoteStatus.DRAFT,
      termsFee:      quote.termsFee,
      mgmtFee:       quote.mgmtFee,
      permitFee:     quote.permitFee,
      drawFee:       quote.drawFee,
      totalExGst:    quote.totalExGst,
      gstAmount:     quote.gstAmount,
      totalIncGst:   quote.totalIncGst,
      validUntil:    new Date(quote.validUntil),
      engineVersion: '0.1.5',
      snapshotJson:  { campaign: raw, quote } as any,
    },
  })

  revalidatePath(`/dashboard/${campaignId}`)
}