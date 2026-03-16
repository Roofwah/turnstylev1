/**
 * Repco Retail — base clauses only.
 * Sub-templates (Travel, Motor vehicle) are included when the user selects them in the wizard
 * via the "Additional condition sets" clause below. They are merged after the 'prizes' clause.
 */
export const REPCO_RETAIL = [
  {
    slug: 'promoter',
    label: 'Promoter',
    text: `Repco Australia (A division of GPC Asia Pacific Pty Ltd (ABN 97 097 993 283) of 22 Enterprise Drive Rowville 3178 `,
  },
  {
    slug: 'promotion_period',
    label: 'Promotional Period',
    text: `The Promotion commences at 12:00am (AEST) on {{PROMO_START}} and closes at 11:59pm (AEST) on {{PROMO_END}}.`,
  },
  {
    slug: 'acceptance',
    label: 'Acceptance of Terms',
    text: `Information on how to enter, details of the prizes being offered form part of these Terms and Conditions. Participation in this promotion is deemed as acceptance of these Terms and Conditions.`,
  },
  {
    slug: 'type',
    label: 'Promotion Type',
    text: `Trade Lottery - Game of Chance`,
  },
  {
    slug: 'website',
    label: 'Website',
    text: `repco.com.au/win`,
  },
  {
    slug: 'eligibile',
    label: 'Who Can enter?',
    text: `Repco Rewards members who are Australian residents aged 16 years or older who comply with these Terms and Conditions.
`,
  },
  {
    slug: 'ineligibile',
    label: 'Who is ineligible?',
    text: `Employees (and their immediate families) of the Promoter, participating retail stores and agencies associated with this promotion are ineligible to enter. Immediate family means any of the following: spouse, ex-spouse, de-facto spouse, child or step-child (whether natural or by adoption), parent, step-parent, grandparent, step-grandparent, uncle, aunt, niece, nephew, brother, sister, step-brother, step-sister or 1st cousin.
Companies, businesses and organisations of any description are excluded from participating in this Promotion.`,
  },
  {
    slug: 'regions',
    label: 'Where is it operating?',
    text: `The promotion will operate in all states and territories of Australia`,
  },
  {
    slug: 'how_to_enter',
    label: 'How to Enter',
    text: `Entrants will receive one (1) entry into the draw for every $[[SPEND]] (incl. GST) spent on [[BRAND]] products in a single transaction, provided they present their Repco Rewards membership at the time of purchase in-store or complete the purchase online at repco.com.au using a valid Repco Rewards membership.

Customers who are not Repco Rewards members may join the Repco Rewards program free of charge in-store or online at repco.com.au prior to making a qualifying purchase.
Persons aged less than 18 years must have consent from a Parent or Guardian to register for Repco Rewards.
The Promoter reserves the right to verify the validity of entries and to disqualify any entry that does not comply with these Terms and Conditions.
All entries to this promotion are based on Repco’s internal business systems. 



`,
    gaps: [
      { key: 'SPEND', question: 'Qualifying spend amount (per entry)?', placeholder: 'e.g. 50' },
      { key: 'BRAND', question: 'Participating Brand(s) or descriptions?', placeholder: 'e.g. Brand or Brands' },
    ],
  },
  {
    slug: 'draw',
   label: 'Number of winners & how they’re selected',
text: `There will be {{TOTAL_WINNERS}} Winners will be drawn via a computerised random selection process using a verifiable electronic randomisation method at 12pm (AEST) on {{DRAW_DATE}} at Flow Marketing, 11 Lomandra Pl, Coolum QLD 4573 Australia from all valid entries received during the Promotional Period.
At the time of the draw, entries will be randomly drawn and recorded in ranked order. Each valid entry received during the Promotional Period will have an equal chance of being drawn.
Prizes will be allocated to valid entries in accordance with the prize structure set out in these Terms and Conditions. Where multiple prizes are available, prizes will be awarded in the order specified in the Prize Details.
The Promoter may select and record extra entries during the original draw to create a ranked reserve list.  If a drawn entry is determined to be invalid, ineligible, or otherwise unable to accept a prize, the prize will be awarded to the next valid entry in ranked order.
`
  },
  {
    slug: 'sub_template_choice',
    label: 'Prize types',
    text: `Select all prize types that apply. Conditions for each selected type will be included.`,
    gaps: [
      {
        key: 'PRIZE_TYPES',
        question: 'Prize types (select all that apply)',
        options: ['Motor vehicle', 'Recreational Vehicle', 'Travel', 'Cash', 'Gift Card', 'Other'],
        optionLabels: ['Motor Vehicle', 'Recreational Vehicle', 'Travel / Event', 'Cash', 'Gift Card', 'Other'],
        multiple: true,
      },
    ],
  },
  {
    slug: 'prizes',
    label: 'What you could win',
    text: `{{PRIZE_LIST}}
Total Prize Pool: {{PRIZE_POOL}} (incl. GST)
Prizes are not transferable or exchangeable and cannot be taken as cash unless otherwise specified.
If any prize (or part of a prize) is unavailable, the Promoter reserves the right to substitute the prize with a prize of equal or greater value.
Any ancillary costs associated with redeeming a prize are not included unless expressly stated. Any tax liability arising from acceptance of a prize is the responsibility of the winner.`,
  },
  {
    slug: 'value',
    label: 'Total Prize Pool',
    text: `{{PRIZE_POOL}} incl GST`,
  },
  {
    slug: 'additionals',
    label: 'How often can you enter?',
    text: `There is no limit to the number of entries earned. Each entry will be submitted automatically in accordance with these Terms and Conditions and will not be accepted in any other method.`,
  },
  {
    slug: 'notification',
    label: 'Winner Notification and Publication',
    text: `Winners will be notified by email within 5 business days of the draw.
The winner's surname, first initial and state will be published on {{CAMPAIGN_URL}} for a minimum of 28 days from the date of notification.`,
  },
  {
    slug: 'unclaimed',
    label: 'Unclaimed Prizes',
    text: `Any prize that remains unclaimed by 5:00pm (AEST) {{UNCLAIMED_DEADLINE}} will be forfeited.
A separate unclaimed prize draw will be conducted at 12:00pm (AEST) {{UNCLAIMED_REDRAW}} at the same venue as the original draw.
The unclaimed prize draw will be conducted in the same manner as the original draw and additional reserve entries may be drawn at that time.
Winners of the unclaimed prize draw will be notified by email in accordance with these Terms and Conditions.
If the prize remains unclaimed, the Promoter may dispose of the prize in accordance with applicable State and Territory legislation.`,
  },
  {
    slug: 'miscellaneous',
    label: 'Miscellaneous Provisions',
    text: `Entrants consent to the Promoter using their name, likeness, image and/or voice in the event they are a winner (including photograph, film and/or recording of the same) in any media for an unlimited period without remuneration for the purpose of promoting this promotion (including any outcome), and promoting any products manufactured, distributed and/or supplied by the Promoter.
If for any reason this Promotion is not capable of running as planned, including without limitation due to technical failures, unauthorised intervention, fraud or causes beyond the Promoter's control, the Promoter reserves the right to cancel, terminate, modify or suspend the Promotion, subject to any required regulatory approval.
The Promoter reserves the right, at any time, to verify the validity of entries and entrants (including their eligibility to enter) and to disqualify any entrant whose entry is not in accordance with these Terms and Conditions or who otherwise tampers with the entry process. Failure by the Promoter to enforce any of its rights at any stage does not constitute a waiver of those rights.
Each participant must ensure the correct and legible contact information is provided during entry. Changes to contact information must be made to the Promoter prior to the end of the Promotional Period. See repco.com.au/privacy for details.
Except for any liability that cannot be excluded by law, the Promoter and its agencies exclude all liability (including negligence) for any loss or damage (including loss of opportunity) arising in any way out of this Promotion or any prize.
Incomplete, indecipherable, fraudulent or invalid entries will be deemed invalid. These Terms and Conditions are governed by the laws of Australia. Participants submit to the jurisdiction of the courts of the relevant State or Territory.
The Promoter's decisions in relation to this Promotion are final and no correspondence or communication will be entered into in relation to any aspect of this Promotion.
The Promoter (or third parties on its behalf) may collect personal information (PI) to conduct the Promotion and disclose such PI to third parties for this purpose, including agents, contractors, service providers and prize suppliers. Validity of an eligible entrant's entry is conditional on providing this information. The Promoter may, for an indefinite period unless otherwise advised, use the information for promotional, marketing, publicity, research and profiling purposes, including sending electronic messages or telephoning the participant. All eligible entrants consent to their PI being collected and stored for this purpose in accordance with the Promoter's privacy policy available at repco.com.au/privacy which forms part of these T&Cs.  The Privacy Policy also contains information about how Eligible Entrants may opt out, access, update or correct their PI, how Eligible Entrants may complain about a breach of the Australian Privacy Principles or any other applicable law and how those complaints will be dealt with. All entries become the property of the Promoter.`,
    gaps: [
      {
        key: 'PRIVACY',
        question: 'Privacy policy URL',
        placeholder: 'repco.com.au/privacy',
        default: 'repco.com.au/privacy',
        hidden: true,
      },
    ],
  },

    {
    slug: 'permits',
    label: 'Permit Numbers',
    text: `Authorised in Australia: SA:T26/####; ACT: TP 26/#####; NSW: TP/000076`,
  },
]

export const TEMPLATE_META = {
  id: 'repco-retail',
  name: 'Repco Retail',
  promoterKeyword: 'repco',
  audience: 'b2c',
}
