/**
 * Turnstyle Terms Template Registry
 * ─────────────────────────────────
 * Single source of truth for all terms templates.
 *
 * TO ADD A NEW TEMPLATE:
 * 1. Create the template file in /lib/terms-templates/
 * 2. Import it below
 * 3. Add an entry to TEMPLATE_REGISTRY
 * 4. Add promoter aliases to PROMOTER_ALIASES if needed
 */

import { REPCO_TRADE, TEMPLATE_META as REPCO_TRADE_META } from './repco-trade'
import { REPCO_RETAIL, TEMPLATE_META as REPCO_RETAIL_META } from './repco-retail'
import { NAPA_TRADE, TEMPLATE_META as NAPA_META } from './napa-trade'

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
  promoterKeyword: string   // canonical promoter key e.g. 'repco', 'napa'
  audience: 'b2b' | 'b2c' | 'both'
  mechanic?: 'sweepstakes' | 'instant_win' | 'limited_offer' | 'all'
  description?: string
  isActive?: boolean
}

export interface TemplateEntry {
  meta: TemplateMeta
  clauses: TemplateClause[]
}

// ─── Promoter Aliases ────────────────────────────────────────────────────────
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

// ─── Template Registry ───────────────────────────────────────────────────────
// Add new templates here. Set isActive: false to hide from wizard without deleting.

export const TEMPLATE_REGISTRY: TemplateEntry[] = [
  {
    meta: { ...REPCO_TRADE_META, mechanic: 'sweepstakes', description: 'Repco Trade — account purchase sweepstakes', isActive: true },
    clauses: REPCO_TRADE as TemplateClause[],
  },
  {
    meta: { ...REPCO_RETAIL_META, mechanic: 'sweepstakes', description: 'Repco Retail — loyalty card sweepstakes', isActive: true },
    clauses: REPCO_RETAIL as TemplateClause[],
  },
  {
    meta: { ...NAPA_META, mechanic: 'sweepstakes', description: 'NAPA Trade — account purchase sweepstakes', isActive: true },
    clauses: NAPA_TRADE as TemplateClause[],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a promoter name to its canonical keyword.
 * e.g. "GPC Repco" → "repco", "NAPA Australia" → "napa"
 * Returns null if no alias match found.
 */
export function resolvePromoterKeyword(promoterName: string): string | null {
  if (!promoterName) return null
  const normalised = promoterName.toLowerCase().trim()

  // Exact match first
  if (PROMOTER_ALIASES[normalised]) return PROMOTER_ALIASES[normalised]

  // Partial match — check if any alias is contained in the promoter name
  for (const [alias, keyword] of Object.entries(PROMOTER_ALIASES)) {
    if (normalised.includes(alias) || alias.includes(normalised)) {
      return keyword
    }
  }

  return null
}

/**
 * Get templates available for a given campaign.
 * Filters by promoter keyword and mechanic type.
 * Falls back to all sweepstakes templates if no promoter match found.
 */
export function getTemplatesForCampaign(
  promoterName: string,
  mechanicType?: string
): TemplateEntry[] {
  const active = TEMPLATE_REGISTRY.filter(t => t.meta.isActive !== false)

  const keyword = resolvePromoterKeyword(promoterName)

  // Filter by mechanic (sweepstakes only for now)
  const byMechanic = active.filter(t =>
    !t.meta.mechanic || t.meta.mechanic === 'all' || t.meta.mechanic === 'sweepstakes'
  )

  // Filter by promoter keyword if we found a match
  if (keyword) {
    const byPromoter = byMechanic.filter(t => t.meta.promoterKeyword === keyword)
    if (byPromoter.length > 0) return byPromoter
  }

  // Fallback — return all active sweepstakes templates
  return byMechanic
}

/**
 * Get a single template by ID.
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
