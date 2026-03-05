import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const promoters = await prisma.promoter.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(promoters)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, abn, address, contactName, contactEmail } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const promoter = await prisma.promoter.create({
    data: {
      name:         name.trim(),
      abn:          abn?.trim()          || null,
      address:      address?.trim()      || null,
      contactName:  contactName?.trim()  || null,
      contactEmail: contactEmail?.trim() || null,
    },
  })

  return NextResponse.json(promoter)
}