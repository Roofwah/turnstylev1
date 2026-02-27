import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateLOA } from '@/lib/loa-template'

// GET — generate LOA document for this campaign
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // TODO: Add auth check - only SUPER_ADMIN or campaign owner can access
    // const userRole = await getUserRole(req)
    // const isOwner = await isCampaignOwner(req, id)
    // if (userRole !== 'SUPER_ADMIN' && !isOwner) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        promoter: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.promoter) {
      return NextResponse.json(
        { error: 'Campaign must have a promoter to generate LOA' },
        { status: 400 }
      )
    }

    // For now, return plain text - can be extended to generate PDF
    const loaText = generateLOA({
      promoterName: campaign.promoter.name,
      abn: campaign.promoter.abn || '[ABN not set]',
      address: campaign.promoter.address || '[Address not set]',
      promotionName: campaign.name,
      authorisedPersonName: '[To be filled]',
      agencyName: 'Flow Marketing Pty Ltd',
      position: '[To be filled]',
      date: new Date().toLocaleDateString('en-AU'),
    })

    return new Response(loaText, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (e: any) {
    console.error('GET /api/campaigns/[id]/loa error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to generate LOA' },
      { status: 500 }
    )
  }
}
