import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params
    const termsDraft = (prisma as any).termsDraft
    const draft = await termsDraft.findUnique({
      where:   { id: draftId },
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params
    const body = await req.json()
    const termsDraft = (prisma as any).termsDraft
    const draft = await termsDraft.update({
      where: { id: draftId },
      data:  { status: body.status },
    })
    return NextResponse.json(draft)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}