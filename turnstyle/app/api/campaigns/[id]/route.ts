import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateQuote } from '@/app/actions/generateQuote'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        promoter: true,
        quotes: {
          orderBy: { createdAt: 'desc' },
        },
        termsDrafts: {
          orderBy: { createdAt: 'desc' },
          include: {
            approvals: true,
            comments: true,
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(campaign)
  } catch (e: any) {
    console.error('GET /api/campaigns/[id] error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // Determine if this change should trigger a quote regeneration
    const quoteAffectingFields = ['prizes', 'confirmedPrizes', 'prizePoolTotal', 'drawSchedule']
    const shouldRegenerateQuote = quoteAffectingFields.some(f => body[f] !== undefined)

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        // Draw schedule & permits
        ...(body.drawSchedule   !== undefined && { drawSchedule:   body.drawSchedule }),
        ...(body.drawConfirmed  !== undefined && { drawConfirmed:  body.drawConfirmed }),
        ...(body.permitLOASigned !== undefined && { permitLOASigned: body.permitLOASigned }),
        ...(body.permitNSW      !== undefined && { permitNSW:      body.permitNSW }),
        ...(body.permitSA       !== undefined && { permitSA:       body.permitSA }),
        ...(body.permitACT      !== undefined && { permitACT:      body.permitACT }),       // Prizes
        ...(body.prizes         !== undefined && { prizes:         body.prizes }),
        ...(body.confirmedPrizes !== undefined && { confirmedPrizes: body.confirmedPrizes }),
        ...(body.prizesConfirmed !== undefined && { prizesConfirmed: body.prizesConfirmed }),
        ...(body.prizePoolTotal !== undefined && { prizePoolTotal: body.prizePoolTotal }),
        ...(body.maxStatePool   !== undefined && { maxStatePool:   body.maxStatePool }),
        ...(body.requiredPermits !== undefined && { requiredPermits: body.requiredPermits }),
      
      
     
      
      },
    })

    // Regenerate quote if prize pool or draw schedule changed
    if (shouldRegenerateQuote) {
      await generateQuote(id)
    }

    return NextResponse.json(campaign)
  } catch (e: any) {
    console.error('PATCH /api/campaigns/[id] error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to update campaign' },
      { status: 500 }
    )
  }
}