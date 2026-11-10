// Display formatting. The API sends ISO-8601 UTC; users read es-CO in America/Bogota (4.4).
// Every helper accepts null/invalid input and returns a readable placeholder instead of throwing.

export const LOCALE = 'es-CO'
export const TIME_ZONE = 'America/Bogota'
export const NO_DATA = 'Sin dato'

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const shortDateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto', style: 'long' })
const integerFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "9 de nov de 2026, 14:33" in Bogota time. */
export function formatDateTime(value: string | Date | null | undefined, fallback = NO_DATA): string {
  const date = toDate(value)
  return date ? dateTimeFormatter.format(date) : fallback
}

/** "9 de nov, 14:33" (no year): compact table cells; the full value goes in a tooltip. */
export function formatDateTimeShort(value: string | Date | null | undefined, fallback = NO_DATA): string {
  const date = toDate(value)
  return date ? shortDateTimeFormatter.format(date) : fallback
}

/** "14:33:11" in Bogota time. */
export function formatTime(value: string | Date | null | undefined, fallback = NO_DATA): string {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : fallback
}

const RELATIVE_STEPS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "hace 5 minutos", "ayer", "ahora". */
export function formatRelative(
  value: string | Date | null | undefined,
  now: number = Date.now(),
  fallback = NO_DATA,
): string {
  const date = toDate(value)
  if (!date) return fallback
  const seconds = Math.round((date.getTime() - now) / 1000)
  const absolute = Math.abs(seconds)
  if (absolute < 45) return relativeFormatter.format(0, 'second')
  for (const [unit, size] of RELATIVE_STEPS) {
    if (absolute >= size) return relativeFormatter.format(Math.round(seconds / size), unit)
  }
  return relativeFormatter.format(Math.round(seconds / 60), 'minute')
}

/** "42 km/h". */
export function formatSpeed(kmh: number | null | undefined, fallback = NO_DATA): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return fallback
  return `${integerFormatter.format(Math.max(0, kmh))} km/h`
}

export function formatNumber(value: number | null | undefined, fallback = NO_DATA): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback
  return integerFormatter.format(value)
}

export type Cardinal = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO'

const CARDINALS: readonly Cardinal[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export const CARDINAL_NAMES: Record<Cardinal, string> = {
  N: 'Norte',
  NE: 'Noreste',
  E: 'Este',
  SE: 'Sureste',
  S: 'Sur',
  SO: 'Suroeste',
  O: 'Oeste',
  NO: 'Noroeste',
}

/** Course in degrees (0 = north, clockwise) to one of 8 Spanish compass points; 45° sectors. */
export function courseToCardinal(degrees: number | null | undefined): Cardinal | null {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return null
  const normalized = ((degrees % 360) + 360) % 360
  return CARDINALS[Math.round(normalized / 45) % CARDINALS.length]
}

/** "Noreste (NE)". */
export function formatCourse(degrees: number | null | undefined, fallback = NO_DATA): string {
  const cardinal = courseToCardinal(degrees)
  return cardinal ? `${CARDINAL_NAMES[cardinal]} (${cardinal})` : fallback
}
