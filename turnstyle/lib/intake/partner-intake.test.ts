/**
 * Partner Intake — unit tests (no live DB / email required)
 * Run: npx tsx lib/intake/partner-intake.test.ts
 */

import { extractBearerToken, generatePartnerApiKey, hashApiKey } from './partner-auth'
import { validatePacketSubmitInput } from './packet'
import { checkRateLimit, resetRateLimits } from './rate-limit'
import { buildPacketPresentation } from './presentation'
import { mockExtractCampaign } from './mock'
import { finalizeMockIntake } from './normalize'

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
    toContain(substr: string) {
      if (typeof actual !== 'string' || !actual.includes(substr)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(substr)}`)
      }
    },
  }
}

console.log('\nPartner Intake tests\n')

test('extractBearerToken parses Authorization header', () => {
  expect(extractBearerToken('Bearer abc123')).toBe('abc123')
  expect(extractBearerToken('bearer xyz')).toBe('xyz')
  expect(extractBearerToken(null)).toBe(null)
  expect(extractBearerToken('Basic x')).toBe(null)
})

test('generatePartnerApiKey returns hashable key', () => {
  const { apiKey, apiKeyHash, apiKeyPrefix } = generatePartnerApiKey()
  expect(apiKey.startsWith('ts_live_')).toBe(true)
  expect(apiKeyPrefix).toBe(apiKey.slice(0, 8))
  expect(hashApiKey(apiKey)).toBe(apiKeyHash)
})

test('validatePacketSubmitInput requires concept and contact', () => {
  const bad = validatePacketSubmitInput({
    concept: '',
    submitterName: 'A',
    submitterEmail: 'a@b.com',
    submitterCompany: 'Co',
    partnerId: 'zitcha',
    source: 'partner',
  })
  expect(bad.ok).toBe(false)

  const badEmail = validatePacketSubmitInput({
    concept: 'Win something',
    submitterName: 'A',
    submitterEmail: 'not-an-email',
    submitterCompany: 'Co',
    partnerId: 'zitcha',
    source: 'partner',
  })
  expect(badEmail.ok).toBe(false)

  const good = validatePacketSubmitInput({
    concept: 'Win purchase back in 200 stores',
    submitterName: 'Troy',
    submitterEmail: 'troy@example.com',
    submitterCompany: 'Zitcha',
    partnerId: 'zitcha',
    source: 'partner',
  })
  expect(good.ok).toBe(true)
})

test('rate limiter blocks after limit', () => {
  resetRateLimits()
  const key = 'test:rl'
  for (let i = 0; i < 3; i++) {
    expect(checkRateLimit(key, 3).allowed).toBe(true)
  }
  expect(checkRateLimit(key, 3).allowed).toBe(false)
})

test('short concept: win purchase back extracts prize + name', () => {
  const raw =
    'We want to run a promotion across 200 stores in March where customers can win their purchase back.'
  const intake = finalizeMockIntake(raw, mockExtractCampaign(raw))
  expect(intake.campaign_name).toBe('Win Your Purchase Back')
  expect(intake.regions[0]?.prizes[0]?.description?.toLowerCase().includes('purchase')).toBe(true)
  expect(!!(intake.notes && /200/.test(intake.notes))).toBe(true)
})

test('short concept: Disneyland / Colgate recognises brand and prize', () => {
  const raw = 'We want to give Colgate customers the chance to win a family trip to Disneyland.'
  const intake = finalizeMockIntake(raw, mockExtractCampaign(raw))
  expect(intake.brand || intake.retailer || '').toContain('Colgate')
  expect(intake.regions[0]?.prizes.length > 0).toBe(true)
})

test('presentation distinguishes confirmed vs assumed', () => {
  const raw = 'Win purchase back across 200 stores'
  const intake = finalizeMockIntake(raw, mockExtractCampaign(raw))
  const p = buildPacketPresentation({
    packetRef: 'TS-PKT-TEST',
    intake,
    concept: raw,
    submitterName: 'Troy',
    submitterEmail: 'troy@example.com',
    submitterCompany: 'Zitcha',
    partnerId: 'demo',
    source: 'demo',
    createdAt: new Date().toISOString(),
  })
  expect(p.fields.some((f) => f.label === 'Participating locations' && f.confirmed)).toBe(true)
  expect(p.fields.some((f) => f.label === 'Campaign dates' && !f.confirmed)).toBe(true)
  expect(p.packetRef).toBe('TS-PKT-TEST')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
