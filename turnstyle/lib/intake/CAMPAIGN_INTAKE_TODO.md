# Campaign Intake — TODO

## Status: Complete (UI + API + Resend Inbound)

## Features

- Paste brief at `/dashboard/intake`
- Email brief to configured inbound address → auto-reply with review link
- Review → Send to Campaign Builder (`/dashboard/new?from=intake`)

## Resend Inbound

See **`RESEND_INBOUND_SETUP.md`** for dashboard and env configuration.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/intake/inbound` | Resend `email.received` webhook |
| `GET /api/intake/draft/[token]` | Load draft from email link |
| `PATCH /api/intake/draft/[token]` | Save edited intake (optional) |

## lib/intake modules

- `types.ts`, `generateSummary.ts`, `assumptions.ts`, `mock.ts`, `normalize.ts`
- `mapToBuilder.ts`, `storage.ts`, `interpret.ts`
- `drafts.ts`, `resend-inbound.ts`, `reply-email.ts`
