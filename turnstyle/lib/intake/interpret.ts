import type { ExtractedCampaignIntake } from './types'
import { finalizeMockIntake } from './normalize'
import { mockExtractCampaign } from './mock'

export type InterpretationSource = 'ai' | 'heuristic'
export type InterpretationDegradedReason =
  | 'missing_api_key'
  | 'provider_http_error'
  | 'invalid_json'
  | 'provider_exception'
  | null

export type InterpretResult = {
  intake: ExtractedCampaignIntake
  source: InterpretationSource
  /** Present when AI was unavailable or failed — fallback used */
  degradedReason: InterpretationDegradedReason
}

const INTAKE_SYSTEM = `You are a campaign intake assistant for Turnstyle, an Australian trade promotions platform.
Extract structured campaign data from short promotional concepts, emails, or briefs.
Return ONLY valid JSON matching this shape:
{
  "campaign_name": string|null,
  "promoter_name": string|null,
  "brand": string|null,
  "retailer": string|null,
  "notes": string|null,
  "assumptions": string[],
  "regions": [{
    "region_name": "AU"|"NZ"|string,
    "country": string|null,
    "start_date": "YYYY-MM-DD"|null,
    "end_date": "YYYY-MM-DD"|null,
    "entry_mechanic": string|null,
    "entry_threshold": number|null,
    "purchase_requirement": string|null,
    "loyalty_required": boolean|null,
    "participating_brands": string[],
    "subsequent_entries_allowed": boolean|null,
    "prizes": [{"type":"major"|"minor","description":string,"quantity":number|null,"unit_value":number|null,"total_value":number|null}],
    "major_prizes": [],
    "minor_prizes": [],
    "draw_type": string|null,
    "draw_frequency": string|null,
    "draw_date": null,
    "winner_publication_date": null,
    "total_prize_value": number|null,
    "permit_flags": []
  }],
  "confidence_scores": {}
}

Rules:
- Use ISO dates (YYYY-MM-DD). For "March 2027" use start=2027-03-01 end=2027-03-31.
- Do NOT invent missing details. Leave unknown fields null / empty.
- Put inferences only in "assumptions" — never as confirmed facts unless the user stated them.
- Distinguish brand vs retailer: "Repco stores" → retailer=Repco, brand=null. "Colgate customers" → brand=Colgate.
- Extract store counts ("200 Repco stores"), prize names, quantities, and dollar values when stated.
- "Chance to win a Ford Ranger Raptor valued at $90,000" → prize description + unit_value 90000; suggest campaign_name "Win a Ford Ranger Raptor" in assumptions.
- Split AU and NZ only when both appear. Australia → AU region.`

async function extractWithAi(
  rawInput: string
): Promise<{ intake: ExtractedCampaignIntake } | { error: InterpretationDegradedReason; detail: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: 'missing_api_key', detail: 'ANTHROPIC_API_KEY is not configured' }
  }

  try {
    const { anthropicHeaders, anthropicRequestBody, extractAnthropicText, ANTHROPIC_MESSAGES_URL } =
      await import('@/lib/anthropic/client')

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify(
        anthropicRequestBody({
          system: INTAKE_SYSTEM,
          user: `Extract campaign intake JSON from this brief:\n\n${rawInput}`,
          maxTokens: 4000,
          effort: 'low',
        })
      ),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        error: 'provider_http_error',
        detail: `Anthropic HTTP ${response.status}: ${body.slice(0, 200)}`,
      }
    }

    const data = await response.json()
    const text = extractAnthropicText(data.content)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { error: 'invalid_json', detail: 'No JSON object in AI response' }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const { finalizeIntake } = await import('./normalize')
      return { intake: finalizeIntake(parsed, rawInput) }
    } catch (e) {
      return {
        error: 'invalid_json',
        detail: e instanceof Error ? e.message : 'JSON parse failed',
      }
    }
  } catch (e) {
    return {
      error: 'provider_exception',
      detail: e instanceof Error ? e.message : 'Unknown provider exception',
    }
  }
}

export async function interpretCampaignBrief(rawInput: string): Promise<InterpretResult> {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return {
      intake: finalizeMockIntake('', mockExtractCampaign('')),
      source: 'heuristic',
      degradedReason: null,
    }
  }

  const aiResult = await extractWithAi(trimmed)
  if ('intake' in aiResult) {
    return { intake: aiResult.intake, source: 'ai', degradedReason: null }
  }

  console.warn('[intake/interpret] AI unavailable — using heuristic fallback', {
    reason: aiResult.error,
    detail: aiResult.detail,
  })

  const mock = mockExtractCampaign(trimmed)
  const intake = finalizeMockIntake(trimmed, mock)
  // Ensure degraded notice is present and first
  if (!intake.assumptions.some((a) => /AI interpretation unavailable|standard extraction/i.test(a))) {
    intake.assumptions = [
      'Interpreted with standard extraction (AI interpretation unavailable). Review fields carefully.',
      ...intake.assumptions,
    ]
  }

  return {
    intake,
    source: 'heuristic',
    degradedReason: aiResult.error,
  }
}
