import type {
  Campaign,
  CampaignStatus,
  DrawCertificateStatus,
  DrawFileStatus,
  InvoiceOpsStatus,
  OpsDocumentStatus,
  PromotionDocument,
  PromotionDraw,
  Promoter,
  Quote,
  TermsDraft,
} from '@prisma/client'

export type CalculatedPromotionStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'TERMS_IN_PROGRESS'
  | 'PERMIT_PENDING'
  | 'READY_TO_LAUNCH'
  | 'LIVE'
  | 'DRAW_DUE'
  | 'DRAW_OVERDUE'
  | 'COMPLETE'
  | 'ARCHIVED'

export type PromotionWithOps = Campaign & {
  promoter: Promoter | null
  quotes: Quote[]
  termsDrafts: TermsDraft[]
  opsDocuments: PromotionDocument[]
  opsDraws: PromotionDraw[]
}

export type LaunchReadinessCheck = {
  ready: boolean
  blockers: string[]
  checks: {
    termsFinal: boolean
    permitsOk: boolean
    invoiceIssued: boolean
    invoiceConfirmed: boolean
    drawDatesEntered: boolean
    dropboxLinked: boolean
  }
}

export type DashboardMetrics = {
  livePromotions: number
  drawsDueThisWeek: number
  overdueActions: number
  awaitingInvoice: number
  awaitingPermits: number
  drawFilesRequired: number
  drawFilesOverdue: number
  certificatesToGenerate: number
  certificatesNotSent: number
  permitApplicationsPending: number
  permitApprovalsMissing: number
  invoicesNotIssued: number
  invoicesNotPaid: number
}

export type PromotionRow = {
  id: string
  tsCode: string
  clientName: string
  campaignName: string
  calculatedStatus: CalculatedPromotionStatus
  campaignStatus: CampaignStatus
  startDate: Date | null
  endDate: Date | null
  invoiceStatus: InvoiceOpsStatus
  termsStatus: string
  permitStatus: string
  drawStatus: string
  nextAction: string
  overdueWarnings: string[]
  dropboxFolderUrl: string | null
}

export type DocumentFilter = {
  status?: OpsDocumentStatus
  fileType?: string
  campaignId?: string
  clientName?: string
  requiredOnly?: boolean
  overdueOnly?: boolean
  waitingOnClient?: boolean
  completeOnly?: boolean
  incompleteOnly?: boolean
}

export type DrawWithCampaign = PromotionDraw & {
  campaign: {
    id: string
    name: string
    tsCode: string
    promoter: { name: string } | null
  }
}

export { type DrawCertificateStatus, type DrawFileStatus, type OpsDocumentStatus }
