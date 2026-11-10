import { LOCALE } from '@/lib/format'

// Small pure helpers shared by the dashboard charts (easy to unit test).

const integerFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const NBSP = '\u00a0'

/** Share of a total in 0..1; 0 when the total is 0 (no division by zero in empty fleets). */
export function share(count: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, count / total)) : 0
}

/**
 * "38 %": whole percent with a non-breaking space before the sign (Spanish convention). Built by
 * hand because ICU versions disagree on that space for es-CO ("38%" in Node, "38 %" elsewhere).
 */
export function formatShare(count: number, total: number): string {
  return `${integerFormatter.format(Math.round(share(count, total) * 100))}${NBSP}%`
}

export interface DonutSegment<K extends string> {
  key: K
  /** Length on a circle of circumference 100 (stroke-dasharray units). */
  length: number
  /** stroke-dashoffset that starts this segment where the previous one ended, from 12 o'clock. */
  offset: number
}

/** Gap between adjacent segments, so neighbours never touch (they differ by more than colour). */
const SEGMENT_GAP = 1

/**
 * Segments of a donut drawn with stroke-dasharray on a circle whose circumference is 100.
 * Empty values are skipped; with a single non-empty value the ring is closed (no gap).
 */
export function donutSegments<K extends string>(
  values: ReadonlyArray<{ key: K; count: number }>,
): DonutSegment<K>[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value.count), 0)
  const visible = values.filter((value) => value.count > 0)
  if (total === 0) return []
  const gap = visible.length > 1 ? SEGMENT_GAP : 0
  let start = 0
  return visible.map((value) => {
    const full = (value.count / total) * 100
    const segment = { key: value.key, length: Math.max(0.5, full - gap), offset: 25 - start }
    start += full
    return segment
  })
}
