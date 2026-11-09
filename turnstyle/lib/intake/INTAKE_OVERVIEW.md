# Campaign Intake — Overview

**What it is:** Brief capture that turns a promotional concept (paste, email, partner API, or demo) into a structured **Campaign Packet**, notifies Flow Marketing, and optionally prefills Campaign Builder.

**What it is not:** A full campaign API. Intake does **not** create campaigns, quotes, or approvals.

## Paths

| Path | Role |
|------|------|
| `/dashboard/intake` | Internal paste / email-review UI |
| `/intake/demo` | Interactive partner demonstration |
| `POST /api/v1/intake` | Authenticated partner API |
| `POST /api/intake/demo/submit` | Server-side demo submit (no browser keys) |
| `POST /api/intake/interpret` | Interpret only (no persist) |
| `POST /api/intake/inbound` | Resend email webhook |

## Packet

Stored as `CampaignIntakeDraft` with `packet_ref`, submitter metadata, original concept, AI extraction, assumptions, and status `submitted` / `pending_review`.

Partner docs: [PARTNER_API.md](./PARTNER_API.md)
