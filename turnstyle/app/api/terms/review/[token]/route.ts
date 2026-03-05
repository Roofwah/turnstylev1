import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const termsDraft = (prisma as any).termsDraft
    
    const draft = await termsDraft.findUnique({
      where:   { shareToken: token },
      include: {
        comments:  { where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' } },
        approvals: true,
        campaign:  { select: { name: true, tsCode: true, status: true, id: true } },
      },
    })

    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Lock review if campaign has been submitted (PENDING or beyond)
    const lockedStatuses = ['PENDING', 'SCHEDULED', 'LIVE', 'CLOSED', 'DRAWN', 'ARCHIVED']
    if (lockedStatuses.includes(draft.campaign?.status)) {
      return NextResponse.json({ error: 'These terms have been submitted and are no longer open for review.', locked: true }, { status: 403 })
    }

    // Set status to IN_REVIEW on first access
    if (draft.status === 'DRAFT') {
      await termsDraft.update({
        where: { id: draft.id },
        data: { status: 'IN_REVIEW' },
      })
      draft.status = 'IN_REVIEW'

      // Advance campaign status from COMPILED → REVIEW when share link is first accessed
      if (draft.campaign?.status === 'COMPILED') {
        await prisma.campaign.update({
          where: { id: draft.campaign.id },
          data: { status: 'REVIEW' as CampaignStatus },
        })
      }
    }

    return NextResponse.json(draft)
  } catch (e: any) {
    console.error('GET /api/terms/review/[token] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}