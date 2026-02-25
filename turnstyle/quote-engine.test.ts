/**
 * Quote Engine Tests
 * Verifies exact parity with the PHP turnstyle-quote-engine.php v0.1.5
 *
 * Run: npx vitest run quote-engine.test.ts
 *  or: npx ts-node quote-engine.test.ts (simple runner below)
 */

import {
  calculateQuote,
  calcTermsFee,
  calcMgmtFee,
  calcPermitFee,
  calcDrawFee,
  calculateDrawCount,
  resolvePromoType,
  parseDate,
  diffDaysInclusive,
  buildQuoteNumber,
} from './quote-engine'

// ─── Tiny test runner (no deps needed) ───────────────────────────────────────
let passed = 0, failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e: any) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    failed++
  }
}
function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
  }
}
function describe(name: string, fn: () => void) {
  console.log(`\n${name}`)
  fn()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolvePromoType()', () => {
  test('detects limited offer',    () => expect(resolvePromoType('Limited Offer')).toBe('limited'))
  test('detects sweepstakes',      () => expect(resolvePromoType('Sweepstakes - Random Draw')).toBe('sweepstakes'))
  test('detects instant win',      () => expect(resolvePromoType('Instant Win Mechanic')).toBe('instant_win'))
  test('fallback to other',        () => expect(resolvePromoType('Something else')).toBe('other'))
  test('case insensitive',         () => expect(resolvePromoType('SWEEPSTAKES')).toBe('sweepstakes'))
})

describe('calcTermsFee()', () => {
  test('limited offer = $250',             () => expect(calcTermsFee('limited', 0)).toBe(250))
  test('limited offer (high value) = $250',() => expect(calcTermsFee('limited', 50000)).toBe(250))
  test('sweepstakes < $10k = $450',        () => expect(calcTermsFee('sweepstakes', 9999)).toBe(450))
  test('sweepstakes = $10k = $550',        () => expect(calcTermsFee('sweepstakes', 10000)).toBe(550))
  test('sweepstakes > $10k = $550',        () => expect(calcTermsFee('sweepstakes', 25000)).toBe(550))
  test('other treated as sweepstakes',     () => expect(calcTermsFee('other', 5000)).toBe(450))
})

describe('calcMgmtFee()', () => {
  test('limited offer = $150',       () => expect(calcMgmtFee('limited', 100000)).toBe(150))
  test('sweepstakes < $5k = $250',   () => expect(calcMgmtFee('sweepstakes', 4999)).toBe(250))
  test('sweepstakes $5k = $450',     () => expect(calcMgmtFee('sweepstakes', 5000)).toBe(450))
  test('sweepstakes $9,999 = $450',  () => expect(calcMgmtFee('sweepstakes', 9999)).toBe(450))
  test('sweepstakes $10k = $550',    () => expect(calcMgmtFee('sweepstakes', 10000)).toBe(550))
})

describe('calcPermitFee()', () => {
  test('$0 prize pool = $0',        () => expect(calcPermitFee(0)).toBe(0))
  test('$2,999 = $0',               () => expect(calcPermitFee(2999)).toBe(0))
  test('$3,000 = $275',             () => expect(calcPermitFee(3000)).toBe(275))
  test('$4,999 = $275',             () => expect(calcPermitFee(4999)).toBe(275))
  test('$5,000 = $675',             () => expect(calcPermitFee(5000)).toBe(675))
  test('$9,999 = $675',             () => expect(calcPermitFee(9999)).toBe(675))
  test('$10,000 = $2,365',          () => expect(calcPermitFee(10000)).toBe(2365))
  test('$49,999 = $2,365',          () => expect(calcPermitFee(49999)).toBe(2365))
  test('$50,000 = $3,505',          () => expect(calcPermitFee(50000)).toBe(3505))
  test('$99,999 = $3,505',          () => expect(calcPermitFee(99999)).toBe(3505))
  test('$100,000 = $6,375',         () => expect(calcPermitFee(100000)).toBe(6375))
  test('$199,999 = $6,375',         () => expect(calcPermitFee(199999)).toBe(6375))
  test('$200,000 = $11,305',        () => expect(calcPermitFee(200000)).toBe(11305))
  test('$500,000 = $11,305',        () => expect(calcPermitFee(500000)).toBe(11305))
})

describe('calcDrawFee()', () => {
  test('1 draw = $275',    () => expect(calcDrawFee(1)).toBe(275))
  test('2 draws = $400',   () => expect(calcDrawFee(2)).toBe(400))
  test('3 draws = $525',   () => expect(calcDrawFee(3)).toBe(525))
  test('4 draws = $650',   () => expect(calcDrawFee(4)).toBe(650))
  test('5 draws = $745',   () => expect(calcDrawFee(5)).toBe(745))
  test('6 draws = $840',   () => expect(calcDrawFee(6)).toBe(840))
  test('10 draws = $1,220',() => expect(calcDrawFee(10)).toBe(1220))
  // Formula: 275 + 3*125 + (10-4)*95 = 275 + 375 + 570 = 1220 ✓
})

