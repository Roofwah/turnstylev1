import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignStatus } from '@prisma/client'

const LIFECYCLE_STAGES: CampaignStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'COMPILED',
  'REVIEW',
  'PENDING',
  'SCHEDULED',
  'LIVE',
  'CLOSED',
  'DRAWN',
  'ARCHIVED',
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
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status is a valid lifecycle stage
    if (!LIFECYCLE_STAGES.includes(newStatus as CampaignStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${LIFECYCLE_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch current campaign with related data for prerequisite validation
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        quotes: {
          orderBy: { createdAt: 'desc' },
        },
        termsDrafts: {
          orderBy: { createdAt: 'desc' },
          include: {
            approvals: true,
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

    const currentStatus = campaign.status as CampaignStatus
    const { force } = body // SUPER_ADMIN bypass flag
    // TODO: Get user role from session/auth - for now assume no force unless explicitly set
    const userRole = 'CLIENT' // Placeholder - replace with actual auth check

    // ── Special case: REVIEW → COMPILED rollback (only allowed backward move) ──
    if (newStatus === 'COMPILED' && currentStatus === 'REVIEW') {
      // Check that at least one CHANGES_REQUESTED approval exists
      const hasChangesRequested = campaign.termsDrafts.some((d: any) =>
        d.approvals.some((a: any) => a.status === 'CHANGES_REQUESTED')
      )
      if (!hasChangesRequested) {
        return NextResponse.json(
          { error: 'Can only roll back to COMPILED if changes have been requested by a reviewer' },
          { status: 400 }
        )
      }
      // Allow the rollback
      const updated = await prisma.campaign.update({
        where: { id },
        data: { status: 'COMPILED' as CampaignStatus },
        include: {
          promoter: true,
          quotes: { orderBy: { createdAt: 'desc' } },
          termsDrafts: {
            orderBy: { createdAt: 'desc' },
            include: { approvals: true },
          },
        },
      })
      return NextResponse.json(updated)
    }

    // Validate forward progression - only allow moving one step forward
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

    // Validate prerequisites based on current status
    let prerequisiteError: string | null = null

    switch (currentStatus) {
      case 'DRAFT':
        // DRAFT → CONFIRMED: only when quote is approved (APPROVED or ACCEPTED)
        if (newStatus === 'CONFIRMED') {
          const hasApprovedQuote = campaign.quotes.some(q => 
            q.status === 'APPROVED' || q.status === 'ACCEPTED'
          )
          if (!hasApprovedQuote) {
            prerequisiteError = 'Quote must be approved before advancing to CONFIRMED'
          }
        }
        break

      case 'CONFIRMED':
        // CONFIRMED → COMPILED: only when a TermsDraft exists
        if (newStatus === 'COMPILED') {
          if (!campaign.termsDrafts || campaign.termsDrafts.length === 0) {
            prerequisiteError = 'Terms must be built before advancing to COMPILED'
          }
        }
        break

      case 'COMPILED':
        // COMPILED → REVIEW: requires sharedAt not null AND at least one TermsApproval with status APPROVED
        if (newStatus === 'REVIEW') {
          const latestDraft = campaign.termsDrafts[0] // Already ordered by createdAt desc
          if (!latestDraft?.sharedAt) {
            prerequisiteError = 'Terms must be shared (sharedAt timestamp required) before advancing to REVIEW'
          } else {
            const hasApproval = campaign.termsDrafts.some((d: any) =>
              d.approvals.some((a: any) => a.status === 'APPROVED')
            )
            if (!hasApproval) {
              prerequisiteError = 'Terms must be approved before advancing to REVIEW'
            }
          }
        }
        break

      case 'REVIEW':
        // REVIEW → PENDING: only when at least one TermsApproval with status APPROVED exists
        if (newStatus === 'PENDING') {
          const hasApproval = campaign.termsDrafts.some((d: any) =>
            d.approvals.some((a: any) => a.status === 'APPROVED')
          )
          if (!hasApproval) {
            prerequisiteError = 'Terms must be approved before advancing to PENDING'
          }
        }
        break

      case 'PENDING':
        // PENDING → SCHEDULED: requires permits and LOA (unless SUPER_ADMIN force)
        if (newStatus === 'SCHEDULED') {
          if (force && userRole === 'SUPER_ADMIN') {
            // Skip permit checks for SUPER_ADMIN with force flag
            break
          }
          
          const pool = Number(campaign.prizePoolTotal)
          const needsACT = pool >= 3000
          const needsSA = pool >= 5000
          const needsNSW = pool >= 10000

          const permitErrors: string[] = []
          if (needsACT && !campaign.permitACT) permitErrors.push('ACT permit number required')
          if (needsSA && !campaign.permitSA) permitErrors.push('SA permit number required')
          if (needsNSW && !campaign.permitNSW) permitErrors.push('NSW permit number required')
          if ((needsACT || needsSA || needsNSW) && !campaign.permitLOASigned) {
            permitErrors.push('Letter of Authority must be signed before scheduling')
          }

          if (permitErrors.length > 0) {
            prerequisiteError = permitErrors.join(', ')
          }
        }
        break

      case 'CLOSED':
        // CLOSED → DRAWN: only when draw dataset has been uploaded
        if (newStatus === 'DRAWN') {
          if (!campaign.drawDatasetUploadedAt) {
            prerequisiteError = 'Draw dataset must be uploaded before advancing to DRAWN'
          }
        }
        break

      case 'DRAWN':
        // DRAWN → ARCHIVED: only when winners have been confirmed
        if (newStatus === 'ARCHIVED') {
          if (!campaign.winnersConfirmedAt) {
            prerequisiteError = 'Winners must be confirmed before advancing to ARCHIVED'
          }
        }
        break
    }

    if (prerequisiteError) {
      return NextResponse.json(
        { error: prerequisiteError },
        { status: 400 }
      )
    }

    // Update campaign status
    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: newStatus as CampaignStatus },
      include: {
        promoter: true,
        quotes: {
          orderBy: { createdAt: 'desc' },
        },
        termsDrafts: {
          orderBy: { createdAt: 'desc' },
          include: {
            approvals: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/campaigns/[id]/status error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to update campaign status' },
      { status: 500 }
    )
  }
}
