import type { ExtractedCampaignIntake } from './types'
import { finalizeMockIntake } from './normalize'
import { mockExtractCampaign } from './mock'

const INTAKE_SYSTEM = `You are a campaign intake assistant for Turnstyle, an Australian trade promotions platform.
Extract structured campaign data from messy pasted emails, briefs, or notes.
Return ONLY valid JSON matching the schema. Use ISO dates (YYYY-MM-DD).
Split AU and NZ into separate region objects when both appear with different prize pools.
Set loyalty_required true when Repco Rewards or similar loyalty wording appears.
Infer campaign_name from context when not explicit.`

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
