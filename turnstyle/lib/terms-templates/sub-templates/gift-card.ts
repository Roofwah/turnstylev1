/**
 * Sub-template: Gift Card prizes
 */

export const PRIZE_TYPE = 'Gift Card'

export const GIFT_CARD_CLAUSES = [
  {
    slug: 'prizes-gift-card',
    label: 'Gift card prize conditions',
    text: `Where a prize includes a gift card or voucher:

The gift card is subject to the issuer's terms and conditions. The card must be used by [[GIFT_CARD_EXPIRY]]. Any unused balance may expire in accordance with the issuer's policy. The gift card cannot be exchanged for cash unless required by law. Lost or stolen cards may not be replaced.`,
    gaps: [
      { key: 'GIFT_CARD_EXPIRY', question: 'Gift card must be used by (date)?', placeholder: 'e.g. 31 December 2026' },
    ],
  },
]
