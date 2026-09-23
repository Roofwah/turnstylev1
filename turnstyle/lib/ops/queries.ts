import { prisma } from '@/lib/prisma'
import type { OpsDocumentStatus } from '@prisma/client'
import { DOCUMENT_TYPES } from './constants'
import {
  calculatePromotionStatus,
  collectOverdueWarnings,
  computeLaunchReadiness,
  getDrawStatusSummary,
  getNextAction,
  getPermitStatus,
  getTermsStatusLabel,
  isOverdue,
  startOfDay,
} from './status'
import type { DashboardMetrics, DocumentFilter, PromotionRow, PromotionWithOps } from './types'

const opsInclude = {
  promoter: true,
  quotes: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  termsDrafts: { orderBy: { version: 'desc' as const }, take: 1 },
  opsDocuments: true,
  opsDraws: { orderBy: { drawDate: 'asc' as const } },
}

export async function getPromotionWithOps(id: string): Promise<PromotionWithOps | null> {
  return prisma.campaign.findUnique({
    where: { id },
    include: opsInclude,
  })
}

export async function getAllPromotionsWithOps(): Promise<PromotionWithOps[]> {
  return prisma.campaign.findMany({
    include: opsInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export function toPromotionRow(campaign: PromotionWithOps, now = new Date()): PromotionRow {
  const launch = computeLaunchReadiness(campaign)
  const calculatedStatus = calculatePromotionStatus({
    status: campaign.status,
    termsDrafts: campaign.termsDrafts,
    opsDraws: campaign.opsDraws,
    launchReady: launch.ready,
    now,
  })
  const permit = getPermitStatus(campaign)
  const draw = getDrawStatusSummary(campaign.opsDraws, now)

  return {
    id: campaign.id,
    tsCode: campaign.tsCode,
    clientName: campaign.promoter?.name ?? '—',
    campaignName: campaign.name,
    calculatedStatus,
    campaignStatus: campaign.status,
    startDate: campaign.promoStart,
    endDate: campaign.promoEnd,
    invoiceStatus: campaign.invoiceOpsStatus,
    termsStatus: getTermsStatusLabel(campaign.termsDrafts),
    permitStatus: permit.label,
    drawStatus: draw.label,
    nextAction: getNextAction(campaign),
    overdueWarnings: collectOverdueWarnings(campaign, now),
    dropboxFolderUrl: campaign.dropboxFolderUrl,
  }
}

export async function getDashboardMetrics(now = new Date()): Promise<DashboardMetrics> {
  const campaigns = await getAllPromotionsWithOps()
  const weekEnd = new Date(startOfDay(now))
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  let metrics: DashboardMetrics = {
    livePromotions: 0,
    drawsDueThisWeek: 0,
    overdueActions: 0,
    awaitingInvoice: 0,
    awaitingPermits: 0,
    drawFilesRequired: 0,
    drawFilesOverdue: 0,
    certificatesToGenerate: 0,
    certificatesNotSent: 0,
    permitApplicationsPending: 0,
    permitApprovalsMissing: 0,
    invoicesNotIssued: 0,
    invoicesNotPaid: 0,
  }

  for (const c of campaigns) {
    if (c.status === 'LIVE') metrics.livePromotions++

    if (!['ISSUED', 'PAID', 'NOT_APPLICABLE'].includes(c.invoiceOpsStatus)) {
      metrics.awaitingInvoice++
      metrics.invoicesNotIssued++
    }
    if (c.invoiceOpsStatus === 'ISSUED') metrics.invoicesNotPaid++

    const permit = getPermitStatus(c)
    if (permit.pending) metrics.awaitingPermits++

    const permitApp = c.opsDocuments.find((d) => d.fileType === 'permit_applications')
    if (permitApp && ['REQUIRED', 'IN_PROGRESS', 'NOT_STARTED'].includes(permitApp.status)) {
      metrics.permitApplicationsPending++
    }
    if (permit.missingApprovals) metrics.permitApprovalsMissing++

    const warnings = collectOverdueWarnings(c, now)
    metrics.overdueActions += warnings.length

    for (const d of c.opsDraws) {
      const drawDay = startOfDay(d.drawDate)
      if (drawDay >= startOfDay(now) && drawDay <= weekEnd) metrics.drawsDueThisWeek++

      if (
        d.entryFileRequired &&
        ['REQUIRED', 'REQUESTED'].includes(d.entryFileStatus)
      ) {
        metrics.drawFilesRequired++
      }
      if (
        d.entryFileRequired &&
        isOverdue(d.drawDate, now) &&
        !['USED_IN_DRAW', 'ARCHIVED', 'NOT_REQUIRED'].includes(d.entryFileStatus)
      ) {
        metrics.drawFilesOverdue++
      }
      if (d.certificateStatus === 'NOT_STARTED' || d.certificateStatus === 'GENERATED') {
        metrics.certificatesToGenerate++
      }
      if (d.certificateStatus !== 'SENT_TO_CLIENT' && d.certificateStatus !== 'SAVED_TO_DROPBOX') {
        if (d.purerandomDrawStatus === 'complete' || d.entryFileStatus === 'USED_IN_DRAW') {
          metrics.certificatesNotSent++
        }
      }
    }
  }

  return metrics
}

export async function getDrawsWithCampaigns() {
  return prisma.promotionDraw.findMany({
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          tsCode: true,
          promoter: { select: { name: true } },
        },
      },
    },
    orderBy: { drawDate: 'asc' },
  })
}

