import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE — remove template from promoter
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ promoterId: string; templateId: string }> }
) {
  const { templateId } = await params
  await prisma.promoterTemplate.delete({ where: { id: templateId } })
  return NextResponse.json({ ok: true })
}