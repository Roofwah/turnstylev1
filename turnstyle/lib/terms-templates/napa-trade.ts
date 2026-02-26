export const NAPA_TRADE = [
    {
      slug: 'promoter',
      label: 'Promoter',
      text: `{{PROMOTER_NAME}} (ABN {{PROMOTER_ABN}}) of {{PROMOTER_ADDRESS}}.`,
    },
    {
      slug: 'promotion_period',
      label: 'Promotion Period',
      text: `From 12:00am (AEST) on {{PROMO_START}} and ends 11:59pm (AEST) on {{PROMO_END}}.`,
    },
    {
      slug: 'acceptance',
      label: 'Acceptance of Terms',
      text: `Information on how to enter and details of the prizes being offered form part of these Terms and Conditions. Participation in this promotion is deemed as acceptance of these Terms and Conditions.`,
    },
    {
      slug: 'promotion_type',
      label: 'Promotion Type',
      text: `{{DRAW_MECHANIC}}`,
    },
    {
      slug: 'website',
      label: 'Website',
      text: `{{CAMPAIGN_URL}} or via the QR Code where shown.`,
    },
    {
      slug: 'who_can_enter',
      label: 'Who can enter?',
      text: `Open to {{PROMOTER_NAME}}  Trade Account Customers who are operating within {{REGION}}, Australia and if an individual and are aged 18 years or older. Eligible Businesses must be within the Promoter’s trading terms throughout the promotional period and must not have overdue monies owing as at the promotional closing date to claim any prize.`,
   },

    {
      slug: 'ineligible',
      label: 'Who is ineligible?',
      text: `Employees (and their immediate families) of the Promoter, participating retail stores and agencies associated with this promotion are ineligible to enter. Immediate family means any of the following: spouse, ex-spouse, de-facto spouse, child or step-child (whether natural or by adoption), parent, step-parent, grandparent, step-grandparent, uncle, aunt, niece, nephew, brother, sister, step-brother, step-sister or 1st cousin.

Customers of GPC Asia Pacific Participating Businesses who are designated by GPC Asia Pacific as national company owned accounts, resellers, Repco Petrol & Convenience and Government account customer; GPC Asia Pacific employees, contractors, or suppliers; agencies associated with this promotion; Customers of GPC Asia Pacific Participating Businesses who have policies prohibiting the receipt of gifts or commercial prizes.`,
},
    {
      slug: 'where_operating',
      label: 'Where is it operating?',
      text: `The promotion will operate {{REGION}}.`,
    },
    {
      slug: 'how_to_enter',
      label: 'How to enter',
      text: `During the promotional period, {{ENTRY_MECHANIC}} and receive one (1) entry into the prize draw (Qualifying Purchase).[[ADDITIONAL_ENTRIES]]
  
  All entries must be submitted in accordance with these Terms and Conditions. Entries not submitted in accordance with these Terms and Conditions will be deemed invalid.`,
   
    },
    {
      slug: 'number_of_winners',
      label: 'Number of winners & how selected',
      text: `[[WINNERS_CLAUSE]]
  
  The draw will be conducted using an approved random number generator at Flow Marketing, 11 Lomandra Pl, Coolum Beach QLD 4573, Australia. The judge's decision is final and no correspondence will be entered into.`,
      gaps: [
        {
          key: 'WINNERS_CLAUSE',
          question: 'Regional draws?',
          options: [
            '{{TOTAL_WINNERS}} winner(s) will be drawn via a random electronic draw at 12:00pm (AEST) on {{DRAW_DATE}} at Flow Marketing, 11 Lomandra Pl, Coolum Beach QLD 4573, Australia from all eligible entries received during the promotional period.',
            '[[REGIONAL_DRAW_DETAILS]]',
          ],
          optionLabels: ['No — national draw', 'Yes — regional draws'],
          followUp: {
            key: 'REGIONAL_DRAW_DETAILS',
            question: 'Describe the regional draw schedule',
            placeholder: 'e.g. NSW/ACT: 2 winners drawn at 12pm AEST 5 April 2026...',
            multiline: true,
            showWhen: 1,
          },
        },
      ],
    },
    {
      slug: 'prize',
      label: 'What you could win (the Prize)',
      text: `{{PRIZE_LIST}}
  
  Prizes will be awarded to the authorised representative of the respective winning business. Prizes or parts of the prize are not transferable or exchangeable and cannot be redeemed for cash or any other form of compensation.
  
  If for any reason any elements of the specified prizes are unavailable, the Promoter reserves the right to replace it with a prize of the same or higher value and of similar specification subject to any applicable legislative approval.`,
    },
    {
      slug: 'prize_pool',
      label: 'Total prize pool',
      text: `{{PRIZE_POOL}} (incl. GST) in Australia.`,
    },
    {
      slug: 'entry_frequency',
      label: 'How often can you enter?',
      text: `There is no limit to the number of entries that can be earned during the promotional period, provided each entry is obtained in accordance with these Terms and Conditions.`,
    },
    {
      slug: 'winner_notification',
      label: 'How will any winner be notified?',
      text: `All winners will be [[NOTIFICATION_METHOD]] within 7 business days of any prize draw. The name (surname, first initial) and postcode of each winner will be published on {{CAMPAIGN_URL}} for a period of 28 days from the notification date.`,
      gaps: [
        {
          key: 'NOTIFICATION_METHOD',
          question: 'How are winners contacted?',
          options: [
            'contacted by phone and email',
            'contacted by email',
            'notified via the website',
          ],
          optionLabels: ['Phone & Email', 'Email only', 'Website only'],
        },
      ],
    },
    {
      slug: 'unclaimed',
      label: 'Unclaimed prize',
      text: `Any prize that remains unclaimed by 5:00pm AEST {{UNCLAIMED_DEADLINE}} will be forfeited by that winner and a new winner will be drawn at 12:00 noon AEST {{UNCLAIMED_REDRAW}} at the same venue as the previous draw. This process will be repeated until the prize is claimed or the Promoter determines, in its absolute discretion, that it is no longer practicable to award the prize.`,
    },
    {
      slug: 'enforcement',
      label: 'Enforcement of these terms',
      text: `The Promoter's decision not to enforce a specific restriction does not constitute a waiver of that restriction or of these Terms and Conditions generally. Each entrant acknowledges that the Promoter may rely on these Terms and Conditions even if the Promoter only becomes aware of an entrant's ineligibility after a prize has been awarded.
  
  If this occurs, the Promoter may require the return of the prize or repayment of its equivalent value.`,
    },
    {
      slug: 'miscellaneous',
      label: 'Miscellaneous Provisions',
      text: `The Promoter, its associated agencies and companies and the agencies and companies associated with this Promotion will not be liable for any loss (including, without limitation, indirect, special or consequential loss or loss of profits), expense, damage, personal injury or death which is suffered or sustained (whether or not arising from any person’s negligence) by any person in connection with this Promotion or accepting or using a prize, except for any liability which cannot be excluded by law (in which case that liability is limited to the minimum allowable by law).

The Promoter accepts no responsibility for any tax implications that may arise from the prize winnings.  Independent financial advice should be sought.  Where the operation of the Promotion results in, for Australian GST purposes, supplies being made for non-monetary consideration, entrants agree to follow the Australian Taxation Office’s stated view that where the parties are at arm’s length, goods and services exchanged are of equal GST inclusive market values.

Subject to the unclaimed prize draw clause, if for any reason the winning business does not accept the prize, then the prize will be forfeited.

Prizes are not transferable or exchangeable and cannot be redeemed for cash or any other form of compensation. In the event for any reason a winner does not take an element of a prize at the time stipulated by the Promoter, then that element of the prize will be forfeited by the winner and neither cash nor any other form of compensation will be supplied in lieu of that element of the prize. The value of prizes is accurate as at the commencement of this Promotion. The Promoter accepts no responsibility for any variation in the value of a prize after that date. If for any reason a prize is not available, the Promoter reserves the right to substitute another item for it, in its sole discretion, of equal or higher value, subject to the approval of the gaming authorities in each state or territory, where relevant.  

Authorised representatives of Eligible Businesses consent to the Promoter using the business’ name, likeness and/or image in the event they are the winning business (including photograph, film and/or recording of the same) in any media for an unlimited period, without remuneration, for the purpose of promoting this promotion (including any outcome), and promoting any products manufactured, distributed and/or supplied by the Promoter.

If this promotion is interfered with in any way or is not capable of being conducted as reasonably anticipated due to any reason beyond the reasonable control of the Promoter, including but not limited to technical difficulties, unauthorised intervention or fraud, the Promoter reserves the right, in its sole discretion, to the fullest extent permitted by law (a) to disqualify any Eligible Businesses and/or its authorised representative; or (b) subject to any written directions from a regulatory authority, to modify, suspend, terminate or cancel the promotion, as appropriate.

Nothing in these Terms and Conditions limits, excludes, or modifies or purports to limit, exclude or modify the statutory consumer guarantees as provided under the Competition and Consumer Act, as well as any other implied warranties under the ASIC Act or similar consumer protection laws in the States and Territories of Australia (“Non-Excludable Guarantees”). Except for any liability that cannot by law be excluded, including the Non-Excludable Guarantees, the Promoter (including its respective officers, employees and agents) excludes all liability (including negligence), for any personal injury; or any loss or damage (including loss of opportunity); whether direct, indirect, special or consequential, arising in any way out of the promotion.

Except for any liability that cannot by law be excluded, including the Non-Excludable Guarantees, the Promoter (including its respective officers, employees and agents) is not responsible for and excludes all liability (including negligence), for any personal injury; or any loss or damage (including loss of opportunity); whether direct, indirect, special or consequential, arising in any way out of: (a) any technical difficulties or equipment malfunction (whether or not under the Promoter’s control); (b) any theft, unauthorised access or third party interference; (c) any entry or prize claim that is late, lost, altered, damaged or misdirected (whether or not after their receipt by the Promoter) due to any reason beyond the reasonable control of the Promoter; (d) any tax liability incurred by a winning business or Eligible Business (or its authorised representative); or (e)use of a prize.

As a condition of accepting the prize, the authorised representative of the winning business must sign any legal documentation as and, in the form, required by the Promoter and/or prize suppliers in their absolute discretion, including but not limited to a legal release and indemnity form.

The laws of Australia apply to this promotion to the exclusion of any other law.  Eligible Businesses submit to the exclusive jurisdiction of the courts of Australia.
`,
    },
  ]
  
  export const TEMPLATE_META = {
    id: 'napa-trade',
    name: 'Napa Trade',
    promoterKeyword: 'napa',
    audience: 'b2b',
  }