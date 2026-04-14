// ─────────────────────────────────────────────
// Turnstyle Preflight Review — Concept Cluster Definitions
//
// Each concept is defined by:
//   - strongKeywords:   phrases that confirm strong presence
//   - embeddedKeywords: phrases that suggest embedded presence
//   - gapChecks:        things to look for to confirm completeness
//   - required:         always required for a compliant promotion
//   - conditional:      only required under certain circumstances
//
// Concept detection intentionally casts a wide net — PresenceState
// is determined by how many tiers of evidence are found, not just
// whether any single keyword matches.
// ─────────────────────────────────────────────

export interface ConceptDefinition {
  conceptId: string
  label: string
  required: boolean
  conditional: boolean
  /** Heading patterns that strongly indicate this section exists */
  headingPatterns: RegExp[]
  /** Body text patterns confirming strong presence */
  strongPatterns: RegExp[]
  /** Looser patterns suggesting the concept is embedded in body text */
  embeddedPatterns: RegExp[]
  /** Checks that must pass for a strong/embedded concept to be 'complete' */
  completenessChecks: { id: string; label: string; pattern: RegExp }[]
  /** Displayed gap messages when completeness checks fail */
  gapMessages: Record<string, string>
}

export const CONCEPT_DEFINITIONS: ConceptDefinition[] = [

  // ── Promoter identity ──────────────────────────────────────────
  {
    conceptId: 'promoter',
    label: 'Promoter Identity',
    required: true,
    conditional: false,
    headingPatterns: [/^promoter$/i],
    strongPatterns: [
      /(?:pty\.?\s*ltd|pty\s+limited|pty\.?\s*ltd\.?)/i,
      /\bABN\b/i,
    ],
    embeddedPatterns: [
      /promoted\s+by/i,
      /the\s+promoter\s+is/i,
      /organis(?:ed|er)\s+by/i,
    ],
    completenessChecks: [
      { id: 'has_company_name', label: 'Company name present', pattern: /pty\.?\s*(?:ltd|limited)/i },
      { id: 'has_abn', label: 'ABN present', pattern: /\bABN\s*[\d\s]{9,}/i },
    ],
    gapMessages: {
      has_company_name: 'Promoter section does not appear to include a registered company name (Pty Ltd)',
      has_abn: 'ABN not found in promoter section',
    },
  },

  // ── Promotional period ──────────────────────────────────────────
  {
    conceptId: 'promotional_period',
    label: 'Promotional Period',
    required: true,
    conditional: false,
    headingPatterns: [/^promotion(?:al)?\s+period$/i, /^competition\s+period$/i],
    strongPatterns: [
      /(?:opens?|commences?|begins?|starts?)\s+(?:on\s+)?(?:\d{1,2}|\w+)\s+\w+\s+\d{4}/i,
      /(?:closes?|ends?|concludes?)\s+(?:on\s+)?(?:\d{1,2}|\w+)\s+\w+\s+\d{4}/i,
    ],
    embeddedPatterns: [
      /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /promotion\s+(?:open|period|runs?)/i,
    ],
    completenessChecks: [
      { id: 'has_start_date', label: 'Start date present', pattern: /(?:open|commence|begin|start|from)\s+(?:\w+\s+)?\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i },
      { id: 'has_end_date', label: 'End date present', pattern: /(?:clos|end|conclud|until|through)\s+(?:\w+\s+)?\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i },
    ],
    gapMessages: {
      has_start_date: 'Promotion start date not clearly stated',
      has_end_date: 'Promotion end/close date not clearly stated',
    },
  },

  // ── Eligibility ──────────────────────────────────────────────────
  {
    conceptId: 'eligibility',
    label: 'Eligibility',
    required: true,
    conditional: false,
    headingPatterns: [
      /^(who\s+can\s+enter|eligibilit)/i,
      /^participant\s+eligibility$/i,
      /^eligible\s+entrant/i,
    ],
    strongPatterns: [
      /australian\s+(?:permanent\s+)?resident/i,
      /aged?\s+\d{2}\s+(?:years?\s+)?(?:and\s+)?(?:over|or\s+older)/i,
      /(?:citizens?|residents?)\s+of\s+australia/i,
    ],
    embeddedPatterns: [
      /\b18\s*\+\b|\b18\s+or\s+over\b/i,
      /must\s+be\s+(?:at\s+least\s+)?\d+\s+years/i,
      /employees?\s+of\s+the\s+promoter\s+are\s+(?:not\s+)?eligible/i,
    ],
    completenessChecks: [
      { id: 'has_age', label: 'Age requirement stated', pattern: /\b(?:18|16)\s*(?:\+|years?\s+(?:or\s+)?(?:over|older|of\s+age))|aged?\s+\d{2}/i },
      { id: 'has_residency', label: 'Residency requirement stated', pattern: /australian\s+(?:permanent\s+)?resident|citizen\s+of\s+australia|reside\s+in\s+australia/i },
      { id: 'has_exclusions', label: 'Exclusions stated', pattern: /employee|immediate\s+family|ineligible/i },
    ],
    gapMessages: {
      has_age: 'Age requirement not clearly stated',
      has_residency: 'Residency requirement not clearly stated',
      has_exclusions: 'Employee/family exclusions not stated',
    },
  },

  // ── Entry mechanic ───────────────────────────────────────────────
  {
    conceptId: 'entry_mechanic',
    label: 'Entry Mechanic',
    required: true,
    conditional: false,
    headingPatterns: [
      /^how\s+to\s+enter$/i,
      /^entry\s+(?:method|mechanic|detail|period|type)$/i,
    ],
    strongPatterns: [
      /(?:to\s+enter|enter\s+by|how\s+to\s+enter)[:\s,]+(?:visit|purchase|scan|upload|submit|complete|register)/i,
      /(?:purchase|buy|spend)\s+(?:a\s+)?(?:qualifying|eligible|participating)/i,
      /(?:scan|upload|take\s+a\s+photo|photograph)/i,
    ],
    embeddedPatterns: [
      /entry\s+(?:form|portal|website|online)/i,
      /visit\s+(?:the\s+)?(?:website|store|promotional\s+website)/i,
      /submit\s+(?:a\s+|your\s+)?(?:receipt|proof\s+of\s+purchase|entry)/i,
    ],
    completenessChecks: [
      { id: 'has_mechanic_detail', label: 'Entry steps described', pattern: /(?:step\s+\d|to\s+enter|how\s+to\s+enter|entry\s+requires?)[:\s]+.{20,}/i },
      { id: 'has_entry_period', label: 'Entry period dates included', pattern: /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+\w+\s+\d{4}/i },
    ],
    gapMessages: {
      has_mechanic_detail: 'Entry steps not clearly described',
      has_entry_period: 'Entry period dates not stated in entry section',
    },
  },

  // ── Prize description ────────────────────────────────────────────
  {
    conceptId: 'prize_description',
    label: 'Prize Description',
    required: true,
    conditional: false,
    headingPatterns: [
      /^(prize|prizes|what\s+you\s+could\s+win|total\s+prize\s+pool)$/i,
      /^prize\s+(?:detail|description|structure|pool)$/i,
    ],
    strongPatterns: [
      /total\s+prize\s+(?:pool|value)\s*[:\s]+\$[\d,]+/i,
      /(?:valued?\s+at|to\s+the\s+value\s+of|up\s+to)\s+\$[\d,]+/i,
      /\$[\d,]+\s+(?:including|inc\.?\s+)?gst/i,
    ],
    embeddedPatterns: [
      /prize\s+(?:consists?|includes?|comprises?)/i,
      /winner\s+(?:will\s+)?receive/i,
      /\$[\d,]+/i,
    ],
    completenessChecks: [
      { id: 'has_prize_value', label: 'Prize value stated', pattern: /\$[\d,]+/i },
      { id: 'has_prize_description', label: 'Prize described', pattern: /prize\s+(?:consists?|includes?|comprises?|is\s+a|is\s+an)|winner\s+(?:will\s+)?receive/i },
      { id: 'has_total_pool', label: 'Total prize pool stated', pattern: /total\s+(?:prize\s+)?(?:pool|value)/i },
    ],
    gapMessages: {
      has_prize_value: 'No specific dollar value found for prizes',
      has_prize_description: 'Prize contents not clearly described',
      has_total_pool: 'Total prize pool not explicitly stated',
    },
  },

  // ── Draw mechanics ───────────────────────────────────────────────
  {
    conceptId: 'draw_mechanics',
    label: 'Draw Mechanics',
    required: true,
    conditional: false,
    headingPatterns: [
      /^draw\s+(?:method|mechanic|date|detail|schedule)$/i,
      /^(?:number\s+of\s+winners|winner\s+selection)$/i,
      /^how\s+.*\s+winner.*\s+selected/i,
    ],
    strongPatterns: [
      /drawn?\s+(?:at\s+random|randomly|by\s+computer)/i,
      /(?:draw|drawn?)\s+(?:on|at|by|will\s+(?:be\s+)?(?:held|conducted))/i,
      /computer\s+(?:generated\s+)?random\s+draw/i,
    ],
    embeddedPatterns: [
      /\bdraw\b|\bdrawn\b/i,
      /random(?:ly)?\s+selected/i,
      /judge(?:s|\'s)?\s+(?:decision|selection)/i,
      /winner\s+will\s+be\s+(?:selected|chosen|drawn)/i,
    ],
    completenessChecks: [
      { id: 'has_draw_date', label: 'Draw date stated', pattern: /draw\s+(?:will\s+(?:be\s+)?(?:held|conducted|take\s+place)\s+)?(?:on\s+)?\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i },
      { id: 'has_draw_method', label: 'Draw method described', pattern: /(?:random|computer|independently|supervising|judge)/i },
      { id: 'has_draw_location', label: 'Draw location stated', pattern: /drawn?\s+at\s+.{5,60}|draw\s+location/i },
    ],
    gapMessages: {
      has_draw_date: 'Draw date not stated',
      has_draw_method: 'Draw method not described',
      has_draw_location: 'Draw location not stated',
    },
  },

  // ── Winner notification ──────────────────────────────────────────
  {
    conceptId: 'winner_notification',
    label: 'Winner Notification',
    required: true,
    conditional: false,
    headingPatterns: [
      /^winner\s+notification$/i,
      /^(how\s+will\s+the\s+winner|contacting\s+the\s+winner)$/i,
    ],
    strongPatterns: [
      /winner\s+(?:will\s+be|shall\s+be)\s+(?:notified|contacted|advised)\s+(?:via|by|through)/i,
      /(?:notif|contact|advis)(?:y|ied|ed)\s+(?:the\s+)?winner\s+(?:via|by|within)/i,
    ],
    embeddedPatterns: [
      /\b(?:email|phone|mail|sms)\b/i,
      /within\s+\d+\s+(?:business\s+)?days?\s+(?:of|after)\s+the\s+draw/i,
      /winner\s+(?:contacted|notified|advised)/i,
    ],
    completenessChecks: [
      { id: 'has_notification_method', label: 'Notification method stated', pattern: /(?:via|by|through)\s+(?:email|phone|mail|sms|letter)/i },
      { id: 'has_notification_timeframe', label: 'Notification timeframe stated', pattern: /within\s+\d+\s+(?:business\s+)?days?/i },
    ],
    gapMessages: {
      has_notification_method: 'Winner notification method not stated',
      has_notification_timeframe: 'Timeframe for winner notification not stated',
    },
  },

  // ── Unclaimed prizes ─────────────────────────────────────────────
  {
    conceptId: 'unclaimed_prizes',
    label: 'Unclaimed Prizes',
    required: true,
    conditional: false,
    headingPatterns: [
      /^unclaimed\s+prize/i,
      /^(?:unclaimed|outstanding)\s+(?:prize|award)/i,
    ],
    strongPatterns: [
      /unclaimed\s+prize\s+(?:will\s+be|shall\s+be)\s+(?:redrawn|forfeited|subject)/i,
      /if\s+(?:a\s+)?winner\s+(?:cannot\s+be\s+contacted|fails\s+to\s+claim|does\s+not\s+claim)/i,
    ],
    embeddedPatterns: [
      /unclaimed/i,
      /(?:redrawn?|re-drawn?|redraw)/i,
      /claim\s+(?:by|before|within|deadline)/i,
      /forfeited?/i,
    ],
    completenessChecks: [
      { id: 'has_claim_period', label: 'Claim period stated', pattern: /claim(?:ed)?\s+(?:within|by|before)\s+\d+\s+(?:days?|weeks?|months?)/i },
      { id: 'has_redraw_process', label: 'Redraw or forfeiture process stated', pattern: /(?:redrawn?|forfeited?|unclaimed\s+draw)/i },
    ],
    gapMessages: {
      has_claim_period: 'Period within which prizes must be claimed not stated',
      has_redraw_process: 'What happens to unclaimed prizes not described',
    },
  },

  // ── Privacy ──────────────────────────────────────────────────────
  {
    conceptId: 'privacy',
    label: 'Privacy & Personal Information',
    required: true,
    conditional: false,
    headingPatterns: [
      /^(privacy|personal\s+information|privacy\s+policy|privacy\s+notice)$/i,
    ],
    strongPatterns: [
      /personal\s+information\s+(?:collected|used|handled|disclosed)\s+(?:in\s+accordance|pursuant)\s+(?:with|to)/i,
      /privacy\s+(?:act\s+1988|policy|notice)\s+(?:at\s+|available\s+at\s+)?(?:https?:\/\/)?/i,
    ],
    embeddedPatterns: [
      /privacy\s+policy/i,
      /personal\s+information/i,
      /(?:collect|use|disclos)\s+(?:your\s+)?(?:personal\s+)?information/i,
      /https?:\/\/[^\s]+privacy/i,
    ],
    completenessChecks: [
      { id: 'has_privacy_policy_ref', label: 'Privacy policy URL or reference present', pattern: /privacy\s+policy(?:\s+(?:at|available))?|https?:\/\/[^\s]+privacy/i },
      { id: 'has_collection_purpose', label: 'Purpose of data collection stated', pattern: /(?:collect|use)\s+(?:personal\s+)?information\s+(?:for|to)/i },
    ],
    gapMessages: {
      has_privacy_policy_ref: 'No reference to privacy policy found',
      has_collection_purpose: 'Purpose of personal information collection not stated',
    },
  },

  // ── Permits ──────────────────────────────────────────────────────
  {
    conceptId: 'permits',
    label: 'Permit Numbers',
    required: false,
    conditional: true,
    headingPatterns: [
      /^permit\s+numbers?$/i,
      /^(?:permit|authoris|licen[cs]e)/i,
    ],
    strongPatterns: [
      /TP\s*\d{2}\/\d+/i,   // NSW
      /T\s*\d{2}\/\d+/i,    // SA
    ],
    embeddedPatterns: [
      /permit\s+(?:number|no\.?)\s*[:\s]+/i,
      /NSW\s+permit|SA\s+permit|ACT\s+permit/i,
      /authoris(?:ation|ed)\s+under/i,
    ],
    completenessChecks: [
      { id: 'no_placeholders', label: 'No placeholder permit numbers', pattern: /TP\s*\d{2}\/\d{4,}(?!\s*X)(?!\s*#)/i },
    ],
    gapMessages: {
      no_placeholders: 'Permit numbers appear to still be placeholders (XXXX / ####)',
    },
  },

  // ── Travel prize conditions ──────────────────────────────────────
  {
    conceptId: 'travel_conditions',
    label: 'Travel Prize Conditions',
    required: false,
    conditional: true,
    headingPatterns: [
      /^travel\s+prize\s+conditions?$/i,
      /^travel\s+(?:detail|condition|term)$/i,
    ],
    strongPatterns: [
      /travel\s+(?:is\s+)?subject\s+to\s+availability/i,
      /travel\s+(?:must\s+be\s+)?taken\s+(?:in\s+one\s+(?:trip|journey)|by\s+\d{1,2})/i,
      /airfare(?:s)?\s+(?:is|are)\s+(?:economy|return|included)/i,
    ],
    embeddedPatterns: [
      /flight\s+conditions?/i,
      /travel\s+(?:conditions?|terms?|inclus)/i,
      /accommodation\s+(?:is|includes?)/i,
      /subject\s+to\s+availability/i,
    ],
    completenessChecks: [
      { id: 'has_travel_class', label: 'Travel class specified', pattern: /\b(?:economy|business|first)\s+class\b/i },
      { id: 'has_travel_expiry', label: 'Travel expiry or travel-by date stated', pattern: /travel(?:\s+must\s+be)?\s+(?:taken|completed|booked)\s+(?:by|before|within)/i },
    ],
    gapMessages: {
      has_travel_class: 'Travel class (economy/business) not specified',
      has_travel_expiry: 'Travel expiry / must-be-completed-by date not stated',
    },
  },

  // ── Event prize conditions ────────────────────────────────────────
  {
    conceptId: 'event_conditions',
    label: 'Event Prize Conditions',
    required: false,
    conditional: true,
    headingPatterns: [
      /^event\s+prize\s+conditions?$/i,
      /^event\s+(?:detail|condition|term)$/i,
    ],
    strongPatterns: [
      /ticket(?:s)?\s+(?:are\s+)?subject\s+to\s+availability/i,
      /event\s+(?:is\s+)?subject\s+to\s+(?:cancellation|postponement|change)/i,
    ],
    embeddedPatterns: [
      /ticket\s+conditions?/i,
      /event\s+conditions?/i,
      /subject\s+to\s+(?:the\s+)?(?:event|venue)\s+terms/i,
    ],
    completenessChecks: [
      { id: 'has_cancellation_clause', label: 'Cancellation/postponement clause present', pattern: /(?:cancel|postpone|reschedul)/i },
    ],
    gapMessages: {
      has_cancellation_clause: 'Event cancellation or postponement clause not found',
    },
  },

  // ── Liability ────────────────────────────────────────────────────
  {
    conceptId: 'liability',
    label: 'Liability Limitation',
    required: false,
    conditional: false,
    headingPatterns: [
      /^(liability|limitation\s+of\s+liability|exclusion\s+of\s+liability)$/i,
      /^(indemnit|responsibilit)/i,
    ],
    strongPatterns: [
      /(?:promoter|company)\s+(?:will\s+not|shall\s+not|is\s+not|accepts?\s+no)\s+(?:be\s+)?(?:liable|responsible)/i,
      /to\s+the\s+(?:maximum|fullest)\s+extent\s+permitted\s+by\s+(?:law|applicable\s+law)/i,
    ],
    embeddedPatterns: [
      /not\s+(?:liable|responsible)\s+for/i,
      /disclaimer/i,
      /limitation\s+of\s+liability/i,
      /exclude(?:s)?\s+(?:all\s+)?(?:warranties?|liability)/i,
    ],
    completenessChecks: [],
    gapMessages: {},
  },
]

/** Returns concept definitions for the concepts that are conditionally required */
export function getApplicableConcepts(opts: {
  hasTravelPrize: boolean
  hasEventPrize: boolean
  isChance: boolean
  hasPermitObligations: boolean
}): ConceptDefinition[] {
  return CONCEPT_DEFINITIONS.filter((c) => {
    if (!c.conditional) return true
    if (c.conceptId === 'travel_conditions') return opts.hasTravelPrize
    if (c.conceptId === 'event_conditions') return opts.hasEventPrize
    if (c.conceptId === 'permits') return opts.hasPermitObligations
    return false
  })
}
