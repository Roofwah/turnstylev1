export type NextStepType = 'link' | 'share' | 'advance' | 'download' | 'prize-wizard' | 'draw-wizard' | null
export interface NextStepConfig {
  label: string
  href: string | null
  type: NextStepType
  requiresConfirmation?: boolean
}

const PRIZE_MECHANICS = ['SWEEPSTAKES', 'INSTANT_WIN', 'LIMITED_OFFER', 'GAME_OF_SKILL']
const DRAW_MECHANICS  = ['SWEEPSTAKES', 'INSTANT_WIN', 'DRAW_ONLY']
const TERMS_MECHANICS = ['SWEEPSTAKES', 'INSTANT_WIN', 'LIMITED_OFFER', 'GAME_OF_SKILL']

export function getNextStepConfig(campaign: any): NextStepConfig | null {
  const mechanic = campaign.mechanicType ?? 'OTHER'

  switch (campaign.status) {
    case 'DRAFT':
    case 'APPROVED':
      return {
        label: 'Approve Quote',
        href: `/dashboard/${campaign.id}?tab=quote`,
        type: 'link',
      }

    case 'CONFIRMED': {
      if (TERMS_MECHANICS.includes(mechanic)) {
        return { label: 'Build Terms →', href: `/dashboard/${campaign.id}?tab=terms`, type: 'link' }
      }
      return null
    }

    case 'COMPILED':
      return { label: 'Share Terms', href: `/dashboard/${campaign.id}?tab=terms`, type: 'link' }

    case 'REVIEW':
      return { label: 'Review Changes', href: `/dashboard/${campaign.id}?tab=terms`, type: 'link' }

    case 'PENDING':
      return { label: 'Awaiting Approval', href: `/dashboard/${campaign.id}?tab=overview`, type: 'link' }

    case 'SCHEDULED':
      return { label: 'Check Draw Details', href: `/dashboard/${campaign.id}?tab=draw`, type: 'link' }

    case 'LIVE':
      return { label: 'Check Draw Details', href: `/dashboard/${campaign.id}?tab=draw`, type: 'link' }

    case 'CLOSED':
      return { label: 'Upload Dataset', href: `/dashboard/${campaign.id}?tab=draw`, type: 'link' }

    case 'DRAWN':
      return { label: 'See Winners', href: `/dashboard/${campaign.id}?tab=winners`, type: 'link' }

    case 'ARCHIVED':
      return null

    default:
      return null
  }
}