export async function getOverdueItems(now = new Date()) {
  const campaigns = await getAllPromotionsWithOps()
  const documents: Array<{
    campaignId: string
    campaignName: string
    clientName: string
    fileType: string
    dueDate: Date | null
    status: OpsDocumentStatus
  }> = []
  const draws: Array<{
    campaignId: string
    campaignName: string
    drawId: string
    drawName: string
    kind: 'draw' | 'winner_notify' | 'publication' | 'entry_file'
    dueDate: Date | null
  }> = []

  for (const c of campaigns) {
    for (const doc of c.opsDocuments) {
      if (doc.required && isOverdue(doc.dueDate, now) && !['COMPLETE', 'NOT_APPLICABLE', 'APPROVED', 'RECEIVED'].includes(doc.status)) {
        documents.push({
          campaignId: c.id,
          campaignName: c.name,
          clientName: c.promoter?.name ?? '—',
          fileType: doc.fileType,
          dueDate: doc.dueDate,
          status: doc.status,
        })
      }
    }
    for (const d of c.opsDraws) {
      if (isOverdue(d.drawDate, now) && d.entryFileStatus !== 'USED_IN_DRAW') {
        draws.push({
          campaignId: c.id,
          campaignName: c.name,
          drawId: d.id,
          drawName: d.drawName,
          kind: 'draw',
          dueDate: d.drawDate,
        })
      }
      if (isOverdue(d.winnerNotifyDue, now) && d.winnerNotifyStatus !== 'COMPLETE') {
        draws.push({
          campaignId: c.id,
          campaignName: c.name,
          drawId: d.id,
          drawName: d.drawName,
          kind: 'winner_notify',
          dueDate: d.winnerNotifyDue,
        })
      }
      if (d.publicationRequired && isOverdue(d.publicationDue, now) && d.publicationStatus !== 'COMPLETE') {
        draws.push({
          campaignId: c.id,
          campaignName: c.name,
          drawId: d.id,
          drawName: d.drawName,
          kind: 'publication',
          dueDate: d.publicationDue,
        })
      }
      if (
        d.entryFileRequired &&
        isOverdue(d.drawDate, now) &&
        !['READY_FOR_DRAW', 'USED_IN_DRAW', 'ARCHIVED', 'NOT_REQUIRED'].includes(d.entryFileStatus)
      ) {
        draws.push({
          campaignId: c.id,
          campaignName: c.name,
          drawId: d.id,
          drawName: d.drawName,
          kind: 'entry_file',
          dueDate: d.drawDate,
        })
      }
    }
  }

  return { documents, draws }
}

export function filterDocuments(
  docs: Array<{
    id: string
    campaignId: string
    fileType: string
    required: boolean
    status: OpsDocumentStatus
    dueDate: Date | null
    campaign?: { name: string; promoter: { name: string } | null }
  }>,
  filter: DocumentFilter,
  now = new Date()
) {
  return docs.filter((doc) => {
    if (filter.status && doc.status !== filter.status) return false
    if (filter.fileType && doc.fileType !== filter.fileType) return false
    if (filter.campaignId && doc.campaignId !== filter.campaignId) return false
    if (filter.clientName && doc.campaign?.promoter?.name !== filter.clientName) return false
    if (filter.requiredOnly && !doc.required) return false
    if (filter.overdueOnly && !isOverdue(doc.dueDate, now)) return false
    if (filter.waitingOnClient && doc.status !== 'WAITING_ON_CLIENT') return false
    if (filter.completeOnly && !['COMPLETE', 'APPROVED', 'RECEIVED', 'NOT_APPLICABLE'].includes(doc.status)) return false
    if (filter.incompleteOnly && ['COMPLETE', 'APPROVED', 'RECEIVED', 'NOT_APPLICABLE'].includes(doc.status)) return false
    return true
  })
}

export async function ensureDefaultDocuments(campaignId: string) {
  for (const def of DOCUMENT_TYPES) {
    await prisma.promotionDocument.upsert({
      where: {
        campaignId_fileType: { campaignId, fileType: def.fileType },
      },
      create: {
        campaignId,
        fileType: def.fileType,
        folderLabel: def.folder,
        required: !['creative_assets', 'draw_record'].includes(def.fileType),
        status: 'NOT_STARTED',
        dropboxFolder: def.folder,
      },
      update: {},
    })
  }
}
