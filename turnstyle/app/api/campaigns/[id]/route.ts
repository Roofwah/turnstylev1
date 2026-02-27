import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
