/**
 * Campaign Intake — structured extraction schema.
 * Draft only; never written directly to campaign records.
 */

export type PermitFlag =
  | 'ACT_REVIEW'
  | 'SA_REVIEW'
  | 'NSW_REVIEW'
  | 'NONE_REQUIRED'

export type PrizeType = 'major' | 'minor'

export interface ExtractedPrize {
  type: PrizeType
  description: string
  quantity: number | null
  unit_value: number | null
  total_value: number | null
}

export interface ExtractedRegion {
  region_name: string
  country?: string | null
  states?: string[] | null
  start_date: string | null
  end_date: string | null
  entry_mechanic: string | null
  entry_threshold: number | null
  purchase_requirement: string | null
  loyalty_required: boolean | null
  participating_brands: string[]
  subsequent_entries_allowed: boolean | null
  prizes: ExtractedPrize[]
  minor_prizes: ExtractedPrize[]
  major_prizes: ExtractedPrize[]
  draw_type: string | null
  draw_frequency: string | null
  draw_date: string | null
  winner_publication_date: string | null
  total_prize_value: number | null
  permit_flags: PermitFlag[]
}

export interface ExtractedCampaignIntake {
  raw_input: string
  campaign_name: string | null
  promoter_name: string | null
  brand: string | null
  retailer: string | null
  regions: ExtractedRegion[]
  notes: string | null
  assumptions: string[]
  missing_fields: string[]
  confidence_scores: Record<string, number>
  generated_summary: string
}

export interface CampaignBuilderPrefill {
  promoterName: string
  campaignName: string
  promoStart: string
  promoEnd: string
  drawMechanic: string
  drawFrequency: string
  entryMechanic: string
  regions: string[]
  prizes: { tier: string; description: string; qty: number; unitValue: number }[]
  notes: string
  mechanicDetails?: {
    purchaseValue: string
    gstType: 'excl' | 'incl'
    participatingBrand: string
    website: string
    additionalEntryValue: string
    additionalEntryGst: 'excl' | 'incl'
  }
  selectedRegion?: string
  intakeSnapshot?: ExtractedCampaignIntake
}

export const INTAKE_STORAGE_KEY = 'turnstyle_campaign_intake_prefill'
