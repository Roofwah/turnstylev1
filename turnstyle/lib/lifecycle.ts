export type NextStepType = 'link' | 'share' | 'advance' | 'download' | null

export interface NextStepConfig {
  label: string
  href: string | null
  type: NextStepType
  requiresConfirmation?: boolean
}

export function getNextStepConfig(campaign: any): NextStepConfig | null {
  switch (campaign.status) {
    case 'DRAFT':
      return {
        label: 'Approve Quote',
        href: `/dashboard/${campaign.id}?tab=quote`,
        type: 'link',
      }
    case 'CONFIRMED':
      return {
        label: 'Build Terms',
        href: `/dashboard/${campaign.id}/terms-wizard`,
        type: 'link',
      }
    case 'COMPILED':
      return {
        label: 'Share Terms',
        href: `/dashboard/${campaign.id}?tab=terms`,
        type: 'share',
      }
    case 'REVIEW':
      return {
        label: 'Review Changes',
        href: `/dashboard/${campaign.id}/terms/comments`,
        type: 'link',
      }
    case 'PENDING':
      return {
        label: 'Mark Scheduled',
        href: null,
        type: 'advance',
        requiresConfirmation: true,
      }
    case 'SCHEDULED':
      return {
        label: 'Download Approved Terms',
        href: null,
        type: 'download',
      }
    case 'LIVE':
      return {
        label: 'Mark as Closed',
        href: null,
        type: 'advance',
        requiresConfirmation: true,
      }
    case 'CLOSED':
      return {
        label: 'Upload Dataset',
        href: `/dashboard/${campaign.id}/draw/upload`,
        type: 'link',
      }
    case 'DRAWN':
      return {
        label: 'See Winners',
        href: `/dashboard/${campaign.id}/draw/winners`,
        type: 'link',
      }
    case 'ARCHIVED':
      return null
    default:
      return null
  }
}
