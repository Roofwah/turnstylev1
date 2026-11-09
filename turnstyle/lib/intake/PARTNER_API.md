# Turnstyle Intake — Partner API (Phase 1)

One-way promotional concept submission for partners such as Zitcha.

Intake interprets the concept, stores a **Campaign Packet** (`CampaignIntakeDraft`), emails the submitter and Flow Marketing, and returns an acknowledgement. No quotes, approvals, or campaign status sync.

**Base URL (production):** `https://<your-turnstyle-host>`  
**Demo UI:** `/intake/demo`

---

## Endpoint

```
POST /api/v1/intake
```

### Authentication

```
Authorization: Bearer <partner_api_key>
```

Or:

```
X-Api-Key: <partner_api_key>
```

Keys are partner-specific. Production keys are issued by Flow Marketing. Never embed keys in client-side code.

### Rate limits

Default: **30 requests / minute / partner** (configurable).  
Exceeded → `429` with `Retry-After`.

### Idempotency

Optional header or body field. Replays return the existing packet without creating a duplicate.

```
Idempotency-Key: <unique-client-key>
```

or `"idempotency_key": "..."` in JSON.

### Payload size

Max ~32 KB.

---

## Request JSON

```json
{
  "concept": "We want to run a promotion across 200 stores in March where customers can win their purchase back.",
  "submitter_name": "Troy Townsend",
  "submitter_email": "troy@example.com",
  "submitter_company": "Zitcha",
  "external_ref": "zitcha-opp-12345",
  "idempotency_key": "zitcha-opp-12345-v1"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `concept` | Yes | Promotional concept (short free text) |
| `submitter_name` | Yes | Contact name |
| `submitter_email` | Yes | Contact email |
| `submitter_company` | Yes | Company |
| `external_ref` | No | Partner's reference |
| `idempotency_key` | No | Deduplicate submissions |

Aliases accepted: `promotional_concept`, `name`, `email`, `company`, camelCase variants.

---

## Success response (`200`)

```json
{
  "ok": true,
  "packet_ref": "TS-PKT-A1B2C3D4",
  "status": "submitted",
  "interpretation_source": "ai",
  "campaign_name": "Win Your Purchase Back",
  "summary": "…",
  "emails": {
    "submitter": true,
    "flow_marketing": true
  },
  "message": "Promotional concept received. Flow Marketing has been notified."
}
```

`status` is `"duplicate"` on idempotent replay.

---

## Error codes

| Status | Meaning |
|--------|---------|
| `400` | Validation error (missing/invalid fields) |
| `401` | Missing or invalid API key |
| `413` | Payload too large |
| `429` | Rate limited |
| `500` | Server error (packet may still have been stored — check with Flow) |

```json
{ "error": "Unauthorized" }
```

---

## Integration notes

1. Submit concept + contact details only.
2. Do **not** expect campaign IDs, quotes, or status callbacks.
3. Flow Marketing manages follow-up manually.
4. Packet reference (`packet_ref`) is the public identifier for support.

### Example curl

```bash
curl -X POST "https://<host>/api/v1/intake" \
  -H "Authorization: Bearer ts_live_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{
    "concept": "Colgate customers get a chance to win a family trip to Disneyland.",
    "submitter_name": "Troy Townsend",
    "submitter_email": "troy@example.com",
    "submitter_company": "Zitcha"
  }'
```

### Local / staging keys

Configure without committing secrets:

```env
INTAKE_PARTNER_KEYS=zitcha:ts_live_dev_replace_me
INTAKE_FLOW_NOTIFY_EMAIL=chris@flowmarketing.com.au
RESEND_API_KEY=re_...
INTAKE_FROM_EMAIL=intake@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
ANTHROPIC_API_KEY=   # optional; heuristic used if unset
```

Demo page allowlist (optional):

```env
INTAKE_DEMO_ALLOWED_EMAILS=troy@zitcha.com,@zitcha.com
```

---

## What this API does not do

- Create Turnstyle Campaigns
- Return quotes or pricing
- Accept status polling
- Two-way sync with partner platforms

---

## Deploy & share with Troy (checklist)

1. Apply migration on production DB:
   ```bash
   cd turnstyle
   npx prisma db execute --file migrations/20261109000000_partner_intake_packets/migration.sql
   ```
2. Set env on the host (Vercel):
   - `RESEND_API_KEY`, `INTAKE_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`
   - `INTAKE_FLOW_NOTIFY_EMAIL=chris@flowmarketing.com.au`
   - `INTAKE_PARTNER_KEYS=zitcha:<issued-key>` (dev/staging only; prefer hashed DB credentials later)
   - Optional: `INTAKE_DEMO_ALLOWED_EMAILS=troy@…,@zitcha.com`
   - Optional: `ANTHROPIC_API_KEY` for stronger AI (heuristic works without it)
3. Deploy the `turnstyle` app.
4. Demo URL: `https://<host>/intake/demo`
5. Send Troy that URL (no API key required for the demo page).
6. Partner API for their engineers: share [PARTNER_API.md](./PARTNER_API.md) + a **staging** key only after approval — do not put production credentials in docs.
