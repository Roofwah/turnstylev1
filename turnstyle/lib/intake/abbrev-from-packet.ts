/**
 * Adapter: Campaign Packet / Intake extraction → existing abbreviated T&Cs generator.
 * Does not create a Campaign record.
 */

import {
  tryGenerateAbbreviatedTerms,
  type AbbrevCampaignInput,
  type AbbrevGenerateResult,
} from '@/lib/abbrev-terms/generate'
import type { ExtractedCampaignIntake } from './types'
import { extractFromNaturalLanguage } from './nl-extract'

function mapDrawMechanic(concept: string, drawType: string | null): string {
  const lower = concept.toLowerCase()
  if (/limited\s+offer|gift\s+with\s+purchase|\bgwp\b/i.test(lower)) return 'Limited Offer'
  if (drawType === 'limited_offer') return 'Limited Offer'
  return 'Sweepstakes'
}

function mapDrawFrequency(freq: string | null, concept: string): string {
  if (/instant/i.test(concept) || freq === 'instant_win') return 'instant_win'
  if (
    /one\s+major\s+(?:prize\s+)?draw|at\s+the\s+(?:end|conclusion)|single_draw/i.test(concept) ||
    freq === 'single_draw_at_conclusion' ||
    freq === 'single_draw'
  ) {
    return 'at_conclusion'
  }
  if (freq) return freq.toLowerCase()
  return 'at_conclusion'
}

function mapRegions(intake: ExtractedCampaignIntake, nlGeo: string | null): string[] {
  const region = intake.regions[0]
  if (region?.states?.length) return region.states
  if (region?.region_name === 'AU' || region?.country === 'Australia' || nlGeo === 'AU') {
    return ['national_au']
  }
  if (region?.region_name === 'NZ' || region?.country === 'New Zealand' || nlGeo === 'NZ') {
    return ['NZ']
  }
  if (region?.region_name) return [region.region_name]
  return []
}

export function buildAbbrevInputFromPacket(params: {
  intake: ExtractedCampaignIntake
  concept: string
}): AbbrevCampaignInput {
  const { intake, concept } = params
  const nl = extractFromNaturalLanguage(concept)
  const region = intake.regions[0]
  const prize =
    region?.prizes?.[0] ?? region?.major_prizes?.[0] ?? nl.prizes[0] ?? null

  const prizes = prize?.description
    ? [
        {
          description: prize.description,
          qty: prize.quantity ?? 1,
          unitValue: prize.unit_value ?? null,
        },
      ]
    : []

  return {
    promoStart: region?.start_date ?? nl.startDate,
    promoEnd: region?.end_date ?? nl.endDate,
    drawMechanic: mapDrawMechanic(concept, region?.draw_type ?? nl.drawType),
    drawFrequency: mapDrawFrequency(region?.draw_frequency ?? nl.drawFrequency, concept),
    entryMechanic: region?.entry_mechanic ?? nl.entryMechanic,
    regions: mapRegions(intake, nl.geography),
    prizes,
    promoterName: intake.promoter_name,
  }
}

export function generateAbbrevTermsForPacket(params: {
  intake: ExtractedCampaignIntake
  concept: string
}): AbbrevGenerateResult {
  return tryGenerateAbbreviatedTerms(buildAbbrevInputFromPacket(params))
}
