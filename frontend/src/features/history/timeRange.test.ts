import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  formatDuration,
  parseIsoInstant,
  parseZonedInput,
  presetRange,
  startOfZonedDay,
  toUtcIso,
  toZonedInput,
  validateRange,
} from './timeRange'

function iso(date: Date | null): string | null {
  return date ? toUtcIso(date) : null
}

describe('Bogota <-> UTC conversion', () => {
  it('reads datetime-local values as America/Bogota (UTC-5) and sends UTC ISO', () => {
    expect(iso(parseZonedInput('2026-11-09T08:00'))).toBe('2026-11-09T13:00:00Z')
    // 21:30 in Bogota is already the next day in UTC.
    expect(iso(parseZonedInput('2026-11-09T21:30'))).toBe('2026-11-10T02:30:00Z')
    expect(iso(parseZonedInput('2026-11-09T08:00:30'))).toBe('2026-11-09T13:00:30Z')
  })

  it('rejects malformed or impossible values', () => {
    expect(parseZonedInput('')).toBeNull()
    expect(parseZonedInput('9/11/2026 08:00')).toBeNull()
    expect(parseZonedInput('2026-02-30T10:00')).toBeNull()
    expect(parseZonedInput('2026-11-09T24:00')).toBeNull()
  })

  it('formats instants back as Bogota wall-clock input values', () => {
    expect(toZonedInput(new Date('2026-11-09T13:00:00Z'))).toBe('2026-11-09T08:00')
    expect(toZonedInput(new Date('2026-11-10T02:30:59Z'))).toBe('2026-11-09T21:30')
  })

  it('finds midnight of the Bogota day, not of the UTC day', () => {
    // 2026-11-10T03:00Z is 22:00 of 9 Nov in Bogota.
    expect(toUtcIso(startOfZonedDay(new Date('2026-11-10T03:00:00Z')))).toBe('2026-11-09T05:00:00Z')
  })

  it('accepts only zone-qualified ISO instants from the URL', () => {
    expect(iso(parseIsoInstant('2026-11-09T13:00:00Z'))).toBe('2026-11-09T13:00:00Z')
    expect(iso(parseIsoInstant('2026-11-09T08:00:00-05:00'))).toBe('2026-11-09T13:00:00Z')
    expect(parseIsoInstant('2026-11-09T13:00:00')).toBeNull()
    expect(parseIsoInstant(null)).toBeNull()
    expect(parseIsoInstant('mañana')).toBeNull()
  })
})

describe('quick ranges', () => {
  // 14:33:41 in Bogota.
  const now = new Date('2026-11-09T19:33:41Z')

  it('computes last hour and last 24 h from the current minute', () => {
    expect(presetRange('last_hour', now)).toEqual({
      from: new Date('2026-11-09T18:33:00Z'),
      to: new Date('2026-11-09T19:33:00Z'),
    })
    expect(presetRange('last_24h', now)).toEqual({
      from: new Date('2026-11-08T19:33:00Z'),
      to: new Date('2026-11-09T19:33:00Z'),
    })
  })

  it('computes today and yesterday as Bogota calendar days', () => {
    expect(presetRange('today', now)).toEqual({
      from: new Date('2026-11-09T05:00:00Z'),
      to: new Date('2026-11-09T19:33:00Z'),
    })
    expect(presetRange('yesterday', now)).toEqual({
      from: new Date('2026-11-08T05:00:00Z'),
      to: new Date('2026-11-09T05:00:00Z'),
    })
  })

  it('never produces an empty "today" right at midnight', () => {
    const midnight = new Date('2026-11-09T05:00:00Z')
    const range = presetRange('today', midnight)
    expect(range.to.getTime() - range.from.getTime()).toBe(60_000)
  })
})

describe('validateRange', () => {
  it('accepts a valid range of up to 7 days', () => {
    const result = validateRange('2026-11-02T08:00', '2026-11-09T08:00')
    expect(result.ok).toBe(true)
    if (result.ok) expect(toUtcIso(result.range.from)).toBe('2026-11-02T13:00:00Z')
  })

  it('requires both dates', () => {
    const result = validateRange('', '  ')
    expect(result).toEqual({
      ok: false,
      issues: [
        { field: 'from', message: 'Indica la fecha y hora de inicio.' },
        { field: 'to', message: 'Indica la fecha y hora de fin.' },
      ],
    })
  })

  it('requires the end to be after the start', () => {
    expect(validateRange('2026-11-09T10:00', '2026-11-09T10:00')).toEqual({
      ok: false,
      issues: [{ field: 'to', message: 'La fecha y hora de fin debe ser posterior a la de inicio.' }],
    })
  })

  it('rejects ranges longer than 7 days', () => {
    expect(validateRange('2026-11-01T08:00', '2026-11-08T08:01')).toEqual({
      ok: false,
      issues: [{ field: 'to', message: 'El rango no puede superar 7 días. Acorta las fechas.' }],
    })
  })
})

describe('summary formatting', () => {
  it('formats durations and distances for es-CO', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(720)).toBe('12 min')
    expect(formatDuration(3_900)).toBe('1 h 05 min')
    expect(formatDuration(97_200)).toBe('1 d 3 h')
    expect(formatDistance(12.44)).toBe('12,4 km')
    expect(formatDistance(0)).toBe('0,0 km')
  })
})
