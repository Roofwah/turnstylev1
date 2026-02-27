import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH — update permit fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { permitNSW, permitSA, permitACT, permitLOASigned } = body

    // TODO: Add auth check - only SUPER_ADMIN can update permits
    // const userRole = await getUserRole(req)
    // if (userRole !== 'SUPER_ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    const updateData: any = {}
    if (permitNSW !== undefined) updateData.permitNSW = permitNSW
    if (permitSA !== undefined) updateData.permitSA = permitSA
    if (permitACT !== undefined) updateData.permitACT = permitACT
    if (permitLOASigned !== undefined) updateData.permitLOASigned = permitLOASigned

    const updated = await prisma.campaign.update({
      where: { id },
      data: updateData,
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
  } catch (e: any) {
    console.error('PATCH /api/campaigns/[id]/permits error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to update permits' },
      { status: 500 }
    )
  }
}
