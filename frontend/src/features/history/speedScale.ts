// Pure helpers of the speed chart (kept apart from the component for fast refresh and tests).

/** Rounded axis maximum: 10 km/h steps up to 50, then 20, then 50. */
export function niceSpeedMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 10
  const step = max <= 50 ? 10 : max <= 150 ? 20 : 50
  return Math.ceil(max / step) * step
}

/** Index of the point whose time is closest to `target` (times sorted ascending). */
export function nearestIndex(times: readonly number[], target: number): number {
  let low = 0
  let high = times.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (times[mid] < target) low = mid + 1
    else high = mid
  }
  if (low > 0 && Math.abs(times[low - 1] - target) <= Math.abs(times[low] - target)) return low - 1
  return low
}

/** Evenly spread indices for the table alternative (first and last always included). */
export function sampleIndices(count: number, rows: number): number[] {
  if (count <= rows) return Array.from({ length: count }, (_, index) => index)
  const step = (count - 1) / (rows - 1)
  return Array.from({ length: rows }, (_, row) => Math.round(row * step))
}
