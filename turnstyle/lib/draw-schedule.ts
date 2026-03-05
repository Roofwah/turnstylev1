export interface DrawEvent {
  id: string
  name: string
  periodStart: string
  periodEnd: string
  drawDate: string
  winners: number
  type: 'major' | 'minor'
}

function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) added++
  }
  return d
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addPeriod(date: Date, frequency: string): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'daily':       d.setDate(d.getDate() + 1); break
    case 'weekly':      d.setDate(d.getDate() + 7); break
    case 'fortnightly': d.setDate(d.getDate() + 14); break
    case 'monthly':     d.setMonth(d.getMonth() + 1); break
  }
  return d
}

export function generateDrawSchedule(
  promoStart: string,
  promoEnd: string,
  frequency: string
): DrawEvent[] {
  const start = new Date(promoStart)
  const end = new Date(promoEnd)
  const events: DrawEvent[] = []

  if (frequency === 'at_conclusion' || frequency === 'AT_CONCLUSION') {
    const drawDate = addBusinessDays(end, 5)
    events.push({
      id: 'major-1',
      name: 'Major Draw',
      periodStart: toISO(start),
      periodEnd: toISO(end),
      drawDate: toISO(drawDate),
      winners: 1,
      type: 'major',
    })
    return events
  }

  // Major draw
  const majorDraw = addBusinessDays(end, 5)
  events.push({
    id: 'major-1',
    name: 'Major Draw',
    periodStart: toISO(start),
    periodEnd: toISO(end),
    drawDate: toISO(majorDraw),
    winners: 1,
    type: 'major',
  })

  // Minor draws
  let periodStart = new Date(start)
  let minorCount = 1
  while (periodStart < end) {
    let periodEnd = addPeriod(new Date(periodStart), frequency)
    periodEnd.setDate(periodEnd.getDate() - 1)
    if (periodEnd >= end) break
    const drawDate = addBusinessDays(periodEnd, 5)
    events.push({
      id: `minor-${minorCount}`,
      name: `Minor Draw ${minorCount}`,
      periodStart: toISO(periodStart),
      periodEnd: toISO(periodEnd),
      drawDate: toISO(drawDate),
      winners: 1,
      type: 'minor',
    })
    periodStart = addPeriod(new Date(periodStart), frequency)
    minorCount++
  }

  return events
}
