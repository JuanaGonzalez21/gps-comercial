import { LOCALE } from '@/lib/format'

// Small pure helpers for the dashboard figures (easy to unit test).

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
