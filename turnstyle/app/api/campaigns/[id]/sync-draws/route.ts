import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { schedulePurerandomDraw } from '@/lib/purerandom'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const drawSchedule: any[] = Array.isArray((campaign as any).drawSchedule) ? (campaign as any).drawSchedule : []

  const updatedSchedule = await Promise.all(drawSchedule.map(async (event: any) => {
    if (event.purerandomId) return event
    const result = await schedulePurerandomDraw({
      promotionName: campaign.name,
      tsCode: campaign.tsCode,
      drawName: event.name,
      drawDate: event.drawDate,
      drawTime: '10:00',
      numWinners: event.winners || 1,
    })
    if (result) {
      return { ...event, purerandomId: result.drawId, uploadUrl: result.uploadUrl, scheduled: true }
    }
    return event
  }))

  await prisma.$executeRawUnsafe(
    `UPDATE campaigns SET draw_schedule = $1::jsonb WHERE id = $2`,
    JSON.stringify(updatedSchedule), id
  )

  return NextResponse.json({ schedule: updatedSchedule })
}
