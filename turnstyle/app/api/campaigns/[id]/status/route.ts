import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'
import { sendCampaignStatusEmail } from '@/lib/email/campaign-notifications'

const LIFECYCLE_STAGES: CampaignStatus[] = [
  'DRAFT', 'CONFIRMED', 'COMPILED', 'REVIEW', 'PENDING',
  'SCHEDULED', 'LIVE', 'CLOSED', 'DRAWN', 'ARCHIVED',
]

function getStageIndex(status: CampaignStatus): number {
  return LIFECYCLE_STAGES.indexOf(status)
}

function isForwardProgression(current: CampaignStatus, next: CampaignStatus): boolean {
  const currentIdx = getStageIndex(current)
  const nextIdx = getStageIndex(next)
  return nextIdx > currentIdx && nextIdx === currentIdx + 1
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    if (!LIFECYCLE_STAGES.includes(newStatus as CampaignStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${LIFECYCLE_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        promoter: true,
        quotes: { orderBy: { createdAt: 'desc' } },
        termsDrafts: {
          orderBy: { createdAt: 'desc' },
          include: { approvals: true },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const currentStatus = campaign.status as CampaignStatus
    const { force } = body
    const userRole = 'CLIENT'

    // ── REVIEW → COMPILED rollback ──
    if (newStatus === 'COMPILED' && currentStatus === 'REVIEW') {
      const hasChangesRequested = campaign.termsDrafts.some((d: any) =>
        d.approvals.some((a: any) => a.status === 'CHANGES_REQUESTED')
      )
      if (!hasChangesRequested) {
        return NextResponse.json(
          { error: 'Can only roll back to COMPILED if changes have been requested by a reviewer' },
          { status: 400 }
        )
      }
      await prisma.$executeRawUnsafe(
        `UPDATE campaigns SET status = $1::"CampaignStatus" WHERE id = $2`,
        'COMPILED', id
      )
      const updated = await prisma.campaign.findUnique({
        where: { id },
        include: {
          promoter: true,
          quotes: { orderBy: { createdAt: 'desc' } },
          termsDrafts: { orderBy: { createdAt: 'desc' }, include: { approvals: true } },
        },
      })
      return NextResponse.json(updated)
    }

    if (!isForwardProgression(currentStatus, newStatus as CampaignStatus)) {
      return NextResponse.json(
        {
          error: `Cannot move from ${currentStatus} to ${newStatus}. Only forward progression is allowed.`,
          currentStatus,
          requestedStatus: newStatus,
        },
        { status: 400 }
      )
    }

    let prerequisiteError: string | null = null

    switch (currentStatus) {
      case 'DRAFT':
        if (newStatus === 'CONFIRMED') {
          const hasApprovedQuote = campaign.quotes.some(q =>
            q.status === 'APPROVED' || q.status === 'ACCEPTED'
          )
          if (!hasApprovedQuote) prerequisiteError = 'Quote must be approved before advancing to CONFIRMED'
        }
        break

      case 'CONFIRMED':
        if (newStatus === 'COMPILED') {
          if (!campaign.termsDrafts || campaign.termsDrafts.length === 0)
            prerequisiteError = 'Terms must be built before advancing to COMPILED'
        }
        break

      case 'COMPILED':
        if (newStatus === 'REVIEW') {
          const latestDraft = campaign.termsDrafts[0]
          if (!latestDraft?.shareToken) prerequisiteError = 'Terms must be saved before advancing to REVIEW'
        }
        break

      case 'REVIEW':
        if (newStatus === 'PENDING') {
          const hasApproval = campaign.termsDrafts.some((d: any) =>
            d.approvals.some((a: any) => a.status === 'APPROVED')
          )
          if (!hasApproval) prerequisiteError = 'Terms must be approved before advancing to PENDING'
        }
        break

      case 'PENDING':
        if (newStatus === 'SCHEDULED') {
          if (force && userRole === 'SUPER_ADMIN') break
          const pool = Number(campaign.prizePoolTotal)
          const needsACT = pool >= 3000
          const needsSA = pool >= 5000
          const needsNSW = pool >= 10000
          const permitErrors: string[] = []
          if (needsACT && !campaign.permitACT) permitErrors.push('ACT permit number required')
          if (needsSA && !campaign.permitSA) permitErrors.push('SA permit number required')
          if (needsNSW && !campaign.permitNSW) permitErrors.push('NSW permit number required')
          if ((needsACT || needsSA || needsNSW) && !campaign.permitLOASigned)
            permitErrors.push('Letter of Authority must be signed before scheduling')
          if (permitErrors.length > 0) prerequisiteError = permitErrors.join(', ')
        }
        break

      case 'CLOSED':
        if (newStatus === 'DRAWN') {
          if (!campaign.drawDatasetUploadedAt)
            prerequisiteError = 'Draw dataset must be uploaded before advancing to DRAWN'
        }
        break

      case 'DRAWN':
        if (newStatus === 'ARCHIVED') {
          if (!campaign.winnersConfirmedAt)
            prerequisiteError = 'Winners must be confirmed before advancing to ARCHIVED'
        }
        break
    }

    if (prerequisiteError) {
      return NextResponse.json({ error: prerequisiteError }, { status: 400 })
    }

    // Update status
    await prisma.$executeRawUnsafe(
      `UPDATE campaigns SET status = $1::"CampaignStatus" WHERE id = $2`,
      newStatus, id
    )

    const updated = await prisma.campaign.findUnique({
      where: { id },
      include: {
        promoter: true,
        quotes: { orderBy: { createdAt: 'desc' } },
        termsDrafts: { orderBy: { createdAt: 'desc' }, include: { approvals: true } },
      },
    })

    // Send email notification
    try {
      const emailData = {
        campaignId: id,
        campaignName: updated!.name,
        tsCode: updated!.tsCode,
        promoterName: updated!.promoter?.name || 'there',
        promoterEmail: updated!.promoter?.contactEmail || null,
        promoStart: updated!.promoStart?.toISOString() || null,
        promoEnd: updated!.promoEnd?.toISOString() || null,
        prizePoolTotal: Number(updated!.prizePoolTotal),
        shareToken: updated!.termsDrafts?.[0]?.shareToken || null,
        threadMessageId: (updated as any).threadMessageId || null,
        permitNSW: updated!.permitNSW,
        permitSA: updated!.permitSA,
        permitACT: updated!.permitACT,
      }

      const messageId = await sendCampaignStatusEmail(newStatus, emailData)

      // Store first messageId as thread anchor
      if (messageId && !(updated as any).threadMessageId) {
        await prisma.$executeRawUnsafe(
          `UPDATE campaigns SET thread_message_id = $1 WHERE id = $2`,
          messageId, id
        )
      }
    } catch (emailErr) {
      console.error('Email notification failed (non-fatal):', emailErr)
    }

    return NextResponse.json(updated)

  } catch (e: any) {
    console.error('PATCH /api/campaigns/[id]/status error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to update campaign status' },
      { status: 500 }
    )
  }
}
