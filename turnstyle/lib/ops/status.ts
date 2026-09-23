import type {
  CampaignStatus,
  InvoiceOpsStatus,
  OpsDocumentStatus,
  PromotionDocument,
  PromotionDraw,
  TermsDraftStatus,
} from '@prisma/client'
import type { CalculatedPromotionStatus, LaunchReadinessCheck } from './types'

const COMPLETE_DOC: OpsDocumentStatus[] = ['COMPLETE', 'APPROVED', 'RECEIVED', 'NOT_APPLICABLE']
const DONE_TERMS: TermsDraftStatus[] = ['APPROVED', 'LOCKED']

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export function isOverdue(due: Date | null | undefined, now = new Date()): boolean {
  if (!due) return false
  return startOfDay(due).getTime() < startOfDay(now).getTime()
}

export function daysUntil(d: Date | null | undefined, now = new Date()): number | null {
  if (!d) return null
  const target = startOfDay(d).getTime()
  const today = startOfDay(now).getTime()
  return Math.round((target - today) / 86400000)
}

export function getTermsStatusLabel(drafts: { status: TermsDraftStatus }[]): string {
  if (!drafts.length) return 'Not started'
  const latest = drafts[0]
  switch (latest.status) {
    case 'DRAFT':
      return 'Draft'
    case 'IN_REVIEW':
      return 'In review'
    case 'APPROVED':
      return 'Approved'
    case 'LOCKED':
      return 'Final'
    default:
      return latest.status
  }
}

export function termsAreFinal(drafts: { status: TermsDraftStatus }[]): boolean {
  return drafts.some((d) => DONE_TERMS.includes(d.status))
}

export function getPermitStatus(campaign: {
  prizePoolTotal: { toString(): string } | number
  permitNSW: string | null
  permitSA: string | null
  permitACT: string | null
  permitLOASigned?: boolean
  requiredPermits: string[]
  opsDocuments: PromotionDocument[]
}): { label: string; pending: boolean; missingApprovals: boolean } {
  const pool = Number(campaign.prizePoolTotal)
  const needsNSW = campaign.requiredPermits.includes('NSW') || pool >= 10000
  const needsSA = campaign.requiredPermits.includes('SA') || pool >= 5000
  const needsACT = campaign.requiredPermits.includes('ACT') || pool >= 3000

  const permitApp = campaign.opsDocuments.find((d) => d.fileType === 'permit_applications')
  const permitApproval = campaign.opsDocuments.find((d) => d.fileType === 'permit_approvals')

  const missing: string[] = []
  if (needsNSW && !campaign.permitNSW) missing.push('NSW')
  if (needsSA && !campaign.permitSA) missing.push('SA')
  if (needsACT && !campaign.permitACT) missing.push('ACT')

  const appPending =
    permitApp &&
    permitApp.required &&
    !COMPLETE_DOC.includes(permitApp.status) &&
    permitApp.status !== 'LODGED'

  const approvalMissing =
    permitApproval &&
    permitApproval.required &&
    !COMPLETE_DOC.includes(permitApproval.status) &&
    missing.length > 0

  if (!needsNSW && !needsSA && !needsACT) {
    return { label: 'Not required', pending: false, missingApprovals: false }
  }
  if (missing.length === 0) {
    return { label: 'Approved', pending: false, missingApprovals: false }
  }
  if (appPending) {
    return { label: `Pending (${missing.join(', ')})`, pending: true, missingApprovals: !!approvalMissing }
  }
  return { label: `Required (${missing.join(', ')})`, pending: true, missingApprovals: !!approvalMissing }
}

export function getDrawStatusSummary(draws: PromotionDraw[], now = new Date()): {
  label: string
  hasDue: boolean
  hasOverdue: boolean
} {
  if (!draws.length) return { label: 'No draws scheduled', hasDue: false, hasOverdue: false }

  const today = startOfDay(now)
  let overdue = 0
  let dueToday = 0
  let upcoming = 0
  let complete = 0

  for (const d of draws) {
    const drawDay = startOfDay(d.drawDate)
    const done =
      d.entryFileStatus === 'USED_IN_DRAW' ||
      d.certificateStatus === 'SAVED_TO_DROPBOX' ||
      d.purerandomDrawStatus === 'complete'

    if (done) {
      complete++
      continue
    }
    if (drawDay.getTime() < today.getTime()) overdue++
    else if (drawDay.getTime() === today.getTime()) dueToday++
    else upcoming++
  }

  if (overdue > 0) return { label: `${overdue} overdue`, hasDue: true, hasOverdue: true }
  if (dueToday > 0) return { label: `${dueToday} due today`, hasDue: true, hasOverdue: false }
  if (upcoming > 0) return { label: `${upcoming} upcoming`, hasDue: false, hasOverdue: false }
  return { label: `${complete} complete`, hasDue: false, hasOverdue: false }
}

