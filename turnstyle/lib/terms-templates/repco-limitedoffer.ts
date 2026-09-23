/**
 * Repco Limited Offer — terms template for Repco limited-offer style promotions.
 * Same structure as Repco Retail with promotion type set for Limited Offer.
 * Sub-templates (Travel, Motor vehicle, etc.) are included when selected in the wizard.
 */
export const REPCO_LIMITEDOFFER = [
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
    text: `Limited offer – Chance plays no role in determining a winner.`,
  },
  {
    slug: 'website',
    label: 'Website',
    text: `repco.com.au/win`,
  },
  {
    slug: 'eligibile',
    label: 'Who Can enter?',
    text: `Open to Repco Auto Parts and Capricorn Trade Account Customers who are operating within Australia and if an individual and are aged 18 years or older.

Eligible Businesses must be within the Promoter’s trading terms throughout the promotional period and must not have overdue monies owing as at the promotional closing date to claim any prize.  

`,
  },
  {
    slug: 'ineligibile',
    label: 'Who is ineligible?',
    text: `Employees (and their immediate families) of the Promoter, participating retail stores and agencies associated with this promotion are ineligible to enter. Immediate family means any of the following: spouse, ex-spouse, de-facto spouse, child or step-child (whether natural or by adoption), parent, step-parent, grandparent, step-grandparent, uncle, aunt, niece, nephew, brother, sister, step-brother, step-sister or 1st cousin.

Customers of GPC Asia Pacific Participating Businesses who are designated by GPC Asia Pacific as national company owned accounts, resellers, Repco Petrol & Convenience and Government account customer; GPC Asia Pacific employees, contractors, or suppliers; agencies associated with this promotion; Customers of GPC Asia Pacific Participating Businesses who have policies prohibiting the receipt of gifts or commercial prizes.
`,
  },
  {
    slug: 'regions',
    label: 'Where is it operating?',
    text: `The promotion will operate in all states and territories of Australia`,
  },
  {
    slug: 'how_to_enter',
    label: 'How to Enter',
    text: `Spend over $[[SPEND]] (excluding GST) on [[BRAND]] products during the promotional period are eligible to redeem one gift.

Labour, engines, freight charges, membership fees and core deposits are excluded from this promotion.

This offer will not be extended

`,
    gaps: [
     
      { key: 'SPEND', question: 'Qualifying spend amount (per entry)?', placeholder: 'e.g. 50' },
      { key: 'BRAND', question: 'Participating Brand(s) or descriptions?', placeholder: 'e.g. Brand or Brands' },

    ],
  },
  {
    slug: 'draw',
   label: 'Number of winners & how they’re selected',
text: `The first {{TOTAL_WINNERS}} accounts to satisfy the entry requirement as outlined above will be eligible to redeem 1 prize only.
This is a limited offer, prizes will be allocated in the chronological sequence from when orders are received via the GPC Asia Pacific accounting system.
`
  },
  {
    slug: 'determination',
   label: 'Winner determination',
text: `Prize allocation will be determined on the {{DRAW_DATE}} and will consider all returned or credited account purchases.
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
    text: `One (1) of {{PRIZE_LIST}}
Prize maybe subject to the standard terms and conditions of individual prize and service providers and not limited to validity / expiry, exclusions, winner are encouraged to become familiar with any terms or restrictions of use. 
Prizes will be awarded to the authorised representative of the respective winning business. Prizes or parts of the prize are not transferable or exchangeable.
If for any reason any elements of the specified prizes are unavailable, the Promoter reserves the right to replace it with a prize of the same or higher value and of similar specification.
`,
  },
  {
    slug: 'value',
    label: 'Total Prize Pool',
    text: `{{PRIZE_POOL}} incl GST`,
  },
  {
    slug: 'notification',
    label: 'Winner Notification and Publication',
    text: `All winners will have their business name and postcode published on the website for a period of 28 days from the determination date`,
  },
  {
    slug: 'unclaimed',
    label: 'Unclaimed Prizes',
    text: `Any offer not claimed will be forfeited and not be reissued.`,
  },

    {
    slug: 'enforce',
    label: 'Enforcement of these terms',
    text: `The Promoter’s decision not to enforce a specific restriction does not constitute a waiver of that restriction or of these Terms and Conditions generally. Each entrant acknowledges that the Promoter may rely on these Terms and Conditions even if the Promoter only becomes aware of an entrant’s ineligibility after a prize has been awarded.
If this occurs, the Promoter may require the return of the prize or repayment of its equivalent value
`,
  },
  {
    slug: 'miscellaneous',
    label: 'Miscellaneous Provisions',
    text: `The Promoter, its associated agencies and companies and the agencies and companies associated with this Promotion will not be liable for any loss (including, without limitation, indirect, special or consequential loss or loss of profits), expense, damage, personal injury or death which is suffered or sustained (whether or not arising from any person’s negligence) by any person in connection with this Promotion or accepting or using a prize, except for any liability which cannot be excluded by law (in which case that liability is limited to the minimum allowable by law).
The Promoter accepts no responsibility for any tax implications that may arise from the prize winnings.  Independent financial advice should be sought.  Where the operation of the Promotion results in, for Australian GST purposes, supplies being made for non-monetary consideration, entrants agree to follow the Australian Taxation Office’s stated view that where the parties are at arm’s length, goods and services exchanged are of equal GST inclusive market values.
Prizes are not transferable or exchangeable and cannot be redeemed for cash or any other form of compensation. In the event for any reason a winner does not take an element of a prize at the time stipulated by the Promoter, then that element of the prize will be forfeited by the winner and neither cash nor any other form of compensation will be supplied in lieu of that element of the prize. The value of prizes is accurate as at the commencement of this Promotion. The Promoter accepts no responsibility for any variation in the value of a prize after that date. If for any reason a prize is not available, the Promoter reserves the right to substitute another item for it, in its sole discretion, of equal or higher value, subject to the approval of the gaming authorities in each state or territory, where relevant.  
Authorised representatives of Eligible Businesses consent to the Promoter using the business’ name, likeness and/or image in the event they are the winning business (including photograph, film and/or recording of the same) in any media for an unlimited period, without remuneration, for the purpose of promoting this promotion (including any outcome), and promoting any products manufactured, distributed and/or supplied by the Promoter.
If this promotion is interfered with in any way or is not capable of being conducted as reasonably anticipated due to any reason beyond the reasonable control of the Promoter, including but not limited to technical difficulties, unauthorised intervention or fraud, the Promoter reserves the right, in its sole discretion, to the fullest extent permitted by law (a) to disqualify any Eligible Businesses and/or its authorised representative; or (b) subject to any written directions from a regulatory authority, to modify, suspend, terminate or cancel the promotion, as appropriate.
Nothing in these Terms and Conditions limits, excludes, or modifies or purports to limit, exclude or modify the statutory consumer guarantees as provided under the Competition and Consumer Act, as well as any other implied warranties under the ASIC Act or similar consumer protection laws in the States and Territories of Australia (“Non-Excludable Guarantees”). Except for any liability that cannot by law be excluded, including the Non-Excludable Guarantees, the Promoter (including its respective officers, employees and agents) excludes all liability (including negligence), for any personal injury; or any loss or damage (including loss of opportunity); whether direct, indirect, special or consequential, arising in any way out of the promotion.
Except for any liability that cannot by law be excluded, including the Non-Excludable Guarantees, the Promoter (including its respective officers, employees and agents) is not responsible for and excludes all liability (including negligence), for any personal injury; or any loss or damage (including loss of opportunity); whether direct, indirect, special or consequential, arising in any way out of: (a) any technical difficulties or equipment malfunction (whether or not under the Promoter’s control); (b) any theft, unauthorised access or third party interference; (c) any entry or prize claim that is late, lost, altered, damaged or misdirected (whether or not after their receipt by the Promoter) due to any reason beyond the reasonable control of the Promoter; (d) any tax liability incurred by a winning business or Eligible Business (or its authorised representative); or (e)use of a prize.
As a condition of accepting the prize, the authorised representative of the winning business must sign any legal documentation as and, in the form, required by the Promoter and/or prize suppliers in their absolute discretion, including but not limited to a legal release and indemnity form.
The laws of Australia apply to this promotion to the exclusion of any other law.  Eligible Businesses submit to the exclusive jurisdiction of the courts of Australia.`,
    
  },

   
]


export const TEMPLATE_META = {
  id: 'repco-limitedoffer',
  name: 'Repco Limited Offer',
  promoterKeyword: 'repco',
  audience: 'b2c',
}
