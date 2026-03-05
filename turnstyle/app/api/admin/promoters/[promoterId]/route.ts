import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ promoterId: string }> }) {
  const { promoterId } = await params
  const promoter = await prisma.promoter.findUnique({
    where:   { id: promoterId },
    include: { templates: { orderBy: { createdAt: 'asc' } } },
  })
  if (!promoter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(promoter)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ promoterId: string }> }) {
  const { promoterId } = await params
  const body = await req.json()
  const { name, abn, address, contactName, contactEmail, contactPhone } = body
  const promoter = await prisma.promoter.update({
    where: { id: promoterId },
    data: {
      name:         name?.trim()         || undefined,
      abn:          abn?.trim()          || null,
      address:      address?.trim()      || null,
      contactName:  contactName?.trim()  || null,
      contactEmail: contactEmail?.trim() || null,
    },
  })
  return NextResponse.json(promoter)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ promoterId: string }> }) {
  try {
    const { promoterId } = await params
    await prisma.promoter.delete({ where: { id: promoterId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
