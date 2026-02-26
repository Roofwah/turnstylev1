import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const body = await req.json()
    const { approverName, approverEmail, status, note } = body

    if (!approverName || !approverEmail || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await prisma.termsApproval.findFirst({
      where: { termsDraftId: params.draftId, approverEmail },
    })

    const approval = existing
      ? await prisma.termsApproval.update({
          where: { id: existing.id },
          data:  { status, note: note || null, respondedAt: new Date() },
        })
      : await prisma.termsApproval.create({
          data: {
            termsDraftId:  params.draftId,
            approverName,
            approverEmail,
            status,
            note:          note || null,
            respondedAt:   new Date(),
          },
        })

    const allApprovals = await prisma.termsApproval.findMany({
      where: { termsDraftId: params.draftId },
    })

    const allApproved = allApprovals.length > 0 && allApprovals.every(a => a.status === 'APPROVED')

    if (allApproved) {
      await prisma.termsDraft.update({
        where: { id: params.draftId },
        data:  { status: 'APPROVED' },
      })
    }

    return NextResponse.json(approval)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}