import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function generateTsCode(): string {
  const year = new Date().getFullYear().toString().slice(2)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = `TS${year}`
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { promoter, campaignName, mechanicType, promoStart, promoEnd, regions, entryMechanic } = body

    if (!promoter?.name || !campaignName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find or upsert promoter
    let promoterRecord = await prisma.promoter.findFirst({
      where: { name: { equals: promoter.name, mode: 'insensitive' } },
    })

    if (!promoterRecord) {
      promoterRecord = await prisma.promoter.create({
        data: {
          name: promoter.name,
          abn: promoter.abn ?? '',
          contactName: promoter.contactName ?? '',
          contactEmail: promoter.contactEmail ?? '',
          address: promoter.address ?? '',
        },
      })
    } else {
      promoterRecord = await prisma.promoter.update({
        where: { id: promoterRecord.id },
        data: {
          ...(promoter.abn && { abn: promoter.abn }),
          ...(promoter.contactName && { contactName: promoter.contactName }),
          ...(promoter.contactEmail && { contactEmail: promoter.contactEmail }),
          ...(promoter.address && { address: promoter.address }),
        },
      })
    }

    // Get the first admin user
    const adminUser = await prisma.user.findFirst()
    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user found' }, { status: 400 })
    }

    // Generate unique TS code
    let tsCode = generateTsCode()
    for (let i = 0; i < 10; i++) {
      const existing = await prisma.campaign.findUnique({ where: { tsCode } })
      if (!existing) break
      tsCode = generateTsCode()
    }

    const campaign = await prisma.campaign.create({
      data: {
        tsCode,
        name: campaignName,
        mechanicType: mechanicType as any,
        promoterId: promoterRecord.id,
        createdById: adminUser.id,
        promoStart: promoStart ? new Date(promoStart) : null,
        promoEnd: promoEnd ? new Date(promoEnd) : null,
        regions: regions ?? [],
        entryMechanic: entryMechanic ?? '',
        prizes: [],
        status: 'DRAFT',
      },
    })

    // Auto-generate a quote immediately so confirmQuote() can always find one
    try {
      const { calculateQuote } = await import('@/lib/quote-engine')
      const mechLabel = mechanicType === 'SWEEPSTAKES'   ? 'Sweepstakes - Random Draw'
                      : mechanicType === 'LIMITED_OFFER' ? 'Limited Offer'
                      : 'Other'
      const quote = calculateQuote({
        campaignId:    campaign.id,
        tsCode:        campaign.tsCode,
        campaignName,
        promoStart:    promoStart ?? '',
        promoEnd:      promoEnd ?? '',
        drawMechanic:  mechLabel,
        drawFrequency: 'at_conclusion',
        prizes:        [],
      })
      await prisma.quote.create({
        data: {
          campaignId:    campaign.id,
          quoteNumber:   quote.quoteNumber,
          quoteHash:     quote.quoteHash,
          status:        'DRAFT' as any,
          termsFee:      quote.termsFee      ?? 0,
          mgmtFee:       quote.mgmtFee       ?? 0,
          permitFee:     quote.permitFee     ?? 0,
          drawFee:       quote.drawFee       ?? 0,
          totalExGst:    quote.totalExGst,
          gstAmount:     quote.gstAmount,
          totalIncGst:   quote.totalIncGst,
          validUntil:    new Date(quote.validUntil),
          engineVersion: '0.1.5',
          snapshotJson:  { campaign: body, quote } as any,
        },
      })
    } catch (qErr) {
      console.error('[EXPRESS] Quote pre-generation failed (non-fatal):', qErr)
    }

    return NextResponse.json({ id: campaign.id, tsCode: campaign.tsCode })
  } catch (error: any) {
    console.error('[EXPRESS] Campaign creation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}