/**
 * Seed promotion ops data — run: npx tsx prisma/seed-ops.ts
 */
import { PrismaClient } from '@prisma/client'
import { DOCUMENT_TYPES } from '../lib/ops/constants'

const prisma = new PrismaClient()

const PROMOTIONS = [
  {
    name: 'Repco June Rewards',
    promoter: 'Repco Parts Pty Ltd',
    mechanicType: 'SWEEPSTAKES' as const,
    promoStart: '2026-06-01',
    promoEnd: '2026-06-30',
    prizePool: 85000,
    status: 'LIVE' as const,
    dropbox: 'https://www.dropbox.com/home/Repco%20June%20Rewards',
    intakeSummary: 'National sweepstakes — purchase $50+ in-store or online to enter. Major prize $50k cash. Weekly minor draws.',
    preflightScore: 82,
    invoiceOpsStatus: 'PAID' as const,
    regions: ['national_au'],
    requiredPermits: ['NSW', 'SA'],
    permitNSW: 'GOCOP-2026-1842',
    permitSA: 'T26/1847',
    draws: [
      {
        drawName: 'Week 1 Minor Draw',
        drawNumber: 1,
        drawDate: '2026-06-08',
        drawTime: '10:00',
        drawLocation: 'Flow Marketing, Melbourne',
        entryPeriodStart: '2026-06-01',
        entryPeriodEnd: '2026-06-07',
        entryFileStatus: 'USED_IN_DRAW' as const,
        certificateStatus: 'SAVED_TO_DROPBOX' as const,
        purerandomDrawStatus: 'complete',
      },
      {
        drawName: 'Week 2 Minor Draw',
        drawNumber: 2,
        drawDate: '2026-06-15',
        drawTime: '10:00',
        drawLocation: 'Flow Marketing, Melbourne',
        entryPeriodStart: '2026-06-08',
        entryPeriodEnd: '2026-06-14',
        entryFileStatus: 'READY_FOR_DRAW' as const,
        certificateStatus: 'GENERATED' as const,
        purerandomDrawStatus: 'scheduled',
      },
      {
        drawName: 'Major Draw',
        drawNumber: 3,
        drawDate: '2026-07-07',
        drawTime: '11:00',
        drawLocation: 'Flow Marketing, Melbourne',
        entryPeriodStart: '2026-06-01',
        entryPeriodEnd: '2026-06-30',
        entryFileStatus: 'NOT_REQUIRED' as const,
        certificateStatus: 'NOT_STARTED' as const,
        publicationRequired: true,
        publicationDue: '2026-07-14',
      },
    ],
    docOverrides: {
      final_terms: 'COMPLETE',
      permit_approvals: 'COMPLETE',
      invoice_paid: 'COMPLETE',
    },
  },
  {
    name: 'Rheem Tradelink Free Hot Water',
    promoter: 'Rheem Australia Pty Limited',
    mechanicType: 'LIMITED_OFFER' as const,
    promoStart: '2026-05-15',
    promoEnd: '2026-08-31',
    prizePool: 120000,
    status: 'SCHEDULED' as const,
    dropbox: 'https://www.dropbox.com/home/Rheem%20Tradelink%20Free%20Hot%20Water',
    intakeSummary: 'Trade redemption offer — free hot water system on qualifying Tradelink purchases. NSW/QLD/VIC.',
    preflightScore: 76,
    invoiceOpsStatus: 'ISSUED' as const,
    regions: ['NSW', 'QLD', 'VIC'],
    requiredPermits: ['NSW'],
    permitNSW: null,
    draws: [
      {
        drawName: 'Final Draw',
        drawNumber: 1,
        drawDate: '2026-09-07',
        drawTime: '14:00',
        drawLocation: 'Pure Random, Sydney',
        entryPeriodStart: '2026-05-15',
        entryPeriodEnd: '2026-08-31',
        entryFileStatus: 'NOT_REQUIRED' as const,
        certificateStatus: 'NOT_STARTED' as const,
      },
    ],
    docOverrides: {
      quote_approved: 'COMPLETE',
      draft_terms: 'IN_PROGRESS',
      permit_applications: 'IN_PROGRESS',
      invoice_issued: 'COMPLETE',
    },
  },
  {
    name: 'STEDI Cashback',
    promoter: 'STEDI',
    mechanicType: 'INSTANT_WIN' as const,
    promoStart: '2026-04-01',
    promoEnd: '2026-05-31',
    prizePool: 45000,
    status: 'CLOSED' as const,
    dropbox: 'https://www.dropbox.com/home/STEDI%20Cashback',
    intakeSummary: 'Online cashback on STEDI lighting products. Instant win mechanic with monthly draw backup.',
    preflightScore: 88,
    invoiceOpsStatus: 'PAID' as const,
    regions: ['national_au'],
    requiredPermits: ['SA'],
    permitSA: 'T26/1204',
    draws: [
      {
        drawName: 'May Backup Draw',
        drawNumber: 1,
        drawDate: '2026-06-03',
        drawTime: '09:30',
        drawLocation: 'Flow Marketing, Melbourne',
        entryPeriodStart: '2026-05-01',
        entryPeriodEnd: '2026-05-31',
        entryFileStatus: 'REQUESTED' as const,
        certificateStatus: 'NOT_STARTED' as const,
        winnerNotifyDue: '2026-06-10',
        winnerNotifyStatus: 'NOT_STARTED' as const,
      },
    ],
    docOverrides: {
      entry_file: 'WAITING_ON_CLIENT',
      final_terms: 'COMPLETE',
      permit_approvals: 'COMPLETE',
    },
  },
  {
    name: 'Energizer Metcash Learn & Earn',
    promoter: 'Energizer Australia',
    mechanicType: 'GAME_OF_SKILL' as const,
    promoStart: '2026-07-01',
    promoEnd: '2026-09-30',
    prizePool: 62000,
    status: 'PENDING' as const,
    dropbox: null,
    intakeSummary: 'Metcash retailer training program with skill-based entries and quarterly prize draws.',
    preflightScore: null,
    invoiceOpsStatus: 'REQUIRED' as const,
    regions: ['national_au'],
    requiredPermits: ['NSW', 'ACT'],
    draws: [
      {
        drawName: 'Q3 Draw',
        drawNumber: 1,
        drawDate: '2026-10-07',
        drawTime: '11:00',
        drawLocation: 'TBC',
        entryPeriodStart: '2026-07-01',
        entryPeriodEnd: '2026-09-30',
        entryFileStatus: 'NOT_REQUIRED' as const,
        certificateStatus: 'NOT_STARTED' as const,
        publicationRequired: true,
        publicationDue: '2026-10-21',
      },
    ],
    docOverrides: {
      intake_brief: 'COMPLETE',
      quote_approved: 'IN_PROGRESS',
      permit_applications: 'NOT_STARTED',
    },
  },
]

