# Resend Inbound — Campaign Intake

Turnstyle receives campaign briefs by email, runs the same intake interpreter, and **replies** with a link to review.

## Flow

1. Someone emails `intake@yourdomain.com` (or your Resend `.resend.app` address).
2. Resend sends `email.received` webhook → `POST /api/intake/inbound`.
3. App fetches full body via Resend Receiving API.
4. `interpretCampaignBrief()` → saved as `CampaignIntakeDraft`.
5. Resend sends reply: summary + **Review & send to campaign builder** link.
6. Link opens `/dashboard/intake?token=…` (login required for builder).

## Resend dashboard setup

1. **Enable Inbound** on your domain (or use the default `*.resend.app` receiving address).
2. **Webhooks** → Add webhook:
   - URL: `https://YOUR_APP_URL/api/intake/inbound`
   - Event: `email.received`
3. Copy the **webhook signing secret** (`whsec_…`).

## Environment variables

```env
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-production-url.com

# Reply sender (must be a verified domain in Resend)
INTAKE_FROM_EMAIL=intake@status.turnstylehost.com
NEXT_PUBLIC_INTAKE_EMAIL=intake@status.turnstylehost.com
```

## Local testing

Use [ngrok](https://ngrok.com) or similar to expose `localhost:3000`:

```bash
ngrok http 3000
# Register https://xxxx.ngrok.io/api/intake/inbound in Resend
```

Or use Resend CLI: `resend emails receiving listen` (see Resend docs).

## Database

```bash
cd turnstyle
npx prisma migrate deploy
# or: npx prisma db push
```

Creates table `campaign_intake_drafts`.

## Security notes

- Webhook signature verified when `RESEND_WEBHOOK_SECRET` is set.
- Inbound does **not** create campaigns — only drafts + email reply.
- Consider allowlisting sender domains in `processInboundResendEmail` for production.
