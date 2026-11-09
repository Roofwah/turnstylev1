/**
 * Partner-specific branding for customer-facing Intake / Campaign Packet emails.
 * Direct Turnstyle submissions use the default (Turnstyle-only) profile.
 */

export type PartnerEmailBranding = {
  partnerId: string
  displayName: string
  /** Absolute or site-relative path resolved against APP_URL */
  primaryLogoPath: string | null
  primaryLogoAlt: string
  primaryLogoHeight: number
  turnstyleLogoPath: string
  turnstyleLogoAlt: string
  turnstyleLogoHeight: number
  /** Shown above Turnstyle logo, e.g. "Sales Promotions by" */
  poweredByLabel: string
  footerLine: string
  contactEmail: string
  /** Dark strip behind partner logo (needed when logo is designed for dark bg) */
  headerBg: string
}

const TURNSTYLE_DEFAULT: PartnerEmailBranding = {
  partnerId: 'turnstyle',
  displayName: 'Turnstyle',
  primaryLogoPath: null,
  primaryLogoAlt: 'Turnstyle',
  primaryLogoHeight: 28,
  turnstyleLogoPath: '/tstyleblk.jpg',
  turnstyleLogoAlt: 'Turnstyle',
  turnstyleLogoHeight: 22,
  poweredByLabel: '',
  footerLine: 'Turnstyle promotional management',
  contactEmail: 'support@turnstylehost.com',
  headerBg: '#0a0a0f',
}

const ZITCHA: PartnerEmailBranding = {
  partnerId: 'zitcha',
  displayName: 'Zitcha',
  primaryLogoPath: '/partners/zitcha-logo.png',
  primaryLogoAlt: 'Zitcha',
  primaryLogoHeight: 28,
  turnstyleLogoPath: '/tstyleblk.jpg',
  turnstyleLogoAlt: 'Turnstyle',
  turnstyleLogoHeight: 20,
  poweredByLabel: 'Sales Promotions by',
  footerLine: 'Zitcha · Sales promotions powered by Turnstyle',
  contactEmail: 'support@turnstylehost.com',
  headerBg: '#0a0a0f',
}

/** Explicit partner → branding map. Demo uses Zitcha presentation for the partner showcase. */
const BY_PARTNER: Record<string, PartnerEmailBranding> = {
  zitcha: ZITCHA,
  demo: { ...ZITCHA, partnerId: 'demo' },
  turnstyle: TURNSTYLE_DEFAULT,
}

export function resolvePartnerBranding(partnerId: string | null | undefined): PartnerEmailBranding {
  const key = (partnerId || '').trim().toLowerCase()
  if (key && BY_PARTNER[key]) return BY_PARTNER[key]
  return TURNSTYLE_DEFAULT
}

export function absoluteAssetUrl(path: string, appUrl: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = appUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
