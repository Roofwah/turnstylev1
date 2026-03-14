// app/api/admin/promoters/[promoterId]/templates/route.ts
// Manages per-promoter template routing records.
// These act as a DB override table — mapping a promoter + mechanic combination
// to a specific file-based template ID (Option C hybrid architecture).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAllTemplates } from '@/lib/terms-templates'

// GET — list templates for a promoter + available file-based templates
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ promoterId: string }> }
) {
  const { promoterId } = await params

  const [dbTemplates, fileTemplates] = await Promise.all([
    prisma.promoterTemplate.findMany({
      where: { promoterId },
      orderBy: { createdAt: 'desc' },
    }),
    Promise.resolve(getAllTemplates().map(t => ({
      id: t.meta.id,
      name: t.meta.name,
      audience: t.meta.audience,
      mechanic: t.meta.mechanic,
      drawFrequency: t.meta.drawFrequency,
      entryMechanic: t.meta.entryMechanic,
      description: t.meta.description,
    }))),
  ])

  return NextResponse.json({ dbTemplates, fileTemplates })
}

// POST — create a template routing record for a promoter
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ promoterId: string }> }
) {
  const body = await req.json()
  const {
    name,
    templateFileId,  // maps to a file-based template id e.g. 'repco-trade'
    mechanicType,
    drawFrequency,
    regions,
    entryMechanic,
    notes,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
  }

  if (!templateFileId?.trim()) {
    return NextResponse.json({ error: 'templateFileId is required — must reference a valid file-based template id' }, { status: 400 })
  }

  // Validate templateFileId references a known file-based template
  const known = getAllTemplates().map(t => t.meta.id)
  if (!known.includes(templateFileId)) {
    return NextResponse.json({
      error: `Unknown templateFileId "${templateFileId}". Valid values: ${known.join(', ')}`,
    }, { status: 400 })
  }

  const { promoterId } = await params
  const template = await prisma.promoterTemplate.create({
    data: {
      promoterId,
      name:           name.trim(),
      templateFileId,
      mechanicType:   mechanicType  ?? 'SWEEPSTAKES',
      drawFrequency:  drawFrequency ?? 'AT_CONCLUSION',
      regions:        regions       ?? [],
      entryMechanic:  entryMechanic || null,
      notes:          notes         || null,
    },
  })

  return NextResponse.json(template)
}
