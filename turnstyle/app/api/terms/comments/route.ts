import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')
    const status = searchParams.get('status') // optional: OPEN, RESOLVED, or ALL

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId required' },
        { status: 400 }
      )
    }

    const termsComment = (prisma as any).termsComment

    const where: any = {
      draft: { campaignId },
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    const comments = await termsComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        draft: {
          select: {
            id: true,
            version: true,
            templateId: true,
          },
        },
      },
    })

    return NextResponse.json(comments)
  } catch (e: any) {
    console.error('GET /api/terms/comments error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to load comments' },
      { status: 500 }
    )
  }
}

