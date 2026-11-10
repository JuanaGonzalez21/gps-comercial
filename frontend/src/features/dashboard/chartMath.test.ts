import { describe, expect, it } from 'vitest'
import { donutSegments, formatShare, share } from './chartMath'

describe('dashboard chart math', () => {
  it('computes shares without dividing by zero', () => {
    expect(share(12, 62)).toBeCloseTo(0.1935, 4)
    expect(share(5, 0)).toBe(0)
    expect(formatShare(12, 62)).toBe('19\u00a0%')
    expect(formatShare(0, 0)).toBe('0\u00a0%')
    expect(formatShare(40, 62)).toBe('65\u00a0%')
  })

  it('lays donut segments end to end from 12 o’clock with a gap between neighbours', () => {
    const segments = donutSegments([
      { key: 'moving', count: 25 },
      { key: 'stopped', count: 0 },
      { key: 'no_signal', count: 75 },
    ])
    expect(segments).toEqual([
      { key: 'moving', length: 24, offset: 25 },
      { key: 'no_signal', length: 74, offset: 0 },
    ])
  })

  it('closes the ring when a single value is present and skips empty fleets', () => {
    expect(donutSegments([{ key: 'moving', count: 3 }])).toEqual([
      { key: 'moving', length: 100, offset: 25 },
    ])
    expect(donutSegments([{ key: 'moving', count: 0 }])).toEqual([])
  })
})
