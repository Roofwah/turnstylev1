'use server'

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { QuoteStatus } from '@prisma/client'

export async function createCampaign(data: {
  promoterName: string
  promoterAbn: string
  contactName: string
  contactEmail: string
  promoterAddress: string
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
  const promoterId = require('crypto').randomUUID()
  await prisma.$executeRawUnsafe(
    `INSERT INTO promoters (id, name, abn, contact_name, contact_email, address, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    promoterId,
    String(data.promoterName).trim(),
    data.promoterAbn ? String(data.promoterAbn).replace(/\s/g, '').trim() : null,
    data.contactName ? String(data.contactName).trim() : null,
    data.contactEmail ? String(data.contactEmail).trim() : null,
    data.promoterAddress ? String(data.promoterAddress).trim() : null,
  )
  const promoter = { id: promoterId }

  // Get or create default admin user
  // Note: This is a temporary solution until real auth is implemented
  const TEMP_USER_EMAIL = 'admin@turnstyle.com'
  const TEMP_USER_NAME = 'Admin User'
  
  const adminUser = await prisma.user.upsert({
    where: { email: TEMP_USER_EMAIL },
    update: {}, // Don't update if exists
    create: {
      email: TEMP_USER_EMAIL,
      name: TEMP_USER_NAME,
      passwordHash: 'temp-password-hash', // Will be replaced when auth is implemented
      role: 'ADMIN',
      isActive: true,
    },
  })


  const mechanicTypeMap: Record<string, string> = {
    'Sweepstakes': 'SWEEPSTAKES',
    'Instant Win': 'INSTANT_WIN',
    'Limited Offer': 'LIMITED_OFFER',
    'Game of Skill': 'GAME_OF_SKILL',
    'Other': 'OTHER',
  }
  const mechanicType = (mechanicTypeMap[data.drawMechanic] ?? 'OTHER') as any
  const campaign = await prisma.campaign.create({
    data: {
      tsCode: await (async () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      let exists = true
      while (exists) {
        code = Array.from({length: 5}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
        const existing = await prisma.campaign.findFirst({ where: { tsCode: code } })
        exists = !!existing
      }
      return code
    })(),
      promoterId: promoter.id,
      createdById: adminUser.id,
      name: data.campaignName,
      promoStart: data.promoStart ? new Date(data.promoStart) : null,
      promoEnd: data.promoEnd ? new Date(data.promoEnd) : null,
      drawFrequency: data.drawFrequency.toUpperCase() as any,
      entryMechanic: data.entryMechanic || null,
      regions: data.regions,
      prizes: data.prizes,
      prizePoolTotal,
      notes: data.notes || null,
      mechanicType,
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
    snapshotJson:  { campaign: data, quote } as any,
  },
})

try {
  const { sendDraftEmail } = await import('@/lib/email/campaign-notifications')
  await sendDraftEmail({
    campaignId:     campaign.id,
    campaignName:   campaign.name,
    tsCode:         campaign.tsCode,
    promoterName:   data.promoterName,
    promoterEmail:  data.contactEmail,
    promoStart:     data.promoStart,
    promoEnd:       data.promoEnd,
    prizePoolTotal: quote.totalIncGst,
  })
} catch (e) {
  console.error('[email] Failed to send draft email:', e)
}
redirect(`/dashboard/${campaign.id}`)
  
}