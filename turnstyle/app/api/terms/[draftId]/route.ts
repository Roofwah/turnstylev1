import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const draft = await prisma.termsDraft.findUnique({
      where:   { id: params.draftId },
      include: {
        comments:  { orderBy: { createdAt: 'asc' } },
        approvals: true,
        campaign:  { select: { name: true, tsCode: true } },
      },
    })
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(draft)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { draftId: string } }) {
  try {
    const body = await req.json()
    const draft = await prisma.termsDraft.update({
      where: { id: params.draftId },
      data:  { status: body.status },
    })
    return NextResponse.json(draft)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}