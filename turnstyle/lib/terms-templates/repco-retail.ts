export const REPCO_RETAIL = [
  {
    slug: 'promoter',
    label: 'Promoter',
    text: `Repco Australia (A division of GPC Asia Pacific Pty Ltd (ABN 97 097 993 283) of 22 Enterprise Drive Rowville 3178 `,
  },
  {
    slug: 'promotion_period',
    label: 'Promotional Period',
    text: `The Promotion commences at 12:00am (AEST) on {{PROMO_START}} and closes at 11:59pm (AEST) on {{PROMO_END}}.
Entries received outside the Promotional Period will not be accepted.`,
  },
  {
    slug: 'eligibility',
    label: 'Eligibility',
    text: `Entry is open to Australian residents aged 18 years or over.
The following persons are ineligible to enter:
- Employees of the Promoter and its related bodies corporate
- Agencies associated with this Promotion
- Immediate family members of the above
Immediate family includes spouse, de-facto spouse, parent, child, sibling or any other family member residing at the same residential address.
Companies, businesses and organisations are not eligible to enter.`,
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
Any prize awarded in the unclaimed prize draw that remains unclaimed by [[FINAL_FORFEIT_DATE]] will be forfeited absolutely and will not be awarded.`,
    gaps: [
      {
        key: 'FINAL_FORFEIT_DATE',
        question: 'Final forfeit date for unclaimed prizes?',
        placeholder: 'e.g. 5:00pm (AEST) 15 June 2026',
      },
    ],
  },
  {
    slug: 'general',
    label: 'General Conditions',
    text: `If for any reason this Promotion is not capable of running as planned, including due to technical failures, unauthorised intervention, fraud or causes beyond the Promoter's control, the Promoter reserves the right (subject to any required regulatory approval) to cancel, suspend or modify the Promotion.
The Promoter's decisions regarding all matters relating to this Promotion are final and no correspondence will be entered into.
Failure by the Promoter to enforce any of its rights does not constitute a waiver of those rights.`,
  },
  {
    slug: 'liability',
    label: 'Limitation of Liability',
    text: `Except for any liability that cannot be excluded by law, the Promoter excludes all liability for any loss, damage or injury suffered in connection with this Promotion or any prize.
Nothing in these Terms and Conditions excludes, restricts or modifies any consumer guarantee, right or remedy conferred by the Competition and Consumer Act 2010 (Cth) or any other applicable law.`,
  },
  {
    slug: 'governing_law',
    label: 'Governing Law',
    text: `These Terms and Conditions are governed by the laws of Australia. Participants submit to the jurisdiction of the courts of the relevant State or Territory.`,
  },
  {
    slug: 'privacy',
    label: 'Privacy',
    text: `The Promoter collects personal information in order to conduct the Promotion and may disclose such information to agents, contractors, service providers and prize suppliers for this purpose.
Personal information will be handled in accordance with the Promoter's Privacy Policy available at [[PRIVACY_URL]], which includes information about how individuals may access or correct their personal information and how complaints may be made and handled.
If participants opt-in to receive marketing communications, the Promoter may send electronic communications in accordance with applicable laws. Participants may unsubscribe at any time.`,
    gaps: [
      {
        key: 'PRIVACY_URL',
        question: 'Privacy Policy URL?',
        placeholder: 'e.g. https://example.com/privacy-policy',
      },
    ],
  },
]


    export const TEMPLATE_META = {
    id: 'repco-retail',
    name: 'Repco Retail',
    promoterKeyword: 'repco',
    audience: 'b2c',
  }