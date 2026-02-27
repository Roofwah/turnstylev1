import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params
    const body = await req.json()
    const { approverName, approverEmail, status, note } = body

    if (!approverName || !approverEmail || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const termsApproval = (prisma as any).termsApproval
    const existing = await termsApproval.findFirst({
      where: { termsDraftId: draftId, approverEmail },
    })

    const approval = existing
      ? await termsApproval.update({
          where: { id: existing.id },
          data:  { status, note: note || null, respondedAt: new Date() },
        })
      : await termsApproval.create({
          data: {
            termsDraftId:  draftId,
            approverName,
            approverEmail,
            status,
            note:          note || null,
            respondedAt:   new Date(),
          },
        })

    const allApprovals = await termsApproval.findMany({
      where: { termsDraftId: draftId },
    })

    const allApproved = allApprovals.length > 0 && allApprovals.every((a: any) => a.status === 'APPROVED')

    if (allApproved) {
      const termsDraft = (prisma as any).termsDraft
      await termsDraft.update({
        where: { id: draftId },
        data:  { status: 'APPROVED' },
      })
    }

    return NextResponse.json(approval)
  } catch (e: any) {
    console.error('POST /api/terms/[draftId]/approve error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}