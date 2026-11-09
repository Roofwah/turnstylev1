import type { ExtractedCampaignIntake } from './types'

export type PacketSource = 'partner' | 'demo' | 'email' | 'paste'

export type PacketSubmitInput = {
  concept: string
  submitterName: string
  submitterEmail: string
  submitterCompany: string
  partnerId: string
  partnerDisplayName?: string
  source: PacketSource
  externalRef?: string | null
  idempotencyKey?: string | null
}

export type PacketDisplayField = {
  label: string
  value: string
  /** true = supplied/confirmed from concept; false = AI assumption / unknown */
  confirmed: boolean
}

export type PacketPresentation = {
  packetRef: string
  campaignName: string
  promotionType: string
  likelyMechanic: string
  summary: string
  fields: PacketDisplayField[]
  assumptions: string[]
  unresolved: string[]
  originalConcept: string
  submitterName: string
  submitterEmail: string
  submitterCompany: string
  partnerId: string
  source: PacketSource
  createdAt: string
}

export type ProcessPacketResult = {
  packetRef: string
  reviewToken: string
  intake: ExtractedCampaignIntake
  presentation: PacketPresentation
  interpretationSource: 'ai' | 'mock'
  idempotentReplay: boolean
  emails: {
    submitterSent: boolean
    flowSent: boolean
    submitterError?: string
    flowError?: string
  }
}
