import type { ExtractedCampaignIntake } from './types'
import { finalizeMockIntake } from './normalize'
import { mockExtractCampaign } from './mock'

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
- Use ISO dates (YYYY-MM-DD) when dates are stated.
- Do NOT invent missing details. Leave unknown fields null / empty.
- Put reasonable inferences in "assumptions" (e.g. likely sweepstakes, likely digital entry) — never as confirmed facts unless the user stated them.
- Short concepts are valid: e.g. "win purchase back across 200 stores in March" → purchase-linked consumer promotion; prize = purchase refunded; store count noted in notes/assumptions; month if year unknown leave dates null and assume month in assumptions.
- "Chance to win a trip to Disneyland" → likely consumer sweepstakes; prize description = trip; entry method stays null unless stated.
- Infer campaign_name from brand + prize/mechanic when helpful, mark as assumption.
- Split AU and NZ only when both appear.
- Prefer a single AU region when geography is unspecified (note that assumption).`

/**
 * TODO: Wire Claude structured output when ANTHROPIC_API_KEY is configured server-side.
 * Pattern: lib/preflight/prizeParser.ts — POST to api.anthropic.com, parse JSON response.
 */
async function extractWithAi(rawInput: string): Promise<ExtractedCampaignIntake | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: INTAKE_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract campaign intake JSON from this brief:\n\n${rawInput}`,
          },
        ],
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data.content?.[0]?.text ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const { finalizeIntake } = await import('./normalize')
    return finalizeIntake(parsed, rawInput)
  } catch {
    return null
  }
}

export async function interpretCampaignBrief(rawInput: string): Promise<{
  intake: ExtractedCampaignIntake
  source: 'ai' | 'mock'
}> {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return {
      intake: finalizeMockIntake('', mockExtractCampaign('')),
      source: 'mock',
    }
  }

  const aiResult = await extractWithAi(trimmed)
  if (aiResult) {
    return { intake: aiResult, source: 'ai' }
  }

  const mock = mockExtractCampaign(trimmed)
  return {
    intake: finalizeMockIntake(trimmed, mock),
    source: 'mock',
  }
}
