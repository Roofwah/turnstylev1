/**
 * Sub-templates — templates called by another template from the wizard.
 * The main template asks the user (e.g. "Include travel conditions?" Yes/No).
 * When they select Yes, this registry's matching sub-template is included:
 * its clauses (and their gaps) are inserted after the main template's 'prizes' clause.
 *
 * TO ADD A NEW SUB-TEMPLATE:
 *   1. Create a file (e.g. cash.ts) exporting SUB_TEMPLATE_ID and CLAUSES.
 *   2. Add to SUB_TEMPLATE_REGISTRY. The id is what the wizard passes when user selects it.
 */

import { PRIZE_TYPE as MOTOR_VEHICLE_TYPE, MOTOR_VEHICLE_CLAUSES } from './motor-vehicle'
import { PRIZE_TYPE as RECREATIONAL_VEHICLE_TYPE, RECREATIONAL_VEHICLE_CLAUSES } from './recreational-vehicle'
import { PRIZE_TYPE as TRAVEL_TYPE, TRAVEL_CLAUSES } from './travel'
import { PRIZE_TYPE as CASH_TYPE, CASH_CLAUSES } from './cash'
import { PRIZE_TYPE as GIFT_CARD_TYPE, GIFT_CARD_CLAUSES } from './gift-card'
import { PRIZE_TYPE as OTHER_TYPE, OTHER_CLAUSES } from './other'

export interface SubTemplateEntry {
  /** Prize type value that triggers this sub-template (e.g. "Motor vehicle") */
  prizeType: string
  /** Clauses to insert when this prize type is present */
  clauses: Array<{ slug: string; label: string; text: string; gaps?: any[] }>
}

/** Order here defines insertion order when multiple sub-templates apply */
export const SUB_TEMPLATE_REGISTRY: SubTemplateEntry[] = [
  { prizeType: MOTOR_VEHICLE_TYPE, clauses: MOTOR_VEHICLE_CLAUSES },
  { prizeType: RECREATIONAL_VEHICLE_TYPE, clauses: RECREATIONAL_VEHICLE_CLAUSES },
  { prizeType: TRAVEL_TYPE, clauses: TRAVEL_CLAUSES },
  { prizeType: CASH_TYPE, clauses: CASH_CLAUSES },
  { prizeType: GIFT_CARD_TYPE, clauses: GIFT_CARD_CLAUSES },
  { prizeType: OTHER_TYPE, clauses: OTHER_CLAUSES },
]

/**
 * Returns clauses from all sub-templates whose prizeType is in the given list.
 * Only one set of clauses per prize type is included; insertion order follows
 * SUB_TEMPLATE_REGISTRY.
 */
export function getSubTemplateClausesForPrizeTypes(prizeTypes: string[]): Array<{ slug: string; label: string; text: string; gaps?: any[] }> {
  if (!prizeTypes.length) return []
  const normalised = new Set(prizeTypes.map(t => t.trim().toLowerCase()).filter(Boolean))
  const out: Array<{ slug: string; label: string; text: string; gaps?: any[] }> = []
  for (const entry of SUB_TEMPLATE_REGISTRY) {
    if (normalised.has(entry.prizeType.trim().toLowerCase())) {
      out.push(...entry.clauses)
    }
  }
  return out
}
