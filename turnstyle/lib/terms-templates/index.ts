/**
 * Turnstyle Terms Template Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all terms templates.
 *
 * ARCHITECTURE — Option C (Hybrid):
 *   1. DB PromoterTemplate records act as a routing table, mapping a promoter
 *      + mechanic combination to a specific templateFileId.
 *   2. If no DB record exists, the scoring engine finds the best file-based match.
 *   3. A generic fallback is always available as a last resort.
 *
 * TO ADD A NEW TEMPLATE:
 *   1. Create the template file in /lib/terms-templates/
 *   2. Import it below
 *   3. Add an entry to TEMPLATE_REGISTRY
 *   4. Add promoter aliases to PROMOTER_ALIASES if needed
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { REPCO_TRADE,   TEMPLATE_META as REPCO_TRADE_META   } from './repco-trade'
import { REPCO_RETAIL,  TEMPLATE_META as REPCO_RETAIL_META  } from './repco-retail'
import { NAPA_TRADE,    TEMPLATE_META as NAPA_META           } from './napa-trade'
import { GENERIC_SWEEPSTAKES, TEMPLATE_META as GENERIC_META } from './generic-sweepstakes'
import { getSubTemplateClausesForPrizeTypes } from './sub-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateClause {
  slug: string
  label: string
  text: string
  gaps?: any[]
}

export interface TemplateMeta {
  id: string
  name: string
  promoterKeyword: string | null   // null = generic (matches any promoter)
  audience: 'b2b' | 'b2c' | 'both'
  mechanic?: 'sweepstakes' | 'instant_win' | 'limited_offer' | 'all'
  drawFrequency?: string           // e.g. 'at_conclusion', 'weekly', 'daily'
  entryMechanic?: string           // e.g. 'online_form', 'trade_account', 'purchase'
  description?: string
  isActive?: boolean
}

export interface TemplateEntry {
  meta: TemplateMeta
  clauses: TemplateClause[]
}

// ─── Campaign shape expected by resolver ─────────────────────────────────────

export interface CampaignForTemplateMatch {
  promoterName: string
  mechanicType?: string            // e.g. 'SWEEPSTAKES', 'INSTANT_WIN'
  drawFrequency?: string           // e.g. 'AT_CONCLUSION', 'WEEKLY'
  entryMechanic?: string           // e.g. 'Online entry form', 'Trade account purchase'
  audience?: 'b2b' | 'b2c'        // optional override — inferred if not provided
}

// ─── Promoter Aliases ─────────────────────────────────────────────────────────
// Maps any variation of a promoter name to a canonical keyword.
// Add new aliases here as new promoters are onboarded.

const PROMOTER_ALIASES: Record<string, string> = {
  // Repco
  'repco':              'repco',
  'repco australia':    'repco',
  'gpc repco':          'repco',
  'repco auto':         'repco',
  'gpc asia pacific':   'repco',
  'gpc':                'repco',

  // NAPA
  'napa':               'napa',
  'napa auto parts':    'napa',
  'napa australia':     'napa',

  // Add new promoters below:
  // 'promoter name':   'canonical_key',
}

// ─── Audience inference ───────────────────────────────────────────────────────
// Infers b2b vs b2c from entry mechanic string if not explicitly set on campaign.

const B2B_ENTRY_SIGNALS = [
  'trade account',
  'account purchase',
  'trade purchase',
  'business account',
  'wholesale',
  'reseller',
  'dealer',
]

export function inferAudience(entryMechanic?: string): 'b2b' | 'b2c' {
  if (!entryMechanic) return 'b2c'
  const lower = entryMechanic.toLowerCase()
  return B2B_ENTRY_SIGNALS.some(s => lower.includes(s)) ? 'b2b' : 'b2c'
}

// ─── Template Registry ────────────────────────────────────────────────────────
// Set isActive: false to disable a template without deleting it.

export const TEMPLATE_REGISTRY: TemplateEntry[] = [
  {
    meta: {
      ...REPCO_TRADE_META,
      mechanic:      'sweepstakes',
      drawFrequency: 'at_conclusion',
      entryMechanic: 'trade_account',
      description:   'Repco Trade — account purchase sweepstakes',
      isActive:      true,
    } as TemplateMeta,
    clauses: REPCO_TRADE as TemplateClause[],
  },
  {
    meta: {
      ...REPCO_RETAIL_META,
      mechanic:      'sweepstakes',
      drawFrequency: 'at_conclusion',
      entryMechanic: 'online_form',
      description:   'Repco Retail — loyalty card sweepstakes',
      isActive:      true,
    } as TemplateMeta,
    clauses: REPCO_RETAIL as TemplateClause[],
  },
  {
    meta: {
      ...NAPA_META,
      mechanic:      'sweepstakes',
      drawFrequency: 'at_conclusion',
      entryMechanic: 'trade_account',
      description:   'NAPA Trade — account purchase sweepstakes',
      isActive:      true,
    } as TemplateMeta,
    clauses: NAPA_TRADE as TemplateClause[],
  },
  {
    meta: {
      ...GENERIC_META,
      isActive: true,
    } as TemplateMeta,
    clauses: GENERIC_SWEEPSTAKES as TemplateClause[],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a promoter name to its canonical keyword.
 * e.g. "GPC Repco" → "repco", "NAPA Australia" → "napa"
 * Returns null if no alias match found.
 */