async function ensurePromoter(name: string, abn?: string) {
  let p = await prisma.promoter.findFirst({ where: { name } })
  if (!p) {
    p = await prisma.promoter.create({
      data: { name, abn: abn ?? null },
    })
  }
  return p
}

async function ensureAdminUser() {
  let u = await prisma.user.findFirst({ where: { email: 'admin@turnstyle.com' } })
  if (!u) {
    u = await prisma.user.create({
      data: {
        email: 'admin@turnstyle.com',
        passwordHash: 'temp',
        name: 'Admin',
        role: 'ADMIN',
      },
    })
  }
  return u
}

function tsCodeFromName(name: string, index: number) {
  const base = name.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase()
  return `${base}${index}`.slice(0, 5).padEnd(5, 'X')
}

async function main() {
  console.log('Seeding promotion ops…')
  const admin = await ensureAdminUser()

  await ensurePromoter('Repco Parts Pty Ltd', '97 097 993 283')
  await ensurePromoter('Rheem Australia Pty Limited', '21 098 823 511')
  await ensurePromoter('STEDI')
  await ensurePromoter('Energizer Australia')

  let i = 0
  for (const promo of PROMOTIONS) {
    i++
    const promoter = await ensurePromoter(promo.promoter)
    const tsCode = tsCodeFromName(promo.name, i)

    let campaign = await prisma.campaign.findFirst({ where: { name: promo.name } })

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          tsCode,
          name: promo.name,
          promoterId: promoter.id,
          createdById: admin.id,
          promoStart: new Date(promo.promoStart),
          promoEnd: new Date(promo.promoEnd),
          mechanicType: promo.mechanicType,
          prizePoolTotal: promo.prizePool,
          status: promo.status,
          regions: promo.regions,
          requiredPermits: promo.requiredPermits,
          permitNSW: promo.permitNSW ?? null,
          permitSA: (promo as { permitSA?: string }).permitSA ?? null,
          dropboxFolderUrl: promo.dropbox,
          intakeSummary: promo.intakeSummary,
          preflightScore: promo.preflightScore,
          invoiceOpsStatus: promo.invoiceOpsStatus,
          prizes: [],
        },
      })
      console.log(`  Created campaign: ${promo.name}`)
    } else {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          dropboxFolderUrl: promo.dropbox,
          intakeSummary: promo.intakeSummary,
          preflightScore: promo.preflightScore,
          invoiceOpsStatus: promo.invoiceOpsStatus,
          status: promo.status,
        },
      })
      console.log(`  Updated campaign: ${promo.name}`)
    }

    for (const def of DOCUMENT_TYPES) {
      const override = promo.docOverrides?.[def.fileType as keyof typeof promo.docOverrides]
      await prisma.promotionDocument.upsert({
        where: {
          campaignId_fileType: { campaignId: campaign.id, fileType: def.fileType },
        },
        create: {
          campaignId: campaign.id,
          fileType: def.fileType,
          folderLabel: def.folder,
          required: !['creative_assets', 'draw_record'].includes(def.fileType),
          status: (override as never) ?? 'NOT_STARTED',
          dropboxFolder: def.folder,
          dueDate: override ? null : new Date(promo.promoStart),
        },
        update: {
          status: override ? (override as never) : undefined,
        },
      })
    }

    await prisma.promotionDraw.deleteMany({ where: { campaignId: campaign.id } })
    for (const d of promo.draws) {
      await prisma.promotionDraw.create({
        data: {
          campaignId: campaign.id,
          drawName: d.drawName,
          drawNumber: d.drawNumber,
          drawDate: new Date(d.drawDate),
          drawTime: d.drawTime,
          drawLocation: d.drawLocation,
          entryPeriodStart: d.entryPeriodStart ? new Date(d.entryPeriodStart) : null,
          entryPeriodEnd: d.entryPeriodEnd ? new Date(d.entryPeriodEnd) : null,
          entryFileStatus: d.entryFileStatus,
          certificateStatus: d.certificateStatus,
          purerandomDrawStatus: 'purerandomDrawStatus' in d ? d.purerandomDrawStatus ?? null : null,
          publicationRequired: 'publicationRequired' in d ? d.publicationRequired ?? false : false,
          publicationDue: 'publicationDue' in d && d.publicationDue ? new Date(d.publicationDue) : null,
          winnerNotifyDue: 'winnerNotifyDue' in d && d.winnerNotifyDue ? new Date(d.winnerNotifyDue) : null,
          winnerNotifyStatus: 'winnerNotifyStatus' in d ? (d.winnerNotifyStatus as never) : 'NOT_STARTED',
          permitReference: promo.permitNSW ?? promo.requiredPermits[0] ?? null,
        },
      })
    }
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
