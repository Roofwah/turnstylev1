/**
 * Sub-template: Travel prizes
 * Inserted only when at least one prize has type "Travel".
 */

export const PRIZE_TYPE = 'Travel'

export const TRAVEL_CLAUSES = [
  {
    slug: 'prizes-travel',
    label: 'Travel prize conditions',
    text: `The following conditions apply unless otherwise stated in the prize description.
Travel must be taken on the dates [[TRAVEL_BOOK_BY_DATE]] If travel is not taken on the specified dates, the prize will be forfeited and no alternative travel dates will be provided unless otherwise determined by the Promoter.
Travel is subject to booking and availability at the time of reservation. The Promoter is not responsible for any cancellation, delay or rescheduling of flights, accommodation or events that may affect travel arrangements.
Unless expressly stated in the prize description, the prize does not include spending money, meals, additional transport, travel insurance, passports, visas, vaccinations, transfers, taxes (excluding airline and airport taxes where applicable), or any other ancillary costs associated with redeeming the prize. Any such costs are the responsibility of the winner and any travelling companion(s).
If the prize description includes return air travel and the winner resides within 300km of the event location, airfare will not be provided and no alternative cash or travel allowance will be offered.
The winner and any travelling companion(s) (if applicable) must travel together on the same itinerary and depart from and return to the same departure point unless otherwise agreed by the Promoter.
The winner and any travelling companion(s) are responsible for ensuring they have valid identification and any documentation required for travel or participation in the prize.
The winner may be required to present a credit card at the time of accommodation check-in to cover incidental charges.
The Promoter strongly recommends that the winner and any travelling companion(s) obtain travel insurance prior to travel. Travel insurance is not included in the prize unless otherwise stated.
The itinerary will be determined by the Promoter in consultation with the winner. However, if agreement cannot be reached, the Promoter reserves the right to determine the final itinerary.
Frequent flyer points will not form part of the prize.
If the winner or any travelling companion is under 18 years of age, that person must travel with a parent or legal guardian unless otherwise permitted by the Promoter and the relevant travel provider.
Participation in any event forming part of the prize may be subject to additional terms and conditions imposed by the event organiser or other third parties. The winner and any travelling companion(s) agree to comply with those conditions.
If an event forming part of the prize is cancelled, rescheduled or postponed for any reason beyond the Promoter’s control, the Promoter may substitute the affected portion of the prize with an alternative of equal or greater value where reasonably possible.
If the Promotion or prize is unable to proceed due to war, terrorism, state of emergency, pandemic, natural disaster or other circumstances beyond the Promoter’s control, the Promoter reserves the right to cancel, terminate, modify or suspend the Promotion or modify the prize, subject to any applicable regulatory approval.:
The winner and any companion(s) are responsible for all costs not expressly included in the prize description, including but not limited to: travel insurance, visas, vaccinations, transfers, meals, spending money and incidentals. Prize may not be exchanged for cash. Dates and itinerary are at the Promoter's or supplier's discretion unless otherwise stated. The winner must hold a valid passport (and any required visas) for international travel.`,
    gaps: [
      {
        key: 'TRAVEL_BOOK_BY_DATE',
        question: 'What are the dates of the event?',
        placeholder: 'e.g. 21-23 July 2026',
      },
    ],
  },
]



