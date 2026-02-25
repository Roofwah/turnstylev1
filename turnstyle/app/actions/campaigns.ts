'use server'

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function createCampaign(data: {
  promoterName: string
  promoterAbn: string
  contactName: string
  contactEmail: string
  contactPhone: string
  campaignName: string
  tsCode: string
  promoStart: string
  promoEnd: string
  notes: string
  drawMechanic: string
  drawFrequency: string
  entryMechanic: string
  regions: string[]
  prizes: { tier: string; description: string; qty: number; unitValue: number }[]
}) {
  const prizePoolTotal = data.prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)

  // Create promoter
  const promoter = await prisma.promoter.create({
    data: {
      name: data.promoterName,
      abn: data.promoterAbn || null,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
    },
  })

  // Create campaign
  // Note: createdById is hardcoded for now — will use real auth session later
  const TEMP_USER_ID = 'admin-user-001'

  const campaign = await prisma.campaign.create({
    data: {
      tsCode: data.tsCode,
      promoterId: promoter.id,
      createdById: TEMP_USER_ID,
      name: data.campaignName,
      promoStart: data.promoStart ? new Date(data.promoStart) : null,
      promoEnd: data.promoEnd ? new Date(data.promoEnd) : null,
      drawFrequency: data.drawFrequency.toUpperCase() as any,
      entryMechanic: data.entryMechanic || null,
      regions: data.regions,
      prizes: data.prizes,
      prizePoolTotal,
      notes: data.notes || null,
      status: 'DRAFT',
    },
  })
// Auto-generate quote immediately
const prizes = data.prizes as any[]
const prizePoolTotal2 = prizes.reduce((s: number, p: any) => s + p.qty * p.unitValue, 0)
const { calculateQuote } = await import('@/lib/quote-engine')
const quote = calculateQuote({
  campaignId:    campaign.id,
  tsCode:        campaign.tsCode,
  campaignName:  campaign.name,
  promoStart:    data.promoStart,
  promoEnd:      data.promoEnd,
  drawMechanic:  data.drawMechanic,
  drawFrequency: data.drawFrequency,
  prizes:        data.prizes,
})

await prisma.quote.create({
  data: {
    campaignId:    campaign.id,
    quoteNumber:   quote.quoteNumber,
    quoteHash:     quote.quoteHash,
    status:        'DRAFT',
    termsFee:      quote.termsFee,
    mgmtFee:       quote.mgmtFee,
    permitFee:     quote.permitFee,
    drawFee:       quote.drawFee,
    totalExGst:    quote.totalExGst,
    gstAmount:     quote.gstAmount,
    totalIncGst:   quote.totalIncGst,
    validUntil:    new Date(quote.validUntil),
    engineVersion: '0.1.5',
    snapshotJson:  { campaign: data, quote },
  },
})

redirect(`/dashboard/${campaign.id}`)
  
}