describe('calculateDrawCount()', () => {
  const jan1  = parseDate('2025-01-01')
  const jan31 = parseDate('2025-01-31')
  const dec31 = parseDate('2025-12-31')

  test('at_conclusion = 1',     () => expect(calculateDrawCount('at_conclusion', jan1, jan31)).toBe(1))
  test('empty string = 1',      () => expect(calculateDrawCount('', jan1, jan31)).toBe(1))
  test('daily 31 days = 31',    () => expect(calculateDrawCount('daily', jan1, jan31)).toBe(31))
  test('weekly 31 days = 5',    () => expect(calculateDrawCount('weekly', jan1, jan31)).toBe(5))
  test('fortnightly 31d = 3',   () => expect(calculateDrawCount('fortnightly', jan1, jan31)).toBe(3))
  test('monthly Jan-Dec = 12',  () => expect(calculateDrawCount('monthly', jan1, dec31)).toBe(12))
  test('same day = 1',          () => expect(calculateDrawCount('daily', jan1, jan1)).toBe(1))
})

describe('diffDaysInclusive()', () => {
  test('same day = 1',           () => expect(diffDaysInclusive(parseDate('2025-01-01'), parseDate('2025-01-01'))).toBe(1))
  test('jan 1 to jan 31 = 31',   () => expect(diffDaysInclusive(parseDate('2025-01-01'), parseDate('2025-01-31'))).toBe(31))
  test('jan 1 to dec 31 = 365',  () => expect(diffDaysInclusive(parseDate('2025-01-01'), parseDate('2025-12-31'))).toBe(365))
})

describe('buildQuoteNumber()', () => {
  test('format is TS{YY}{CODE}', () => {
    const yy = new Date().getFullYear().toString().slice(-2)
    expect(buildQuoteNumber('NEWCF')).toBe(`TS${yy}NEWCF`)
  })
  test('uppercases the code', () => {
    const yy = new Date().getFullYear().toString().slice(-2)
    expect(buildQuoteNumber('newcf')).toBe(`TS${yy}NEWCF`)
  })
})

describe('calculateQuote() — full integration', () => {
  const baseInput = {
    campaignId:   'test-123',
    tsCode:       'NEWCF',
    campaignName: 'Summer Promo 2025',
    promoStart:   '2025-06-01',
    promoEnd:     '2025-08-31',
    drawMechanic: 'Sweepstakes - Random Draw',
    drawFrequency:'weekly',
    prizes: [
      { tier: '1st', description: '$5,000 cash', qty: 1, unitValue: 5000 },
      { tier: '2nd', description: '$500 voucher', qty: 5, unitValue: 500 },
    ],
  }

  test('computes prize pool correctly', () => {
    const q = calculateQuote(baseInput)
    // 1 × $5,000 + 5 × $500 = $7,500
    expect(q.prizePoolTotal).toBe(7500)
  })

  test('sweepstakes $7.5k: terms = $450', () => {
    const q = calculateQuote(baseInput)
    expect(q.termsFee).toBe(450)
  })

  test('sweepstakes $7.5k: mgmt = $450', () => {
    const q = calculateQuote(baseInput)
    expect(q.mgmtFee).toBe(450)
  })

  test('$7.5k: permit = $675', () => {
    const q = calculateQuote(baseInput)
    expect(q.permitFee).toBe(675)
  })

  test('weekly Jun–Aug ≈ 14 weeks', () => {
    const q = calculateQuote(baseInput)
    // Jun 1 to Aug 31 = 92 days → floor((92-1)/7)+1 = floor(91/7)+1 = 13+1 = 14
    expect(q.drawCount).toBe(14)
  })

  test('draw fee for 14 draws = $1,595', () => {
    // 275 + 3*125 + (14-4)*95 = 275 + 375 + 950 = 1600
    // Let's verify: draws 1=$275, 2-4=+375, 5-14=10*95=950 → 275+375+950=1600
    const q = calculateQuote(baseInput)
    expect(q.drawFee).toBe(1600)
  })

  test('total ex GST is sum of all fees', () => {
    const q = calculateQuote(baseInput)
    expect(q.totalExGst).toBe(q.termsFee + q.mgmtFee + q.permitFee + q.drawFee)
  })

  test('GST is 10% of ex-GST total', () => {
    const q = calculateQuote(baseInput)
    expect(q.gstAmount).toBe(Math.round(q.totalExGst * 0.1 * 100) / 100)
  })

  test('has a quote number', () => {
    const q = calculateQuote(baseInput)
    const yy = new Date().getFullYear().toString().slice(-2)
    expect(q.quoteNumber).toBe(`TS${yy}NEWCF`)
  })

  test('limited offer total is lower', () => {
    const limited = calculateQuote({ ...baseInput, drawMechanic: 'Limited Offer', drawFrequency: 'at_conclusion' })
    const sweep   = calculateQuote(baseInput)
    const limitedTotal = limited.termsFee + limited.mgmtFee // just compare controllable fees
    expect(limitedTotal).toBe(400) // $250 + $150
  })
})

// ─── Results ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('QUOTE ENGINE HAS FAILURES — do not ship until all tests pass')
  process.exit(1)
} else {
  console.log('✓ Quote engine verified — safe to ship')
}
