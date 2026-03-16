# Turnstyle Preflight Engine

Drop this folder into your Next.js project at:

```
/lib/preflight/
```

---

## Folder Structure

```
lib/preflight/
  types.ts           — All TypeScript interfaces
  classifier.ts      — Clause extractor (no API, regex-based)
  rules/
    index.ts         — All deterministic rules + registry
  prizeParser.ts     — Prize complexity gate + AI extraction
  aiReview.ts        — Claude qualitative review layer
  scorer.ts          — Weighted score aggregator
  index.ts           — Main orchestrator (runPreflight)

app/actions/
  runPreflight.ts    — Next.js server action wrapper (add 'use server')
```

---

## Integration

### 1. Server action

```ts
// app/actions/runPreflight.ts
'use server'

import { runPreflight } from '@/lib/preflight'
import { prisma } from '@/lib/prisma'

export async function preflightCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { quotes: true },
  })

  // Map your Prisma campaign model → CampaignBuilderInput
  const builder = mapCampaignToBuilder(campaign)

  // Get the generated terms text
  const termsText = campaign.generatedTerms ?? ''

  const report = await runPreflight(builder, termsText)

  // Persist report
  await prisma.preflightReport.upsert({
    where: { campaignId },
    create: { campaignId, report: report as any },
    update: { report: report as any, updatedAt: new Date() },
  })

  return report
}
```

### 2. Prize parser (standalone)

```ts
import { parsePrize } from '@/lib/preflight/prizeParser'

const result = await parsePrize({
  rawDescription: 'Gold Coast Supercars weekend for 2, flights, 3 nights accommodation, general admission',
  quantity: 6,
  valueIncGst: 3000,
})

// result.usedAi — false for trivial/standard, true for complex
// result.parsed — structured prize data
// result.tier   — 'trivial' | 'standard' | 'complex'
```

### 3. Skip AI review (rules-only mode)

```ts
const report = await runPreflight(builder, termsText, { skipAiReview: true })
```

---

## Prisma Schema Addition

```prisma
model PreflightReport {
  id          String   @id @default(cuid())
  campaignId  String   @unique
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  report      Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Cost Profile

| Operation | Typical tokens | Cost (Sonnet 4) |
|---|---|---|
| Prize parse — trivial | 0 (no API) | $0 |
| Prize parse — standard | 0 (no API) | $0 |
| Prize parse — complex | ~500 | ~$0.002 |
| Preflight AI review | ~3,500 | ~$0.011 |

At 500 campaigns/month: ~$6–9/month total API cost.

---

## Adding New Rules

1. Open `rules/index.ts`
2. Add a new `const RULE_XXX: RuleFn = (builder, doc) => { ... }`
3. Return a `PreflightIssue` or `null`
4. Add to the `ALL_RULES` array at the bottom

Rules are pure functions — no side effects, no async, no API calls.
