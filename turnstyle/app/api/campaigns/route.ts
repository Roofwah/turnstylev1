import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        promoter: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(campaigns)
  } catch (e: any) {
    console.error('GET /api/campaigns error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}
