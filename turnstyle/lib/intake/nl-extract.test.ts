/**
 * Natural-language intake extraction regression tests
 * Run: npx esbuild lib/intake/nl-extract.test.ts --bundle --platform=node --outfile=/tmp/nl-test.js && node /tmp/nl-test.js
 */

import { finalizeMockIntake } from './normalize'
import { mockExtractCampaign } from './mock'
import { buildPacketPresentation } from './presentation'
import { extractFromNaturalLanguage } from './nl-extract'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e: unknown) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e instanceof Error ? e.message : e}`)
    failed++
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`)
    },
    toContain(s: string) {
      if (typeof actual !== 'string' || !actual.toLowerCase().includes(s.toLowerCase())) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(s)}`)
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
      }
    },
  }
}

const REPCO = `We're planning a promotion across 200 Repco stores in Australia during March 2027. Customers who purchase selected products will have the chance to win a Ford Ranger Raptor valued at approximately $90,000. We anticipate one major prize draw at the end of the promotion.`

const COLGATE =
  'We want to give Colgate customers the chance to win a family trip to Disneyland when they purchase selected products during June 2027.'

const TRADE =
  'We want to reward trade account customers who purchase concrete during May 2027 with the chance to win $10,000.'

const INSTANT =
  'Customers purchasing selected products at 150 stores during April 2027 can instantly win their purchase back, up to $250.'

console.log('\nNL intake extraction regressions\n')

test('Repco Ford Ranger — explicit facts extracted', () => {
  const intake = finalizeMockIntake(REPCO, mockExtractCampaign(REPCO))
  const r = intake.regions[0]
  expect(intake.retailer).toBe('Repco')
  expect(intake.brand).toBe(null)
  expect(intake.campaign_name).toContain('Ford Ranger Raptor')
  expect(r.start_date).toBe('2027-03-01')
  expect(r.end_date).toBe('2027-03-31')
  expect(r.prizes[0]?.description).toContain('Ford Ranger Raptor')
  expect(r.prizes[0]?.unit_value).toBe(90000)
  expect(r.prizes[0]?.quantity).toBe(1)
  expect(r.entry_mechanic?.toLowerCase()).toContain('selected products')
  expect(r.country).toBe('Australia')

  const p = buildPacketPresentation({
    packetRef: 'T',
    intake,
    concept: REPCO,
    submitterName: 'x',
    submitterEmail: 'x@y.com',
    submitterCompany: 'Co',
    partnerId: 'demo',
    source: 'demo',
    createdAt: new Date().toISOString(),
  })
  const byLabel = Object.fromEntries(p.fields.map((f) => [f.label, f]))
  expect(byLabel['Participating locations']?.value).toContain('200')
  expect(byLabel['Participating locations']?.confirmed).toBe(true)
  expect(byLabel['Prize']?.confirmed).toBe(true)
  expect(byLabel['Approximate prize value']?.value).toContain('90,000')
  expect(byLabel['Campaign dates']?.value).toContain('March 2027')
  expect(byLabel['Retailer']?.value).toBe('Repco')
  expect(byLabel['Brand']?.value).toBe('Not specified')
  expect(byLabel['Draw frequency']?.confirmed).toBe(true)
})

test('Colgate Disneyland — brand vs entry vs dates', () => {
  const intake = finalizeMockIntake(COLGATE, mockExtractCampaign(COLGATE))
  expect(intake.brand).toBe('Colgate')
  expect(intake.regions[0].start_date).toBe('2027-06-01')
  expect(intake.regions[0].prizes[0]?.description.toLowerCase()).toContain('disneyland')
  expect(intake.regions[0].entry_mechanic?.toLowerCase()).toContain('selected products')
})

test('Trade concrete — trade mechanic and cash prize', () => {
  const nl = extractFromNaturalLanguage(TRADE)
  expect(nl.prizes[0]?.unit_value).toBe(10000)
  expect(nl.startDate).toBe('2027-05-01')
  const intake = finalizeMockIntake(TRADE, mockExtractCampaign(TRADE))
  const p = buildPacketPresentation({
    packetRef: 'T',
    intake,
    concept: TRADE,
    submitterName: 'x',
    submitterEmail: 'x@y.com',
    submitterCompany: 'Co',
    partnerId: 'demo',
    source: 'demo',
    createdAt: new Date().toISOString(),
  })
  expect(p.promotionType).toBe('Trade promotion')
  expect(p.fields.find((f) => f.label === 'Prize')?.value).toContain('10,000')
})

test('Instant win purchase back — cap and store count', () => {
  const intake = finalizeMockIntake(INSTANT, mockExtractCampaign(INSTANT))
  const r = intake.regions[0]
  expect(r.prizes[0]?.description.toLowerCase()).toContain('purchase')
  expect(r.prizes[0]?.unit_value).toBe(250)
  expect(r.start_date).toBe('2027-04-01')
  const nl = extractFromNaturalLanguage(INSTANT)
  expect(nl.storeCount).toBe(150)
  const p = buildPacketPresentation({
    packetRef: 'T',
    intake,
    concept: INSTANT,
    submitterName: 'x',
    submitterEmail: 'x@y.com',
    submitterCompany: 'Co',
    partnerId: 'demo',
    source: 'demo',
    createdAt: new Date().toISOString(),
  })
  expect(p.likelyMechanic.toLowerCase()).toContain('instant')
})

test('does not invent brand from retailer-only brief', () => {
  const intake = finalizeMockIntake(REPCO, mockExtractCampaign(REPCO))
  expect(intake.brand).toBe(null)
  expect(intake.retailer).toBe('Repco')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
