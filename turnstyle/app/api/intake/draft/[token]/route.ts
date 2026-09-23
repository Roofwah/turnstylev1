import { NextRequest, NextResponse } from 'next/server'
import { getIntakeDraftByToken, updateIntakeDraftJson } from '@/lib/intake/drafts'
import { generateSummary } from '@/lib/intake/generateSummary'
import type { ExtractedCampaignIntake } from '@/lib/intake/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const draft = await getIntakeDraftByToken(token)
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }
    return NextResponse.json(draft)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load draft'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const intake = body.intake as ExtractedCampaignIntake | undefined
    if (!intake) {
      return NextResponse.json({ error: 'intake is required' }, { status: 400 })
    }
    intake.generated_summary = generateSummary(intake)
    await updateIntakeDraftJson(token, intake)
    const draft = await getIntakeDraftByToken(token)
    return NextResponse.json(draft)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update draft'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
