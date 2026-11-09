import { NextRequest, NextResponse } from 'next/server'
import { interpretCampaignBrief } from '@/lib/intake/interpret'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const raw_input = typeof body.raw_input === 'string' ? body.raw_input.trim() : ''

    if (!raw_input) {
      return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })
    }

    const { intake, source, degradedReason } = await interpretCampaignBrief(raw_input)

    return NextResponse.json({
      intake,
      source: source === 'heuristic' ? 'mock' : source, // backward-compatible alias
      interpretation_source: source,
      degraded: source !== 'ai',
      degraded_reason: degradedReason,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Interpretation failed'
    console.error('POST /api/intake/interpret error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
