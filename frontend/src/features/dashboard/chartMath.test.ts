import { describe, expect, it } from 'vitest'
import { formatShare, share } from './chartMath'

describe('dashboard chart math', () => {
  it('computes shares without dividing by zero', () => {
    expect(share(12, 62)).toBeCloseTo(0.1935, 4)
    expect(share(5, 0)).toBe(0)
    expect(formatShare(12, 62)).toBe('19\u00a0%')
    expect(formatShare(0, 0)).toBe('0\u00a0%')
    expect(formatShare(40, 62)).toBe('65\u00a0%')
  })
})