export function computeLaunchReadiness(campaign: {
  dropboxFolderUrl: string | null
  invoiceOpsStatus: InvoiceOpsStatus
  termsDrafts: { status: TermsDraftStatus }[]
  opsDraws: PromotionDraw[]
  prizePoolTotal: { toString(): string } | number
  permitNSW: string | null
  permitSA: string | null
  permitACT: string | null
  requiredPermits: string[]
  opsDocuments: PromotionDocument[]
}): LaunchReadinessCheck {
  const termsFinal = termsAreFinal(campaign.termsDrafts)
  const permit = getPermitStatus(campaign)
  const permitsOk = !permit.pending
  const invoiceIssued = ['ISSUED', 'PAID'].includes(campaign.invoiceOpsStatus)
  const invoiceConfirmed = campaign.invoiceOpsStatus === 'PAID'
  const drawDatesEntered = campaign.opsDraws.length > 0
  const dropboxLinked = !!campaign.dropboxFolderUrl

  const checks = {
    termsFinal,
    permitsOk,
    invoiceIssued,
    invoiceConfirmed,
    drawDatesEntered,
    dropboxLinked,
  }

  const blockers: string[] = []
  if (!termsFinal) blockers.push('Terms not final')
  if (!permitsOk) blockers.push('Permits pending or missing')
  if (!invoiceIssued) blockers.push('Invoice not issued')
  if (!invoiceConfirmed) blockers.push('Invoice not confirmed paid')
  if (!drawDatesEntered) blockers.push('Draw dates not entered')
  if (!dropboxLinked) blockers.push('Dropbox folder not linked')

  return { ready: blockers.length === 0, blockers, checks }
}

export function calculatePromotionStatus(input: {
  status: CampaignStatus
  termsDrafts: { status: TermsDraftStatus }[]
  opsDraws: PromotionDraw[]
  launchReady: boolean
  now?: Date
}): CalculatedPromotionStatus {
  const { status, termsDrafts, opsDraws, launchReady, now = new Date() } = input

  if (status === 'ARCHIVED') return 'ARCHIVED'
  if (status === 'DRAWN' || status === 'CLOSED') {
    const drawSummary = getDrawStatusSummary(opsDraws, now)
    if (drawSummary.hasOverdue) return 'DRAW_OVERDUE'
    if (status === 'DRAWN') return 'COMPLETE'
  }

  const drawSummary = getDrawStatusSummary(opsDraws, now)
  if (drawSummary.hasOverdue) return 'DRAW_OVERDUE'
  if (drawSummary.hasDue) return 'DRAW_DUE'

  if (status === 'LIVE') return 'LIVE'
  if (launchReady && ['SCHEDULED', 'PENDING'].includes(status)) return 'READY_TO_LAUNCH'

  const permitPending = termsDrafts.length > 0 && !termsAreFinal(termsDrafts)
  if (status === 'PENDING') return 'PERMIT_PENDING'
  if (permitPending) return 'TERMS_IN_PROGRESS'

  if (['CONFIRMED', 'COMPILED'].includes(status)) return 'APPROVED'
  if (status === 'REVIEW') return 'AWAITING_APPROVAL'

  return 'DRAFT'
}

export function getNextAction(campaign: {
  status: CampaignStatus
  dropboxFolderUrl: string | null
  invoiceOpsStatus: InvoiceOpsStatus
  termsDrafts: { status: TermsDraftStatus }[]
  opsDocuments: PromotionDocument[]
  opsDraws: PromotionDraw[]
}): string {
  if (!campaign.dropboxFolderUrl) return 'Link Dropbox folder'
  if (!termsAreFinal(campaign.termsDrafts)) return 'Finalise terms'

  const permitApp = campaign.opsDocuments.find((d) => d.fileType === 'permit_applications')
  if (permitApp?.status === 'IN_PROGRESS' || permitApp?.status === 'REQUIRED') {
    return 'Lodge permit applications'
  }

  const permitApproval = campaign.opsDocuments.find((d) => d.fileType === 'permit_approvals')
  if (permitApproval && !COMPLETE_DOC.includes(permitApproval.status)) {
    return 'Obtain permit approvals'
  }

  if (!['ISSUED', 'PAID'].includes(campaign.invoiceOpsStatus)) return 'Issue invoice'
  if (campaign.invoiceOpsStatus !== 'PAID') return 'Confirm invoice paid'

  const drawNeedingFile = campaign.opsDraws.find(
    (d) =>
      d.entryFileRequired &&
      !['READY_FOR_DRAW', 'USED_IN_DRAW', 'ARCHIVED', 'NOT_REQUIRED'].includes(d.entryFileStatus)
  )
  if (drawNeedingFile) return `Prepare entry file for ${drawNeedingFile.drawName}`

  const certNeeded = campaign.opsDraws.find(
    (d) => d.certificateStatus === 'NOT_STARTED' || d.certificateStatus === 'GENERATED'
  )
  if (certNeeded) return `Generate certificate for ${certNeeded.drawName}`

  if (campaign.status === 'LIVE') return 'Monitor live promotion'
  if (campaign.status === 'SCHEDULED') return 'Launch promotion'

  return 'Review promotion status'
}

export function collectOverdueWarnings(campaign: {
  opsDocuments: PromotionDocument[]
  opsDraws: PromotionDraw[]
  invoiceOpsStatus: InvoiceOpsStatus
}, now = new Date()): string[] {
  const warnings: string[] = []

  for (const doc of campaign.opsDocuments) {
    if (doc.required && isOverdue(doc.dueDate, now) && !COMPLETE_DOC.includes(doc.status)) {
      warnings.push(`${doc.fileType.replace(/_/g, ' ')} overdue`)
    }
  }

  for (const draw of campaign.opsDraws) {
    if (isOverdue(draw.drawDate, now) && draw.entryFileStatus !== 'USED_IN_DRAW') {
      warnings.push(`${draw.drawName} draw overdue`)
    }
    if (isOverdue(draw.winnerNotifyDue, now) && draw.winnerNotifyStatus !== 'COMPLETE') {
      warnings.push(`${draw.drawName} winner notification overdue`)
    }
    if (draw.publicationRequired && isOverdue(draw.publicationDue, now) && draw.publicationStatus !== 'COMPLETE') {
      warnings.push(`${draw.drawName} publication overdue`)
    }
  }

  if (campaign.invoiceOpsStatus === 'REQUIRED') {
    warnings.push('Invoice not issued')
  }

  return warnings
}
