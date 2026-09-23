'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { normalizeDropboxFolderUrl } from '@/lib/ops/dropbox'
import { ensureDefaultDocuments } from '@/lib/ops/queries'

export async function updatePromotionDropbox(campaignId: string, dropboxFolderUrl: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { dropboxFolderUrl: normalizeDropboxFolderUrl(dropboxFolderUrl) },
  })
  revalidatePath(`/dashboard/promotions/${campaignId}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/promotions')
}

export async function updatePromotionOpsNotes(campaignId: string, opsNotes: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { opsNotes },
  })
  revalidatePath(`/dashboard/promotions/${campaignId}`)
}

export async function updatePromotionInvoiceStatus(
  campaignId: string,
  invoiceOpsStatus: 'NOT_STARTED' | 'REQUIRED' | 'ISSUED' | 'PAID' | 'NOT_APPLICABLE'
) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { invoiceOpsStatus },
  })
  revalidatePath(`/dashboard/promotions/${campaignId}`)
  revalidatePath('/dashboard')
}

export async function updatePromotionDocument(
  documentId: string,
  data: {
    status?: string
    required?: boolean
    dueDate?: string | null
    dropboxFileUrl?: string | null
    notes?: string | null
  }
) {
  const doc = await prisma.promotionDocument.update({
    where: { id: documentId },
    data: {
      ...(data.status && { status: data.status as never }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.dropboxFileUrl !== undefined && { dropboxFileUrl: data.dropboxFileUrl }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })
  revalidatePath(`/dashboard/promotions/${doc.campaignId}`)
  revalidatePath('/dashboard/overdue')
  return doc
}

export async function updatePromotionDraw(
  drawId: string,
  data: Record<string, unknown>
) {
  const payload: Record<string, unknown> = {}
  if (data.drawName) payload.drawName = String(data.drawName)
  if (data.drawTime !== undefined) payload.drawTime = data.drawTime as string | null
  if (data.drawLocation !== undefined) payload.drawLocation = data.drawLocation as string | null
  if (data.entryFileStatus) payload.entryFileStatus = data.entryFileStatus
  if (data.entryFileDropboxUrl !== undefined) payload.entryFileDropboxUrl = data.entryFileDropboxUrl
  if (data.certificateStatus) payload.certificateStatus = data.certificateStatus
  if (data.certificateDropboxUrl !== undefined) payload.certificateDropboxUrl = data.certificateDropboxUrl
  if (data.winnerNotifyStatus) payload.winnerNotifyStatus = data.winnerNotifyStatus
  if (data.publicationStatus) payload.publicationStatus = data.publicationStatus
  if (data.purerandomDrawStatus !== undefined) payload.purerandomDrawStatus = data.purerandomDrawStatus
  if (data.notes !== undefined) payload.notes = data.notes
  if (data.winnerNotifyDue !== undefined) {
    payload.winnerNotifyDue = data.winnerNotifyDue ? new Date(String(data.winnerNotifyDue)) : null
  }
  if (data.publicationDue !== undefined) {
    payload.publicationDue = data.publicationDue ? new Date(String(data.publicationDue)) : null
  }

  const draw = await prisma.promotionDraw.update({
    where: { id: drawId },
    data: payload as never,
  })
  revalidatePath(`/dashboard/promotions/${draw.campaignId}`)
  revalidatePath('/dashboard/draws')
  revalidatePath('/dashboard/overdue')
  return draw
}

export async function initPromotionDocuments(campaignId: string) {
  await ensureDefaultDocuments(campaignId)
  revalidatePath(`/dashboard/promotions/${campaignId}`)
}

export async function createPromotionDraw(
  campaignId: string,
  data: {
    drawName: string
    drawNumber: number
    drawDate: string
    drawTime?: string
    drawLocation?: string
    entryPeriodStart?: string
    entryPeriodEnd?: string
    publicationRequired?: boolean
    permitReference?: string
  }
) {
  const draw = await prisma.promotionDraw.create({
    data: {
      campaignId,
      drawName: data.drawName,
      drawNumber: data.drawNumber,
      drawDate: new Date(data.drawDate),
      drawTime: data.drawTime,
      drawLocation: data.drawLocation,
      entryPeriodStart: data.entryPeriodStart ? new Date(data.entryPeriodStart) : null,
      entryPeriodEnd: data.entryPeriodEnd ? new Date(data.entryPeriodEnd) : null,
      publicationRequired: data.publicationRequired ?? false,
      permitReference: data.permitReference,
    },
  })
  revalidatePath(`/dashboard/promotions/${campaignId}`)
  revalidatePath('/dashboard/draws')
  return draw
}
