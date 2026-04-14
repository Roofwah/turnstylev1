# Turnstyle v1.0 — Claude Code Context

## Project Overview
Turnstyle is a **trade promotions workflow application** and **pureRandom draw machine** built with Next.js 16, Prisma ORM, NextAuth, and PostgreSQL.

## Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL via Prisma (`@prisma/adapter-pg`)
- **Auth**: NextAuth v4 with Prisma adapter
- **Forms**: React Hook Form + `@hookform/resolvers`
- **Language**: TypeScript

## Key Scripts
```bash
npm run dev       # Start dev server
npm run build     # prisma generate + next build
npm run seed      # Seed database (tsx prisma/seed.ts)
npm run lint      # ESLint
```

## Project Structure
```
turnstyle/
├── app/
│   ├── (auth)/           # Auth routes (login, etc.)
│   ├── actions/          # Server actions
│   ├── api/              # API routes
│   ├── dashboard/        # Main app dashboard
│   │   ├── [id]/         # Campaign detail
│   │   ├── admin/        # Admin panel
│   │   ├── devflow/      # Dev workflow form
│   │   ├── express/      # Express campaign flow
│   │   ├── lite/         # Lite campaign flow
│   │   └── new/          # New campaign creation
│   └── review/           # Review/approval flow
├── lib/
│   ├── purerandom.ts     # PureRandom draw machine logic
│   ├── quote-engine.ts   # Quote generation engine
│   ├── preflight/        # Preflight engine (validation)
│   ├── lifecycle.ts      # Campaign lifecycle management
│   ├── draw-schedule.ts  # Draw scheduling
│   ├── email/            # Email templates/sending
│   ├── loa-template.ts   # Letter of Authority template
│   ├── terms-templates/  # Terms & conditions templates
│   ├── promoter-lookup.ts
│   ├── promoter-match.ts
│   └── prisma.ts         # Prisma client singleton
├── components/           # Shared React components
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
└── scripts/              # Utility scripts
```

## Core Domain Concepts
- **Campaign**: A trade promotion with lifecycle states (draft → review → approved → active → complete)
- **PureRandom**: Provably fair draw machine for prize draws
- **Preflight Engine**: Validates campaigns before submission/activation
- **Quote Engine**: Generates pricing quotes for promotions
- **Devflow / Express / Lite**: Different campaign creation workflows by complexity
- **LOA**: Letter of Authority — legal doc for running promotions on behalf of clients
- **Promoter**: The business/entity running the promotion

## Database
- PostgreSQL (pg adapter)
- Schema at `prisma/schema.prisma`
- Run `npx prisma studio` to browse data visually

## Conventions
- Server actions in `app/actions/`
- API routes in `app/api/`
- Shared utilities in `lib/`
- Components in `components/`
- No `src/` directory — files live at root of `turnstyle/`

## Notes
- This is a worktree-based project — main branch is `main`, feature work uses `claude/*` branches
- The parent directory `/Users/chrisscott/Documents/turnstyle_v1.0/` contains docs, specs, and legacy files
