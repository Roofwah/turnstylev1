import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const draft = await prisma.termsDraft.findUnique({
      where:   { shareToken: params.token },
      include: {
        comments:  { where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' } },
        approvals: true,
        campaign:  { select: { name: true, tsCode: true } },
      },
    })

    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (draft.status === 'DRAFT') {
      await prisma.termsDraft.update({
        where: { id: draft.id },
        data:  { status: 'IN_REVIEW' },
      })
    }

    return NextResponse.json(draft)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}