// app/api/campaigns/[id]/save-quote/route.ts
// Saves a calculated quote to the DB so confirmQuote() can find it.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id: campaignId } = await params
    const body = await req.json()
    const {
      termsFee,
      mgmtFee,
      permitFee,
      drawFee,
      totalExGst,
      gstAmount,
      totalIncGst,
      quoteNumber,
      validUntil,
      engineVersion,
      snapshotJson,
    } = body

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 })
    }

    // Build a stable hash for upsert key
    const quoteHash = `quote-${campaignId}-${quoteNumber}`

    // Upsert: update if a DRAFT quote already exists, otherwise create
    const existing = await prisma.quote.findFirst({
      where: { campaignId, status: 'DRAFT' },
    })

    let quote
    if (existing) {
      quote = await prisma.quote.update({
        where: { id: existing.id },
        data: {
          quoteNumber,
          quoteHash,
          termsFee:      termsFee      ?? 0,
          mgmtFee:       mgmtFee       ?? 0,
          permitFee:     permitFee     ?? 0,
          drawFee:       drawFee       ?? 0,
          totalExGst:    totalExGst    ?? 0,
          gstAmount:     gstAmount     ?? 0,
          totalIncGst:   totalIncGst   ?? 0,
          validUntil:    new Date(validUntil),
          engineVersion: engineVersion ?? '1.0',
          snapshotJson:  snapshotJson  ?? {},
        },
      })
    } else {
      quote = await prisma.quote.create({
        data: {
          campaignId,
          quoteNumber,
          quoteHash,
          status:        'DRAFT' as any,
          termsFee:      termsFee      ?? 0,
          mgmtFee:       mgmtFee       ?? 0,
          permitFee:     permitFee     ?? 0,
          drawFee:       drawFee       ?? 0,
          totalExGst:    totalExGst    ?? 0,
          gstAmount:     gstAmount     ?? 0,
          totalIncGst:   totalIncGst   ?? 0,
          validUntil:    new Date(validUntil),
          engineVersion: engineVersion ?? '1.0',
          snapshotJson:  snapshotJson  ?? {},
        },
      })
    }

    return NextResponse.json({ id: quote.id, quoteNumber: quote.quoteNumber })
  } catch (error: any) {
    console.error('[SAVE-QUOTE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
