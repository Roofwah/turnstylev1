import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE — remove template from promoter
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { promoterId: string; templateId: string } }
) {
  await prisma.promoterTemplate.delete({ where: { id: params.templateId } })
  return NextResponse.json({ ok: true })
}