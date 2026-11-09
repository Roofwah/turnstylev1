/**
 * Campaign Packet email + abbreviated T&Cs integration tests
 */
import { mockExtractCampaign } from './mock'
import { buildPacketPresentation } from './presentation'
import { generateAbbrevTermsForPacket } from './abbrev-from-packet'
import { buildSubmitterPacketEmail, firstNameFrom, selectOverviewFields } from './packet-email-submitter'
import { resolvePartnerBranding } from './partner-branding'
import { generateAbbreviatedTerms } from '@/lib/abbrev-terms/generate'

function expect(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const REPCO = `We're planning a promotion across 200 Repco stores in Australia during March 2027. Customers who purchase selected products will have the chance to win a Ford Ranger Raptor valued at approximately $90,000. We anticipate one major prize draw at the end of the promotion.`

const SPARSE = `We might run something later.`

function presentationFor(concept: string, partnerId = 'zitcha') {
  const intake = mockExtractCampaign(concept)
  return {
    intake,
    presentation: buildPacketPresentation({
      packetRef: 'TS-PKT-TEST-001',
      intake,
      concept,
      submitterName: 'Troy Wilson',
      submitterEmail: 'troy@zitcha.com',
      submitterCompany: 'Zitcha',
      partnerId,
      source: 'demo',
      createdAt: new Date().toISOString(),
    }),
  }
}

console.log('packet-email tests…')

// Branding
{
  const z = resolvePartnerBranding('zitcha')
  expect(z.primaryLogoPath?.includes('zitcha'), 'zitcha has partner logo')
  expect(z.poweredByLabel.includes('Sales Promotions'), 'powered-by label')

  const demo = resolvePartnerBranding('demo')
  expect(demo.primaryLogoPath?.includes('zitcha'), 'demo uses zitcha branding')

  const def = resolvePartnerBranding('acme-corp')
  expect(def.primaryLogoPath == null, 'unknown partner is Turnstyle-only')
  expect(def.partnerId === 'turnstyle', 'default partner id')
}

// First name
expect(firstNameFrom('Troy Wilson') === 'Troy', 'first name')

// Abbrev from shared generator preserves Flow draw venue wording
{
  const text = generateAbbreviatedTerms({
    promoStart: '2027-03-01',
    promoEnd: '2027-03-31',
    drawMechanic: 'Sweepstakes',
    drawFrequency: 'at_conclusion',
    entryMechanic: 'Purchase selected products',
    regions: ['national_au'],
    prizes: [{ description: 'Ford Ranger Raptor', qty: 1, unitValue: 90000 }],
    promoterName: null,
  })
  expect(text.includes('Ford Ranger Raptor'), 'prize in terms')
  expect(text.includes('Flow Marketing, 11 Lomandra Pl'), 'preserves draw venue')
  expect(text.includes('[Promoter]'), 'promoter placeholder')
  expect(text.includes('Australia'), 'region')
}

// Repco packet → abbrev + email
{
  const { intake, presentation } = presentationFor(REPCO, 'zitcha')
  const abbrev = generateAbbrevTermsForPacket({ intake, concept: REPCO })
  expect(abbrev.ok, 'Repco brief can generate draft abbrev T&Cs')
  if (abbrev.ok) {
    expect(abbrev.text.includes('Ford Ranger Raptor'), 'abbrev prize')
    expect(/90,?000/.test(abbrev.text), 'abbrev value')
    expect(abbrev.text.includes('Purchase selected products') || abbrev.text.includes('purchase'), 'abbrev entry')
  }

  const overview = selectOverviewFields(presentation.fields)
  expect(overview.some((f) => f.label === 'Retailer' && /Repco/i.test(f.value)), 'overview retailer')
  expect(overview.some((f) => f.label === 'Prize' && /Ford Ranger/i.test(f.value)), 'overview prize')

  const email = buildSubmitterPacketEmail({
    presentation,
    abbrev,
    appUrl: 'https://example.turnstylehost.com',
  })

  expect(email.subject.includes('Campaign Packet'), 'subject')
  expect(email.html.includes('partners/zitcha-logo.png'), 'zitcha logo in html')
  expect(email.html.includes('Sales Promotions by'), 'co-brand label')
  expect(email.html.includes('tstyleblk.jpg'), 'turnstyle logo')
  expect(email.html.includes('Thanks for sharing your promotional idea'), 'warm intro')
  expect(email.html.includes('Your campaign starts here'), 'closing line')
  expect(email.html.includes('Campaign Packet'), 'packet header')
  expect(email.html.includes(presentation.packetRef), 'packet ref')
  expect(email.html.includes('Version 1.0'), 'version')
  expect(email.html.includes('Draft'), 'draft badge')
  expect(email.html.includes('Details to Confirm'), 'details section')
  expect(email.html.includes('Proposed Abbreviated Terms'), 'abbrev heading')
  expect(email.html.includes('DRAFT — SUBJECT TO REVIEW') || email.html.includes('DRAFT'), 'draft terms label')
  expect(!email.html.includes('Heuristic'), 'no heuristic jargon')
  expect(!email.html.includes('AI extraction'), 'no AI jargon')
  expect(!/Flow Marketing has been notified/i.test(email.html), 'no transactional Flow line in customer email')
  expect(email.html.includes('Hi Troy'), 'personalised greeting')
  if (abbrev.ok) {
    expect(email.html.includes('Ford Ranger Raptor'), 'terms body in email')
  }
}

// Sparse brief — professional email, no forced terms
{
  const { intake, presentation } = presentationFor(SPARSE, 'demo')
  const abbrev = generateAbbrevTermsForPacket({ intake, concept: SPARSE })
  expect(!abbrev.ok, 'sparse brief cannot generate terms')

  const email = buildSubmitterPacketEmail({
    presentation,
    abbrev,
    appUrl: 'https://example.turnstylehost.com',
  })
  expect(
    email.html.includes(
      'Draft abbreviated terms and conditions will be prepared once the remaining campaign details are confirmed.'
    ),
    'fallback terms copy'
  )
  expect(email.html.includes('Campaign Packet'), 'still shows packet card')
  expect(email.html.includes('partners/zitcha-logo.png'), 'demo still zitcha branded')
}

// Turnstyle-only branding for non-partner
{
  const { intake, presentation } = presentationFor(REPCO, 'turnstyle')
  const abbrev = generateAbbrevTermsForPacket({ intake, concept: REPCO })
  const email = buildSubmitterPacketEmail({
    presentation,
    abbrev,
    appUrl: 'https://example.turnstylehost.com',
  })
  expect(!email.html.includes('zitcha-logo'), 'no zitcha logo for turnstyle partner')
}

console.log('All packet-email tests passed.')
