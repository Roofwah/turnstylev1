# Turnstyle — Application Documentation

**Version:** 0.1.0  
**Owner:** Flow Marketing (internal tool)  
**Repository path:** `turnstyle/` inside `turnstyle_v1.0`

Turnstyle is an internal trade promotions workflow application. It helps Flow Marketing build campaigns, generate quotes and terms, manage permits, schedule Pure Random draws, and (in development) track promotion operations.

This document describes **how the application works**, **how to run it**, and **where things live in the codebase**.

For an honest assessment of workflow gaps and what is / isn’t practical today, see **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**.

---

## Table of contents

1. [What Turnstyle does](#1-what-turnstyle-does)
2. [Quick start (local)](#2-quick-start-local)
3. [Technology stack](#3-technology-stack)
4. [Application modules](#4-application-modules)
5. [Routes & navigation](#5-routes--navigation)
6. [Campaign lifecycle](#6-campaign-lifecycle)
7. [Data model](#7-data-model)
8. [External services](#8-external-services)
9. [Environment variables](#9-environment-variables)
10. [Project structure](#10-project-structure)
11. [Scripts & database](#11-scripts--database)
12. [Authentication](#12-authentication)
13. [Deployment](#13-deployment)
14. [Related documentation](#14-related-documentation)

---

## 1. What Turnstyle does

Turnstyle is **not** a client-facing SaaS product. It is Flow Marketing’s internal control tool for running trade promotions in Australia and New Zealand.

| Capability | Description |
|------------|-------------|
| **Campaign intake** | Paste or email a client brief; AI/heuristic extraction pre-fills the campaign builder |
| **Campaign builder** | Create promotions with promoter details, prizes, regions, mechanics, draw schedule |
| **Quote engine** | Generate priced quotes from campaign configuration |
| **Terms wizard** | Build full/abbreviated terms from templates; client review and approval links |
| **Preflight** | Validate terms documents (linked to campaign or standalone `.docx` upload) |
| **Permits** | Track NSW / SA / ACT permit numbers and LOA status |
| **Pure Random** | Schedule provably-fair draws via external Pure Random API |
| **Ops dashboard** | Promotion list, document checklist, draw calendar, overdue queue (MVP — see PROJECT_OVERVIEW) |

**Design principle (target state):** Dropbox stores files. Turnstyle stores metadata, status, due dates, and obligations. Today, Dropbox integration is URL-paste only.

---

## 2. Quick start (local)

The Next.js app lives in **`turnstyle/`**, not the repo root.

```bash
# 1. Go to the app directory
cd turnstyle

# 2. Install dependencies
npm install

# 3. Configure environment (copy and edit)
cp .env.example .env.local   # if example exists; otherwise create .env.local

# Required at minimum:
# DATABASE_URL="postgresql://..."

# 4. Generate Prisma client & apply schema
npx prisma generate
npx prisma db push            # or: npx prisma migrate deploy

# 5. Optional: seed promoters and example ops promotions
npm run seed
npm run seed:ops

# 6. Start dev server
npm run dev
```

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Home |
| http://localhost:3000/login | Login |
| http://localhost:3000/dashboard | Ops dashboard (default landing after login) |

**Dev login (placeholder auth):**

- Email: `admin@turnstyle.com`
- Password: `admin`

> **Common mistake:** Running `npm run dev` from `turnstyle_v1.0/` (repo root) will fail — there is no `package.json` there. Always `cd turnstyle` first.

---

## 3. Technology stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Forms | React Hook Form + Zod |
| Email | Resend |
| Auth | NextAuth v4 (configured); login page uses placeholder check for dev |

---

## 4. Application modules

### 4.1 Campaign intake (`lib/intake/`, `/dashboard/intake`)

**Flow:** Brief (paste or email) → interpret → review → prefill → `/dashboard/new?from=intake`

| Component | Path |
|-----------|------|
| Interpret API | `POST /api/intake/interpret` |
| Email webhook | `POST /api/intake/inbound` |
| Draft by token | `GET/PATCH /api/intake/draft/[token]` |
| Setup guide | `lib/intake/RESEND_INBOUND_SETUP.md` |

Intake creates `CampaignIntakeDraft` records. It does **not** create campaigns until the user completes the builder.

---

### 4.2 Campaign builder (`/dashboard/new`, `/dashboard/devflow`)

Two creation paths:

- **Full builder** — `/dashboard/new` — all fields, prize wizard, draw wizard
- **Devflow** — `/dashboard/devflow` — streamlined form including Draw Only campaigns

Server actions: `app/actions/campaigns.ts` (`createCampaign`, `createDrawOnlyCampaign`)

---

### 4.3 Campaign workspace (`/dashboard/[id]`)

Primary working screen for a single promotion. Tabs include:

- Overview, Quote, Prizes, Terms, Abbreviated terms, QR code, LOA
- Draw schedule (Pure Random upload links)
- Winners (placeholder)
- History, Support

Uses lifecycle bar (`lib/lifecycle.ts`) to suggest next steps based on `Campaign.status`.

---

### 4.4 Quote engine (`lib/quote-engine.ts`)

Calculates terms fee, management fee, permit fee, draw fee from campaign configuration. Quotes are stored in `Quote` with snapshot JSON and hash for approval integrity.

---

### 4.5 Terms wizard (`/dashboard/[id]/terms-wizard`)

Template-driven terms generation with gap-filling questions. Supports client review via share token (`/review/[token]`). Comments and approvals stored on `TermsDraft`.

Templates: `lib/terms-templates/` (Repco retail, limited offer, trade, sub-templates by prize type, etc.)

---

### 4.6 Preflight (`lib/preflight/`, `/dashboard/preflight`)

Validates terms content against rules and optional AI review. Can run:

- From campaign terms wizard → `/dashboard/[id]/preflight-report`
- Standalone `.docx` upload → `/dashboard/preflight/[uploadId]`

---

### 4.7 Permits (`/dashboard/admin/permits`)

Admin view for campaigns in `PENDING` status. Enter NSW/SA/ACT permit numbers and LOA signed flag. Gates transition to `SCHEDULED` when thresholds require permits.

---

### 4.8 Pure Random (`lib/purerandom.ts`)

External draw scheduling service. When campaign status advances to `SCHEDULED`, the status API schedules each draw in `Campaign.drawSchedule` and stores `purerandomId` and `uploadUrl` back into the JSON.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/campaigns/[id]/status` | Lifecycle transitions + Pure Random schedule |
| `POST /api/campaigns/[id]/sync-draws` | Re-sync unscheduled draws |
| `GET /api/purerandom/upload-link` | Proxy upload link for entry dataset |

---

### 4.9 Promotion ops (`lib/ops/`, `/dashboard/(ops)/`)

MVP internal ops layer:

| Route | Purpose |
|-------|---------|
| `/dashboard` | Metric cards, live promotions, overdue summary |
| `/dashboard/promotions` | Full promotion table |
| `/dashboard/promotions/[id]` | Ops detail (documents, draws, Dropbox URL, launch gate) |
| `/dashboard/draws` | Draw calendar across campaigns |
| `/dashboard/overdue` | Overdue documents and draw obligations |
| `/dashboard/settings` | Internal config notes |

**Important:** Ops tables (`promotion_documents`, `promotion_draws`) are largely **manual** and **not synced** from campaign workspace data. See PROJECT_OVERVIEW.md before relying on this for live jobs.

---

## 5. Routes & navigation

### Public / client

| Route | Description |
|-------|-------------|
| `/login` | Dev login |
| `/review/[token]` | Client terms review (no login) |

### Dashboard (authenticated in production; dev login is placeholder)

| Route | Description |
|-------|-------------|
| `/dashboard` | Ops home |
| `/dashboard/promotions` | Promotion list |
| `/dashboard/promotions/[id]` | Ops promotion detail |
| `/dashboard/draws` | Draw calendar |
| `/dashboard/overdue` | Overdue queue |
| `/dashboard/settings` | Settings |
| `/dashboard/[id]` | Campaign workspace |
| `/dashboard/[id]/quote` | Quote page |
| `/dashboard/[id]/terms-wizard` | Terms builder |
| `/dashboard/[id]/preflight-report` | Preflight report |
| `/dashboard/[id]/loa` | Letter of authority |
| `/dashboard/new` | New campaign |
| `/dashboard/devflow` | Devflow builder |
| `/dashboard/intake` | Campaign intake |
| `/dashboard/preflight` | Standalone preflight upload |
| `/dashboard/lite/[id]` | Draw-only simplified view |
| `/dashboard/admin/permits` | Permit admin |
| `/dashboard/admin/promoters` | Promoter admin |
| `/dashboard/terms-test` | Terms template testing |

### API (selected)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/campaigns` | GET | List campaigns |
| `/api/campaigns/[id]` | GET/PATCH | Campaign CRUD |
| `/api/campaigns/[id]/status` | POST | Lifecycle + Pure Random |
| `/api/campaigns/[id]/permits` | PATCH | Permit fields |
| `/api/intake/interpret` | POST | Parse brief |
| `/api/intake/inbound` | POST | Resend email webhook |
| `/api/terms/*` | various | Terms drafts, comments, approve |

---

## 6. Campaign lifecycle

`Campaign.status` enum:

```
DRAFT → CONFIRMED → COMPILED → REVIEW → PENDING → SCHEDULED → LIVE → CLOSED → DRAWN → ARCHIVED
```

| Status | Typical meaning |
|--------|-----------------|
| `DRAFT` | Campaign created; quote not accepted |
| `CONFIRMED` | Quote accepted |
| `COMPILED` | Terms generated |
| `REVIEW` | Terms shared with client |
| `PENDING` | Awaiting permit approval |
| `SCHEDULED` | Permits OK; draws scheduled in Pure Random |
| `LIVE` | Promotion running |
| `CLOSED` | Entries closed; awaiting dataset upload |
| `DRAWN` | Draw complete |
| `ARCHIVED` | Job closed |

Gates (examples):

- `SCHEDULED` → triggers Pure Random scheduling
- `CLOSED` → `DRAWN` requires `drawDatasetUploadedAt`
- `DRAWN` → `ARCHIVED` requires `winnersConfirmedAt`

Next-step UI: `lib/lifecycle.ts` → `getNextStepConfig()`

---

## 7. Data model

Schema: `prisma/schema.prisma`

### Core entities

| Model | Purpose |
|-------|---------|
| `User` | Internal users (roles: SUPER_ADMIN, ADMIN, AGENCY_ADMIN, CLIENT) |
| `Promoter` | Client / brand running the promotion |
| `Campaign` | Central promotion record |
| `Quote` | Priced quote with approval snapshot |
| `TermsDraft` | Terms document versions, share token, comments |
| `GeneratedDocument` | Quote, terms PDFs, QR codes (S3 keys) |
| `AuditLog` | Change history on campaigns |

### Intake

| Model | Purpose |
|-------|---------|
| `CampaignIntakeDraft` | Email/paste briefs pending review |

### Preflight (standalone)

| Model | Purpose |
|-------|---------|
| `TermsUpload` | Uploaded `.docx` for standalone preflight |
| `TermsUploadReport` | Preflight score and report JSON |

### Ops (MVP)

| Model | Purpose |
|-------|---------|
| `PromotionDocument` | Per-campaign document checklist row |
| `PromotionDraw` | Per-campaign draw obligation row |

### Key `Campaign` fields

| Field | Purpose |
|-------|---------|
| `drawSchedule` | JSON array of draw events (canonical for builder + Pure Random) |
| `prizes` / `confirmedPrizes` | Prize tiers |
| `permitNSW/SA/ACT` | Permit reference numbers |
| `dropboxFolderUrl` | Pasted Dropbox campaign folder |
| `invoiceOpsStatus` | Ops invoice tracking (manual) |
| `intakeSummary` / `preflightScore` | Ops metadata |

---

## 8. External services

| Service | Used for | Config |
|---------|----------|--------|
| **PostgreSQL** | All application data | `DATABASE_URL` |
| **Pure Random** | Draw scheduling & upload links | `PURERANDOM_URL`, `PURERANDOM_ADMIN_KEY` |
| **Resend** | Terms emails, intake auto-reply, notifications | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` |
| **Anthropic** | Optional AI intake interpretation | `ANTHROPIC_API_KEY` |
| **Dropbox** | File storage (external; URL paste only in Turnstyle) | — |

---

## 9. Environment variables

Create `turnstyle/.env.local` (or `.env`):

```env
# Database (required)
DATABASE_URL="postgresql://user:password@host:5432/turnstyle"

# App URL (emails, review links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Pure Random draw machine
PURERANDOM_URL="https://your-purerandom-host"
PURERANDOM_ADMIN_KEY="your-admin-key"

# Resend email
RESEND_API_KEY="re_..."
RESEND_WEBHOOK_SECRET="whsec_..."        # intake inbound webhook
INTAKE_FROM_EMAIL="intake@yourdomain.com"
NEXT_PUBLIC_INTAKE_EMAIL="intake@yourdomain.com"

# Optional: AI intake (falls back to heuristics if unset)
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 10. Project structure

```
turnstyle/
├── app/
│   ├── (auth)/                 # Login
│   ├── actions/                # Server actions (campaigns, ops, quotes, preflight)
│   ├── api/                    # REST API routes
│   └── dashboard/
│       ├── (ops)/              # Ops sidebar layout + dashboard pages
│       ├── [id]/               # Campaign workspace
│       ├── admin/              # Permits, promoters
│       ├── devflow/            # Streamlined builder
│       ├── intake/             # Brief intake
│       ├── new/                # Full builder
│       ├── preflight/          # Standalone preflight
│       └── lite/               # Draw-only view
├── components/                 # Shared UI (DrawWizard, LifecycleBar, ops/*)
├── lib/
│   ├── intake/                 # Brief interpretation
│   ├── ops/                    # Ops status logic, metrics, Dropbox helpers
│   ├── preflight/              # Terms validation engine
│   ├── terms-templates/        # T&Cs templates
│   ├── quote-engine.ts         # Pricing
│   ├── purerandom.ts           # Draw API client
│   ├── lifecycle.ts            # Status next-steps
│   └── draw-schedule.ts        # Draw event types
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                 # Promoters seed
│   └── seed-ops.ts             # Example promotions seed
├── migrations/                 # SQL migrations
├── public/                     # Static assets (logo, etc.)
├── APPLICATION.md              # This file
└── PROJECT_OVERVIEW.md         # Workflow assessment & gaps
```

**Note:** The repo root (`turnstyle_v1.0/`) contains legacy docs and an empty `app/dashboard/page.tsx` — it is **not** part of the running application.

---

## 11. Scripts & database

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run seed` | Seed known promoters |
| `npm run seed:ops` | Seed example ops promotions (Repco, Rheem, STEDI, Energizer) |

Database utilities:

```bash
npx prisma studio          # Browse data in browser
npx prisma migrate deploy  # Apply migrations (production)
npx prisma db push         # Push schema (dev)
npx prisma db execute --file migrations/20260601000000_promotion_ops/migration.sql
```

---

## 12. Authentication

**Current state:** The login page at `/login` uses a **hardcoded dev check** (`admin@turnstyle.com` / `admin`). NextAuth is a dependency but is not fully wired for session protection on dashboard routes.

**Production implication:** Dashboard routes are not reliably gated by server-side auth today. Treat this as internal-only behind network controls until real auth is implemented.

---

## 13. Deployment

Typical flow (e.g. Vercel + Railway PostgreSQL):

1. Set all environment variables in the hosting provider
2. `npm run build` (runs `prisma generate` automatically)
3. Run migrations against production DB: `npx prisma migrate deploy`
4. Ensure `NEXT_PUBLIC_APP_URL` matches production domain (for email links)

Build command: `prisma generate && next build`  
Start command: `next start`

---

## 14. Related documentation

| Document | Purpose |
|----------|---------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | Honest workflow assessment, gaps, recommended direction |
| [CLAUDE.md](./CLAUDE.md) | AI/coding agent context |
| [lib/intake/CAMPAIGN_INTAKE_TODO.md](./lib/intake/CAMPAIGN_INTAKE_TODO.md) | Intake feature status |
| [lib/intake/RESEND_INBOUND_SETUP.md](./lib/intake/RESEND_INBOUND_SETUP.md) | Email-to-intake webhook setup |

---

## Summary

Turnstyle is Flow Marketing’s internal promotions tool: **strongest at pre-launch work** (quotes, terms, permits, draw scheduling to Pure Random). The **ops dashboard is an MVP** and should not be treated as the source of truth until it syncs with the campaign workspace.

For day-to-day use today:

1. **Intake** → **Builder** → **Campaign workspace** for quotes, terms, and draws  
2. **Admin permits** when status is PENDING  
3. **Ops dashboard** for visibility only if statuses are actively maintained  

Questions or changes to scope should start from PROJECT_OVERVIEW.md’s gap analysis and integration priorities.
