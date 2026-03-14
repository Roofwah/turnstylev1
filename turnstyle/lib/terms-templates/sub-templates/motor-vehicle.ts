/**
 * Sub-template: Motor vehicle prizes
 * Inserted only when at least one prize has type "Motor vehicle".
 */

export const PRIZE_TYPE = 'Motor vehicle'

export const MOTOR_VEHICLE_CLAUSES = [
  {
    slug: 'prizes-motor-vehicle',
    label: 'Motor vehicle prize conditions',
    text: `[[WEBSITE]]`,
gaps: [
      {
        key: 'WEBSITE',
        question: 'What is the promotion website?',
        placeholder: 'www.something.com/enter',
      },
    ],
  },


  
  
]
