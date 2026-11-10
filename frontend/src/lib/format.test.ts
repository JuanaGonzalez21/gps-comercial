import { describe, expect, it } from 'vitest'
import {
  courseToCardinal,
  formatCourse,
  formatDateTime,
  formatRelative,
  formatSpeed,
  formatTime,
} from './format'

// Intl may use non-breaking spaces; compare on normalised whitespace.
const normalize = (value: string) => value.replace(/\s/g, ' ')

describe('date formatting (UTC from the API, Bogota in the UI)', () => {
  it('shows the Bogota wall-clock time (UTC-5, no DST)', () => {
    expect(formatTime('2026-11-09T19:33:11Z')).toBe('14:33:11')
    expect(normalize(formatDateTime('2026-11-09T19:33:11Z'))).toMatch(/9 .*nov.* 2026, 14:33/)
  })

  it('moves to the previous day when UTC is already past midnight', () => {
    expect(normalize(formatDateTime('2026-11-10T03:15:00Z'))).toMatch(/^9 .*nov.* 2026, 22:15$/)
  })

  it('handles missing or invalid timestamps without throwing', () => {
    expect(formatDateTime(null)).toBe('Sin dato')
    expect(formatTime('not-a-date')).toBe('Sin dato')
    expect(formatRelative(undefined)).toBe('Sin dato')
  })

  it('formats relative times in Spanish', () => {
    const now = Date.parse('2026-11-09T19:40:00Z')
    expect(formatRelative('2026-11-09T19:35:00Z', now)).toBe('hace 5 minutos')
    expect(formatRelative('2026-11-09T19:39:50Z', now)).toBe('ahora')
    expect(formatRelative('2026-11-08T19:40:00Z', now)).toBe('ayer')
  })
})

describe('formatSpeed', () => {
  it('rounds to whole km/h and tolerates nulls', () => {
    expect(formatSpeed(42.4)).toBe('42 km/h')
    expect(formatSpeed(0)).toBe('0 km/h')
    expect(formatSpeed(null)).toBe('Sin dato')
    expect(formatSpeed(Number.NaN)).toBe('Sin dato')
  })
})

describe('courseToCardinal', () => {
  it.each([
    [0, 'N'],
    [22, 'N'],
    [23, 'NE'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SO'],
    [270, 'O'],
    [315, 'NO'],
    [338, 'N'],
    [359, 'N'],
    [360, 'N'],
    [-45, 'NO'],
    [450, 'E'],
  ])('%i° -> %s', (degrees, expected) => {
    expect(courseToCardinal(degrees)).toBe(expected)
  })

  it('returns null without a course and spells the full name', () => {
    expect(courseToCardinal(null)).toBeNull()
    expect(formatCourse(225)).toBe('Suroeste (SO)')
    expect(formatCourse(null)).toBe('Sin dato')
  })
})
