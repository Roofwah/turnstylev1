export const GENERIC_SWEEPSTAKES = [
  {
    slug: 'promoter',
    label: 'Promoter',
    text: `{{PROMOTER_NAME}} {{PROMOTER_ABN}} of {{PROMOTER_ADDRESS}} `,
  },
  {
    slug: 'promotion_period',
    label: 'Promotional Period',
    text: `The Promotion commences at 12:00am (AEST) on {{PROMO_START}} and closes at 11:59pm (AEST) on {{PROMO_END}}.
Entries received outside the Promotional Period will not be accepted.`,
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
text: `[[WEBSITE]]`,
gaps: [
      {
        key: 'WEBSITE',
        question: 'What is the promotion website?',
        placeholder: 'www.something.com/enter',
      },
    ],
  },

{
    slug: 'eligible',
    label: 'Who can enter?',
    text: `Only Australian residents who: are aged [[AGE]] years or over.`,
  gaps: [
      {
        key: 'AGE',
        question: 'What is the minium age?',
        placeholder: '18',
      },
    ],
  },

  {
    slug: 'eligibility',
    label: 'Who is ineligible?',
    text: `Employees (and their immediate families) of the Promoter, participating retail stores and agencies associated with this promotion are ineligible to enter. Immediate family means any of the following: spouse, ex-spouse, de-facto spouse, child or step-child (whether natural or by adoption), parent, step-parent, grandparent, step-grandparent, uncle, aunt, niece, nephew, brother, sister, step-brother, step-sister or 1st cousin.

Companies, businesses and organisations of any description are excluded from participating in this Promotion.
`,
  },
  {
    slug: 'how_to_enter',
    label: 'How to Enter',
    text: `During the Promotional Period, eligible participants must complete the online entry form available at {{CAMPAIGN_URL}}, including all requested information, and submit the fully completed form.
Entries must be submitted by an individual via the prescribed website and will not be accepted by any other means.
The Promoter reserves the right to verify the validity of entries and to disqualify any entry that does not comply with these Terms and Conditions.`,
           
  },
  {
    slug: 'prizes',
    label: 'Prize Details',
    text: `{{PRIZE_LIST}}
Total Prize Pool: {{PRIZE_POOL}} (incl. GST)
Prizes are not transferable or exchangeable and cannot be taken as cash unless otherwise specified.
If any prize (or part of a prize) is unavailable, the Promoter reserves the right to substitute the prize with a prize of equal or greater value.
Any ancillary costs associated with redeeming a prize are not included unless expressly stated. Any tax liability arising from acceptance of a prize is the responsibility of the winner.`,
  },
  {
    slug: 'draw',
    label: 'Draw Method',
    text: `The draw will take place at 12:00pm (AEST) on {{DRAW_DATE}} at Flow Marketing 11 Lomandra Pl Coolum QLD 4573 Australia.
All valid entries received during the Promotional Period will be included in the draw.
At the time of the draw, entries will be randomly selected using an approved random number generator and recorded in ranked order. Each valid entry received during the Promotional Period will have an equal chance of being selected.
Prizes will be allocated to valid entries in accordance with the prize structure set out above.
Additional entries may be drawn and recorded at the time of the original draw to establish a ranked list of reserve entries. If a drawn entry is determined to be invalid or ineligible, the prize will be awarded to the next valid entry in ranked order.
The Promoter's decision is final and no correspondence will be entered into.`,
    
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
Any prize awarded in the unclaimed prize draw that remains unclaimed after 14 DAYS from the unclaimed draw date will be forfeited absolutely and will not be awarded.`,
  },
  {
    slug: 'miscellaneous',
    label: 'Miscellaneous Provisions',
    text: `Entrants consent to the Promoter using their name, likeness, image and/or voice in the event they are a winner (including photograph, film and/or recording of the same) in any media for an unlimited period without remuneration for the purpose of promoting this promotion (including any outcome), and promoting any products manufactured, distributed and/or supplied by the Promoter.
If for any reason this Promotion is not capable of running as planned, including without limitation due to technical failures, unauthorised intervention, fraud or causes beyond the Promoter's control, the Promoter reserves the right to cancel, terminate, modify or suspend the Promotion, subject to any required regulatory approval.
The Promoter reserves the right, at any time, to verify the validity of entries and entrants (including their eligibility to enter) and to disqualify any entrant whose entry is not in accordance with these Terms and Conditions or who otherwise tampers with the entry process. Failure by the Promoter to enforce any of its rights at any stage does not constitute a waiver of those rights.
Each participant must ensure the correct and legible contact information is provided during entry. Changes to contact information must be made to the Promoter prior to the end of the Promotional Period. See [[PRIVACY]] for details.
Except for any liability that cannot be excluded by law, the Promoter and its agencies exclude all liability (including negligence) for any loss or damage (including loss of opportunity) arising in any way out of this Promotion or any prize.
These Terms and Conditions are governed by the laws of Australia. Participants submit to the jurisdiction of the courts of the relevant State or Territory.
The Promoter's decisions in relation to this Promotion are final and no correspondence or communication will be entered into in relation to any aspect of this Promotion.
The Promoter (or third parties on its behalf) may collect personal information (PI) to conduct the Promotion and disclose such PI to third parties for this purpose, including agents, contractors, service providers and prize suppliers. Validity of an eligible entrant's entry is conditional on providing this information. The Promoter may, for an indefinite period unless otherwise advised, use the information for promotional, marketing, publicity, research and profiling purposes, including sending electronic messages or telephoning the participant. All eligible entrants consent to their PI being collected and stored for this purpose in accordance with the Promoter's privacy policy available at [[PRIVACY]] which forms part of these T&Cs.  The Privacy Policy also contains information about how Eligible Entrants may opt out, access, update or correct their PI, how Eligible Entrants may complain about a breach of the Australian Privacy Principles or any other applicable law and how those complaints will be dealt with. All entries become the property of the Promoter.`,
    gaps: [
      {
        key: 'PRIVACY',
        question: 'Website / privacy URL?',
        placeholder: 'e.g. https://example.com/privacy',
      },
    ],
  },
]


export const TEMPLATE_META = {
  id: 'generic-sweepstakes',
  name: 'Generic Sweepstakes',
  promoterKeyword: null,
  audience: 'b2c',
}