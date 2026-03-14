# Prize-type sub-templates

Sub-templates add **extra clauses** to the terms document when the campaign has prizes of a given type (e.g. "Motor vehicle", "Travel"). They are **not** a single `[[PRIZE TEMPLATE]]` placeholder in the main text; they inject **whole sections** (each with slug, label, text, and optional gaps).

## Flow

1. **Prize types** come from the campaign: `campaign.prizes[].type` (e.g. `"Motor vehicle"`, `"Travel"`). These must match the values used when adding prizes in the app (e.g. Prize Entry Dialog / devflow).

2. **Merge** (in `lib/terms-templates/index.ts`):
   - `mergeSubTemplatesIntoClauses(baseClauses, prizeTypes, { insertAfterSlug: 'prizes' })`
   - For each prize type present, clauses from the matching sub-template are **inserted after** the base clause with slug `prizes`.
   - Order: base clauses up to and including `prizes` → all sub-template clauses (Motor vehicle, then Travel, etc.) → rest of base clauses.

3. **Wizard**: The terms wizard (and terms-test page) builds `currentClauses` from this merged list. It collects **all** gap questions from **all** clauses (base + sub-template), so sub-template gaps are asked like any other and their answers are used when resolving `[[KEY]]` in sub-template text.

## Structure

- **Main templates** (e.g. `repco-trade.ts`, `generic-sweepstakes.ts`) have a clause with `slug: 'prizes'`. Sub-template clauses are inserted **after** that clause, so the document order is: … → Prize Details → Motor vehicle prize conditions (if applicable) → Travel prize conditions (if applicable) → Draw Method → …

- **Sub-template file** (e.g. `travel.ts`, `motor-vehicle.ts`):
  - Export `PRIZE_TYPE`: string that must match `campaign.prizes[].type`.
  - Export `*_CLAUSES`: array of clause objects `{ slug, label, text, gaps? }`. Same shape as main template clauses; `gaps` work the same (wizard asks once per key, substitutes `[[KEY]]` everywhere).

## Adding a new sub-template

1. Create a file in this folder, e.g. `cash.ts`:

```ts
export const PRIZE_TYPE = 'Cash'

export const CASH_CLAUSES = [
  {
    slug: 'prizes-cash',
    label: 'Cash prize conditions',
    text: `Cash prizes will be paid by [[PAYMENT_METHOD]] within 28 days of the draw.`,
    gaps: [
      { key: 'PAYMENT_METHOD', question: 'How will cash be paid?', placeholder: 'e.g. EFT' },
    ],
  },
]
```

2. In `index.ts`: import and add to `SUB_TEMPLATE_REGISTRY`:

```ts
import { PRIZE_TYPE as CASH_TYPE, CASH_CLAUSES } from './cash'
// ...
{ prizeType: CASH_TYPE, clauses: CASH_CLAUSES },
```

3. Ensure the app uses the same prize type value when saving prizes (e.g. "Cash") so `campaign.prizes[].type` matches.

## Placeholder vs insertion

- **Current behaviour**: No literal `[[PRIZE TEMPLATE]]` in the main template. Sub-templates add **separate clauses** (sections) after the prizes clause.
- If you need one clause to contain “injected” text (e.g. a single “Prize conditions” section whose body is replaced by the sub-template content), that would require a new mechanism: e.g. a special placeholder that the builder resolves to the concatenated sub-template text for the campaign’s prize types.