export function resolvePromoterKeyword(promoterName: string): string | null {
  if (!promoterName) return null
  const normalised = promoterName.toLowerCase().trim()
  if (PROMOTER_ALIASES[normalised]) return PROMOTER_ALIASES[normalised]
  for (const [alias, keyword] of Object.entries(PROMOTER_ALIASES)) {
    if (normalised.includes(alias) || alias.includes(normalised)) return keyword
  }
  return null
}

/**
 * Get a single template by its file ID.
 */
export function getTemplateById(id: string): TemplateEntry | null {
  return TEMPLATE_REGISTRY.find(t => t.meta.id === id) ?? null
}

/**
 * Get all active templates (for admin/dev use).
 */
export function getAllTemplates(): TemplateEntry[] {
  return TEMPLATE_REGISTRY.filter(t => t.meta.isActive !== false)
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────
/**
 * Scores each active template against the campaign attributes.
 *
 * Scoring weights:
 *   +4  promoter keyword exact match
 *   +2  mechanic match
 *   +1  audience match
 *   +1  drawFrequency match
 *   +1  entryMechanic match (partial string)
 *
 * Templates with promoterKeyword: null (generics) are eligible but score 0
 * on promoter dimension — they only win if no promoter-specific match exists.
 *
 * Returns templates sorted by score descending.
 */
function scoreTemplates(campaign: CampaignForTemplateMatch): Array<{ entry: TemplateEntry; score: number }> {
  const active = TEMPLATE_REGISTRY.filter(t => t.meta.isActive !== false)

  const keyword     = resolvePromoterKeyword(campaign.promoterName)
  const mechanic    = (campaign.mechanicType ?? '').toLowerCase()
  const drawFreq    = (campaign.drawFrequency ?? '').toLowerCase()
  const entryMech   = (campaign.entryMechanic ?? '').toLowerCase()
  const audience    = campaign.audience ?? inferAudience(campaign.entryMechanic)

  return active
    .map(entry => {
      const m = entry.meta
      let score = 0

      // Promoter match (+4)
      if (m.promoterKeyword && keyword && m.promoterKeyword === keyword) score += 4

      // Mechanic match (+2)
      if (m.mechanic && m.mechanic !== 'all') {
        if (mechanic && mechanic.includes(m.mechanic)) score += 2
      } else if (m.mechanic === 'all') {
        score += 1 // partial credit for universal mechanic
      }

      // Audience match (+1)
      if (m.audience === 'both' || m.audience === audience) score += 1

      // Draw frequency match (+1)
      if (m.drawFrequency && drawFreq) {
        const normFreq = drawFreq.replace('at_conclusion', 'at_conclusion')
        if (normFreq.includes(m.drawFrequency) || m.drawFrequency.includes(normFreq)) score += 1
      }

      // Entry mechanic partial match (+1)
      if (m.entryMechanic && entryMech) {
        if (entryMech.includes(m.entryMechanic) || m.entryMechanic.includes(entryMech)) score += 1
      }

      return { entry, score }
    })
    .sort((a, b) => b.score - a.score)
}

// ─── Primary Resolver ─────────────────────────────────────────────────────────
/**
 * Main entry point for template selection.
 *
 * Resolution order:
 *   1. DB routing record — if a PromoterTemplate record exists with a valid
 *      templateFileId, use that template directly (admin-configured override).
 *   2. Scoring engine — find best file-based match by score.
 *   3. Fallback chain — progressively relaxed matching.
 *   4. Generic sweepstakes — always available as last resort.
 *
 * @param campaign     Campaign attributes for matching
 * @param dbTemplateFileId  Optional templateFileId from DB PromoterTemplate record
 */
export function resolveTemplate(
  campaign: CampaignForTemplateMatch,
  dbTemplateFileId?: string | null
): { template: TemplateEntry; source: 'db' | 'scored' | 'fallback' | 'generic' } {

  // 1. DB routing override
  if (dbTemplateFileId) {
    const dbTemplate = getTemplateById(dbTemplateFileId)
    if (dbTemplate) return { template: dbTemplate, source: 'db' }
  }

  // 2. Scoring engine
  const scored = scoreTemplates(campaign)
  const best = scored[0]

  // A score of 4+ means at least a promoter match — use it
  if (best && best.score >= 4) {
    return { template: best.entry, source: 'scored' }
  }

  // 3. Fallback chain — progressively relaxed
  const keyword  = resolvePromoterKeyword(campaign.promoterName)
  const mechanic = (campaign.mechanicType ?? '').toLowerCase()
  const audience = campaign.audience ?? inferAudience(campaign.entryMechanic)
  const active   = TEMPLATE_REGISTRY.filter(t => t.meta.isActive !== false)

  // 3a. Mechanic + audience match (no promoter required)
  const byMechanicAudience = active.filter(t =>
    t.meta.promoterKeyword === null &&
    (!t.meta.mechanic || t.meta.mechanic === 'all' || mechanic.includes(t.meta.mechanic ?? '')) &&
    (t.meta.audience === 'both' || t.meta.audience === audience)
  )
  if (byMechanicAudience.length > 0) {
    return { template: byMechanicAudience[0], source: 'fallback' }
  }

  // 3b. Mechanic only (any audience)
  const byMechanic = active.filter(t =>
    t.meta.promoterKeyword === null &&
    (!t.meta.mechanic || t.meta.mechanic === 'all' || mechanic.includes(t.meta.mechanic ?? ''))
  )
  if (byMechanic.length > 0) {
    return { template: byMechanic[0], source: 'fallback' }
  }

  // 4. Generic sweepstakes — last resort
  const generic = getTemplateById('generic-sweepstakes')
  if (generic) return { template: generic, source: 'generic' }

  // Should never reach here — registry always has generic
  throw new Error('No template found and no generic fallback available. Check TEMPLATE_REGISTRY.')
}

/**
 * Merges prize-type sub-templates into the base clauses.
 * Sub-template clauses are inserted after the clause with slug insertAfterSlug
 * (default 'prizes'). Only sub-templates for the given prize types are included.
 */
export function mergeSubTemplatesIntoClauses(
  baseClauses: TemplateClause[],
  prizeTypes: string[],
  options: { insertAfterSlug?: string } = {}
): TemplateClause[] {
  const insertAfterSlug = options.insertAfterSlug ?? 'prizes'
  const subClauses = getSubTemplateClausesForPrizeTypes(prizeTypes)
  if (subClauses.length === 0) return baseClauses
  const idx = baseClauses.findIndex(c => c.slug === insertAfterSlug)
  if (idx === -1) return [...baseClauses, ...subClauses]
  return [
    ...baseClauses.slice(0, idx + 1),
    ...subClauses,
    ...baseClauses.slice(idx + 1),
  ]
}

/**
 * Legacy helper — returns templates for a campaign (used by terms wizard UI).
 * Now delegates to scoring engine. Returns all templates with score > 0,
 * or generic if nothing scores.
 */
export function getTemplatesForCampaign(
  promoterName: string,
  mechanicType?: string,
  entryMechanic?: string,
  drawFrequency?: string
): TemplateEntry[] {
  const scored = scoreTemplates({ promoterName, mechanicType, entryMechanic, drawFrequency })
  const matches = scored.filter(s => s.score > 0).map(s => s.entry)
  if (matches.length > 0) return matches

  // Fall back to generic
  const generic = getTemplateById('generic-sweepstakes')
  return generic ? [generic] : []
}
