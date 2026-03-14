/**
 * Sub-template: Cash prizes
 */

export const PRIZE_TYPE = 'Cash'

export const CASH_CLAUSES = [
  {
    slug: 'prizes-cash',
    label: 'Cash prize conditions',
    text: `Where a prize is paid in cash:

Cash prizes will be paid by [[CASH_PAYMENT_METHOD]] within [[CASH_PAYMENT_DAYS]] of the draw or claim. The winner must provide valid bank account details or other required information to receive payment. Any applicable tax on the prize is the responsibility of the winner.`,
    gaps: [
      { key: 'CASH_PAYMENT_METHOD', question: 'How will cash prizes be paid?', placeholder: 'e.g. EFT, cheque' },
      { key: 'CASH_PAYMENT_DAYS', question: 'Within how many days will cash be paid?', placeholder: 'e.g. 28' },
    ],
  },
]
