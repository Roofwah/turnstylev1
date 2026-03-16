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
  prizes: { tier: string; description: string; type?: string; qty: number; unitValue: number }[]
  requiredPermits?: string[]    // states requiring permits e.g. ['ACT', 'SA']
  maxStatePool?: number         // per-state prize pool used for permit threshold calculation
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
    'Draw Only': 'DRAW_ONLY',
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
      requiredPermits: data.requiredPermits ?? [],
      maxStatePool: data.maxStatePool ?? 0,
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
redirect(`/dashboard/lite/${campaign.id}?created=1`)

}
export async function createDrawOnlyCampaign(data: {
  promoterName: string
  promoterAbn: string
  contactName: string
  contactEmail: string
  promoterAddress: string
  campaignName: string
  draws: { drawDate: string; drawTime: string; winners: number }[]
  prizes: { tier: string; description: string; qty: number; unitValue: number }[]
}) {
  const prizePoolTotal = data.prizes.reduce((s, p) => s + p.qty * p.unitValue, 0)
  const draws = data.draws.length ? data.draws : [{ drawDate: '', drawTime: '12:00', winners: 1 }]
  const validDraws = draws.filter(d => d.drawDate && d.drawTime)
  if (!validDraws.length) throw new Error('At least one draw with date and time is required')

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

  // Get or create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@turnstyle.com' },
    update: {},
    create: {
      email: 'admin@turnstyle.com',
      name: 'Admin User',
      passwordHash: 'temp-password-hash',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Generate unique tsCode
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tsCode = ''
  let exists = true
  while (exists) {
    tsCode = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const existing = await prisma.campaign.findFirst({ where: { tsCode } })
    exists = !!existing
  }

  const firstDraw = new Date(`${validDraws[0].drawDate}T${validDraws[0].drawTime}:00`)
  const lastDraw = new Date(`${validDraws[validDraws.length - 1].drawDate}T${validDraws[validDraws.length - 1].drawTime}:00`)
  const drawSchedule = validDraws.map((d, i) => ({
    id: `major-${i + 1}`,
    name: validDraws.length > 1 ? `Draw ${i + 1}` : 'Draw',
    type: 'major' as const,
    winners: Math.max(1, Number(d.winners) || 1),
    drawDate: d.drawDate,
    drawTime: d.drawTime,
    periodStart: d.drawDate,
    periodEnd: d.drawDate,
  }))

  const campaign = await prisma.campaign.create({
    data: {
      tsCode,
      promoterId,
      createdById: adminUser.id,
      name: data.campaignName,
      promoStart: firstDraw,
      promoEnd: lastDraw,
      drawFrequency: 'AT_CONCLUSION',
      entryMechanic: null,
      regions: ['national_au'],
      prizes: data.prizes,
      prizePoolTotal,
      notes: null,
      mechanicType: 'DRAW_ONLY',
      status: 'DRAFT',
      drawSchedule,
    },
  })

  // Create Draw Only quote
  const { calcDrawFee } = await import('@/lib/quote-engine')
  const drawFee = calcDrawFee(validDraws.length)
  const mgmtFee = 100
  const totalExGst = drawFee + mgmtFee
  const gstAmount = Math.round(totalExGst * 0.1 * 100) / 100
  const totalIncGst = Math.round((totalExGst + gstAmount) * 100) / 100

  const yy = new Date().getFullYear().toString().slice(-2)
  const quoteNumber = `TS${yy}${tsCode}-DO`

  await prisma.quote.create({
    data: {
      campaignId:    campaign.id,
      quoteNumber,
      quoteHash:     `draw-only-${campaign.id}`,
      status:        'DRAFT' as any,
      termsFee:      0,
      mgmtFee,
      permitFee:     0,
      drawFee,
      totalExGst,
      gstAmount,
      totalIncGst,
      validUntil:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      engineVersion: 'draw-only-1.0',
      snapshotJson:  { type: 'draw_only', campaign: data } as any,
    },
  })

  // Send draft email
  try {
    const { sendDraftEmail } = await import('@/lib/email/campaign-notifications')
    await sendDraftEmail({
      campaignId:     campaign.id,
      campaignName:   campaign.name,
      tsCode:         campaign.tsCode,
      promoterName:   data.promoterName,
      promoterEmail:  data.contactEmail,
      promoStart:     validDraws[0].drawDate,
      promoEnd:       validDraws[validDraws.length - 1].drawDate,
      prizePoolTotal: totalIncGst,
    })
  } catch (e) {
    console.error('[email] Failed to send draw only draft email:', e)
  }

  redirect(`/dashboard/lite/${campaign.id}?created=1`)
}
