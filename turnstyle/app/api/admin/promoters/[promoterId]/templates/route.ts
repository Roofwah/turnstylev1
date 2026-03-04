import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST — add template to promoter
export async function POST(req: NextRequest, { params }: { params: Promise<{ promoterId: string }> }) {
  const body = await req.json()
  const { name, templateFileId, mechanicType, drawFrequency, regions, entryMechanic, notes } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
  }

  const { promoterId } = await params
  const template = await prisma.promoterTemplate.create({
    data: {
      promoterId:     promoterId,
      name:           name.trim(),
      templateFileId: templateFileId ?? 'generic-trade',
      mechanicType:   mechanicType   ?? 'SWEEPSTAKES',
      drawFrequency:  drawFrequency  ?? 'AT_CONCLUSION',
      regions:        regions        ?? [],
      entryMechanic:  entryMechanic  || null,
      notes:          notes          || null,
    },
  })

  return NextResponse.json(template)
}