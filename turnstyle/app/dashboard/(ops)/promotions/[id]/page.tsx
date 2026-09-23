export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import PromotionOpsDetail from '@/components/ops/PromotionOpsDetail'
import {
  calculatePromotionStatus,
  computeLaunchReadiness,
  getNextAction,
  getTermsStatusLabel,
} from '@/lib/ops/status'
import { ensureDefaultDocuments, getPromotionWithOps } from '@/lib/ops/queries'

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let campaign = await getPromotionWithOps(id)
  if (!campaign) notFound()

  if (campaign.opsDocuments.length === 0) {
    await ensureDefaultDocuments(id)
    campaign = await getPromotionWithOps(id)
    if (!campaign) notFound()
  }

  const launchReadiness = computeLaunchReadiness(campaign)
  const calculatedStatus = calculatePromotionStatus({
    status: campaign.status,
    termsDrafts: campaign.termsDrafts,
    opsDraws: campaign.opsDraws,
    launchReady: launchReadiness.ready,
  })

  const serializeDate = (d: Date | null) => (d ? d.toISOString() : null)

  return (
    <PromotionOpsDetail
      campaign={{
        id: campaign.id,
        tsCode: campaign.tsCode,
        name: campaign.name,
        status: campaign.status,
        mechanicType: campaign.mechanicType,
        promoStart: serializeDate(campaign.promoStart),
        promoEnd: serializeDate(campaign.promoEnd),
        prizePoolTotal: Number(campaign.prizePoolTotal),
        dropboxFolderUrl: campaign.dropboxFolderUrl,
        intakeSummary: campaign.intakeSummary,
        preflightScore: campaign.preflightScore,
        invoiceOpsStatus: campaign.invoiceOpsStatus,
        opsNotes: campaign.opsNotes,
        permitNSW: campaign.permitNSW,
        permitSA: campaign.permitSA,
        permitACT: campaign.permitACT,
        requiredPermits: campaign.requiredPermits,
        promoter: campaign.promoter,
      }}
      calculatedStatus={calculatedStatus}
      launchReadiness={launchReadiness}
      nextAction={getNextAction(campaign)}
      termsStatus={getTermsStatusLabel(campaign.termsDrafts)}
      documents={campaign.opsDocuments.map((d) => ({
        id: d.id,
        fileType: d.fileType,
        required: d.required,
        status: d.status,
        dueDate: serializeDate(d.dueDate),
        dropboxFileUrl: d.dropboxFileUrl,
        notes: d.notes,
        folderLabel: d.folderLabel,
      }))}
      draws={campaign.opsDraws.map((d) => ({
        id: d.id,
        drawName: d.drawName,
        drawNumber: d.drawNumber,
        drawDate: d.drawDate.toISOString(),
        drawTime: d.drawTime,
        drawLocation: d.drawLocation,
        entryPeriodStart: serializeDate(d.entryPeriodStart),
        entryPeriodEnd: serializeDate(d.entryPeriodEnd),
        entryFileRequired: d.entryFileRequired,
        entryFileStatus: d.entryFileStatus,
        entryFileDropboxUrl: d.entryFileDropboxUrl,
        purerandomDrawStatus: d.purerandomDrawStatus,
        certificateStatus: d.certificateStatus,
        certificateDropboxUrl: d.certificateDropboxUrl,
        winnerNotifyDue: serializeDate(d.winnerNotifyDue),
        winnerNotifyStatus: d.winnerNotifyStatus,
        publicationRequired: d.publicationRequired,
        publicationDue: serializeDate(d.publicationDue),
        publicationStatus: d.publicationStatus,
        permitReference: d.permitReference,
        notes: d.notes,
      }))}
    />
  )
}
