import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

// POST — save a new terms draft
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaignId, content, gapAnswers, templateId } = body

    console.log('POST /api/terms - Received:', {
      campaignId,
      contentLength: content?.length,
      templateId,
      hasGapAnswers: !!gapAnswers,
      gapAnswersKeys: gapAnswers ? Object.keys(gapAnswers) : [],
    })

    if (!campaignId || !content || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields', received: { campaignId: !!campaignId, content: !!content, templateId: !!templateId } },
        { status: 400 }
      )
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: `Campaign with id ${campaignId} not found` }, { status: 404 })
    }

    // Type assertion needed until Prisma client is regenerated with TermsDraft model
    const termsDraftModel = (prisma as any).termsDraft
    
    const latest = await termsDraftModel.findFirst({
      where:   { campaignId },
      orderBy: { version: 'desc' },
    })

    const version = latest ? latest.version + 1 : 1
    const shareToken = randomBytes(32).toString('hex')

    const draft = await termsDraftModel.create({
      data: {
        campaignId,
        version,
        content,
        gapAnswers: gapAnswers ?? {},
        templateId,
        shareToken,
        status: 'DRAFT', // Using string - Prisma will accept enum value as string
      },
    })

    console.log('POST /api/terms - Success:', { draftId: draft.id, version: draft.version })
    return NextResponse.json(draft)
  } catch (e: any) {
    console.error('POST /api/terms error:', e)
    console.error('Error stack:', e.stack)
    return NextResponse.json(
      { error: e.message, details: e.code || 'UNKNOWN_ERROR' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }

    // Type assertion needed until Prisma client is regenerated with TermsDraft model
    const termsDraftModel = (prisma as any).termsDraft
    
    const drafts = await termsDraftModel.findMany({
      where:   { campaignId },
      orderBy: { version: 'desc' },
      include: {
        comments:  { where: { status: 'OPEN' } },
        approvals: true,
      },
    })

    return NextResponse.json(drafts)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}