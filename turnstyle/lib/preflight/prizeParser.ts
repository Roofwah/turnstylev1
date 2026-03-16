// ─────────────────────────────────────────────
// Turnstyle Preflight — Prize Parser
// Complexity gate → regex OR Claude API
// ─────────────────────────────────────────────

import {
  PrizeParseRequest,
  PrizeParseResult,
  ParsedPrize,
  PrizeType,
  PrizeComplexityTier,
  PrizeTriggers,
} from './types'

// ─── Keyword detection ────────────────────────

const TRAVEL_KEYWORDS = [
  'flight', 'airfare', 'accommodation', 'accom', 'hotel', 'travel',
  'trip', 'holiday', 'return economy', 'nights', 'depart',
]

const EVENT_KEYWORDS = [
  'ticket', 'admission', 'event', 'concert', 'grand prix', 'supercars',
  'festival', 'show', 'game', 'match', 'race', 'experience',
]

const TRIVIAL_KEYWORDS = [
  'gift card', 'voucher', 'cash', 'cheque', 'eftpos',
  'ipad', 'iphone', 'macbook', 'laptop', 'television', 'tv',
]

function detectTier(description: string): PrizeComplexityTier {
  const lower = description.toLowerCase()
  const wordCount = description.trim().split(/\s+/).length

  // Trivial: short + known simple prize type
  if (wordCount <= 8 && TRIVIAL_KEYWORDS.some((k) => lower.includes(k))) {
    return 'trivial'
  }

  // Complex: contains travel or multi-component event keywords
  const hasTravel = TRAVEL_KEYWORDS.some((k) => lower.includes(k))
  const hasEvent = EVENT_KEYWORDS.some((k) => lower.includes(k))

  if (hasTravel || (hasEvent && wordCount > 15)) return 'complex'

  // Standard: everything else
  return 'standard'
}

// ─── Trivial parser (no API call) ────────────

function parseTrivial(req: PrizeParseRequest): ParsedPrize {
  const lower = req.rawDescription.toLowerCase()

  let prizeType: PrizeType[] = ['product']
  if (/gift\s*card|voucher|eftpos/i.test(lower)) prizeType = ['gift_card']
  if (/cash|cheque/i.test(lower)) prizeType = ['cash']

  return {
    name: req.rawDescription.trim(),
    quantity: req.quantity ?? 1,
    recipientCount: 1,
    valueIncGst: req.valueIncGst ?? 0,
    valueQualifier: 'valued_at',
    inclusions: [],
    prizeType,
    triggers: {
      travelClause: false,
      eventClause: false,
      airfare300kmRule: false,
      guardianTravelClause: false,
    },
    rawDescription: req.rawDescription,
    confidence: 'high',
  }
}

// ─── AI parser ────────────────────────────────

const PRIZE_PARSE_SYSTEM = `You are a prize description parser for an Australian trade promotion platform.
Extract structured data from prize descriptions. Return ONLY valid JSON matching the schema below.
No markdown, no preamble, no explanation.

Schema:
{
  "name": "string — short prize name",
  "quantity": number,
  "recipientCount": number — how many people the prize is for,
  "valueIncGst": number — numeric value only,
  "valueQualifier": "up_to" | "valued_at" | "exact",
  "inclusions": ["string array of what is included"],
  "prizeType": ["travel" | "event" | "gift_card" | "cash" | "product" | "experience" | "voucher"],
  "triggers": {
    "travelClause": boolean,
    "eventClause": boolean,
    "airfare300kmRule": boolean,
    "guardianTravelClause": boolean
  },
  "confidence": "high" | "medium" | "low"
}

Rules:
- If value is explicitly stated as "up to $X", set valueQualifier to "up_to"
- airfare300kmRule = true if airfare is included (winners within 300km may not receive flights)
- travelClause = true if travel, flights, accommodation or transport is mentioned
- eventClause = true if event tickets, admission or event attendance is included
- guardianTravelClause = true if the prize involves travel AND minors could plausibly participate`

async function parseWithAi(req: PrizeParseRequest): Promise<{ parsed: ParsedPrize; tokensUsed: number }> {
  const userMessage = `Parse this prize description:
"${req.rawDescription}"
${req.quantity ? `Quantity: ${req.quantity}` : ''}
${req.valueIncGst ? `Value (incl. GST): $${req.valueIncGst}` : ''}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: PRIZE_PARSE_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '{}'
  const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)

  let parsed: Partial<ParsedPrize>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Failed to parse Claude response as JSON')
  }

  return {
    parsed: {
      name: parsed.name ?? req.rawDescription,
      quantity: parsed.quantity ?? req.quantity ?? 1,
      recipientCount: parsed.recipientCount ?? 1,
      valueIncGst: parsed.valueIncGst ?? req.valueIncGst ?? 0,
      valueQualifier: parsed.valueQualifier ?? 'valued_at',
      inclusions: parsed.inclusions ?? [],
      prizeType: parsed.prizeType ?? ['product'],
      triggers: parsed.triggers ?? {
        travelClause: false,
        eventClause: false,
        airfare300kmRule: false,
        guardianTravelClause: false,
      },
      rawDescription: req.rawDescription,
      confidence: parsed.confidence ?? 'medium',
    },
    tokensUsed,
  }
}

// ─── Standard parser (regex, no API) ─────────

function parseStandard(req: PrizeParseRequest): ParsedPrize {
  const lower = req.rawDescription.toLowerCase()

  const prizeTypes: PrizeType[] = []
  if (TRAVEL_KEYWORDS.some((k) => lower.includes(k))) prizeTypes.push('travel')
  if (EVENT_KEYWORDS.some((k) => lower.includes(k))) prizeTypes.push('event')
  if (!prizeTypes.length) prizeTypes.push('experience')

  const triggers: PrizeTriggers = {
    travelClause: prizeTypes.includes('travel'),
    eventClause: prizeTypes.includes('event'),
    airfare300kmRule: /flight|airfare|return economy/i.test(lower),
    guardianTravelClause: prizeTypes.includes('travel'),
  }

  return {
    name: req.rawDescription.split(/[,(]/)[0].trim(),
    quantity: req.quantity ?? 1,
    recipientCount: /\bfor\s+(\d+)|(\d+)\s+people/i.exec(lower)?.[1]
      ? parseInt(/\bfor\s+(\d+)|(\d+)\s+people/i.exec(lower)![1] ?? '1')
      : 1,
    valueIncGst: req.valueIncGst ?? 0,
    valueQualifier: /up\s+to/i.test(lower) ? 'up_to' : 'valued_at',
    inclusions: [],
    prizeType: prizeTypes,
    triggers,
    rawDescription: req.rawDescription,
    confidence: 'medium',
  }
}

// ─── Main entry point ─────────────────────────

export async function parsePrize(req: PrizeParseRequest): Promise<PrizeParseResult> {
  const tier = detectTier(req.rawDescription)

  if (tier === 'trivial') {
    return {
      tier,
      parsed: parseTrivial(req),
      usedAi: false,
    }
  }

  if (tier === 'standard') {
    return {
      tier,
      parsed: parseStandard(req),
      usedAi: false,
    }
  }

  // Complex — invoke Claude
  try {
    const { parsed, tokensUsed } = await parseWithAi(req)
    return { tier, parsed, usedAi: true, tokensUsed }
  } catch (err) {
    console.error('[parsePrize] AI parse failed, falling back to standard', err)
    return {
      tier: 'standard',
      parsed: parseStandard(req),
      usedAi: false,
    }
  }
}
