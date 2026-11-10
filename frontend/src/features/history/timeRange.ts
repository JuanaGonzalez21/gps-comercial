import { LOCALE, TIME_ZONE } from '@/lib/format'

// Date-time range of the history form. Users type wall-clock times in America/Bogota
// (<input type="datetime-local"> has no zone); the API receives ISO-8601 UTC instants.
// Conversions go through Intl with the zone name, so they never depend on the browser's zone.

export const MAX_RANGE_DAYS = 7
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
export const MAX_RANGE_MS = MAX_RANGE_DAYS * DAY_MS

const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

// en-US with numeric parts: formatToParts gives plain digits whatever the UI locale is.
const wallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function wallClock(date: Date): WallClock {
  const parts = wallClockFormatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  }
}

/** Zone offset at an instant: the wall clock read as if it were UTC, minus the instant. */
function zoneOffsetMs(epochMs: number): number {
  const wholeSeconds = Math.floor(epochMs / 1000) * 1000
  const clock = wallClock(new Date(wholeSeconds))
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
  return asUtc - wholeSeconds
}

function zonedToInstant(clock: WallClock): Date {
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
  // Second pass: correct in zones whose offset changes around that time (Bogota has no DST).
  const firstGuess = asUtc - zoneOffsetMs(asUtc)
  return new Date(asUtc - zoneOffsetMs(firstGuess))
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** "2026-11-09T08:00" read in Bogota -> the instant it denotes; null if malformed or impossible. */
export function parseZonedInput(value: string): Date | null {
  const match = INPUT_PATTERN.exec(value.trim())
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const second = Number(match[6] ?? 0)
  const probe = new Date(Date.UTC(year, month - 1, day))
  const validDate =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  if (!validDate || hour > 23 || minute > 59 || second > 59) return null
  return zonedToInstant({ year, month, day, hour, minute, second })
}

/** Instant -> "YYYY-MM-DDTHH:mm" in Bogota, the value format of datetime-local inputs. */
export function toZonedInput(date: Date): string {
  const clock = wallClock(date)
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}`
}

/** API format: ISO-8601 UTC with a Z suffix and no milliseconds ("2026-11-09T13:00:00Z"). */
export function toUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Parses an ISO instant from the URL. Only zone-qualified values are accepted (Z or ±hh:mm). */
export function parseIsoInstant(value: string | null): Date | null {
  if (!value || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time)
}

/** Midnight in Bogota of the calendar day that contains `date`. */
export function startOfZonedDay(date: Date): Date {
  const clock = wallClock(date)
  return zonedToInstant({ ...clock, hour: 0, minute: 0, second: 0 })
}

function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS)
}

export type RangePresetId = 'last_hour' | 'today' | 'yesterday' | 'last_24h'

export const RANGE_PRESETS: ReadonlyArray<{ id: RangePresetId; label: string }> = [
  { id: 'last_hour', label: 'Última hora' },
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'last_24h', label: 'Últimas 24 h' },
]

export interface DateRange {
  from: Date
  to: Date
}

/** Quick ranges, computed in Bogota. The inputs have minute precision, so "now" is floored. */
export function presetRange(id: RangePresetId, now: Date = new Date()): DateRange {
  const end = floorToMinute(now)
  switch (id) {
    case 'last_hour':
      return { from: new Date(end.getTime() - HOUR_MS), to: end }
    case 'last_24h':
      return { from: new Date(end.getTime() - DAY_MS), to: end }
    case 'today': {
      const from = startOfZonedDay(now)
      // Right at midnight "today" would be empty: keep at least one minute.
      return { from, to: new Date(Math.max(end.getTime(), from.getTime() + MINUTE_MS)) }
    }
    case 'yesterday': {
      const today = startOfZonedDay(now)
      return { from: startOfZonedDay(new Date(today.getTime() - HOUR_MS)), to: today }
    }
  }
}

export interface RangeIssue {
  field: 'from' | 'to'
  message: string
}

export type RangeValidation = { ok: true; range: DateRange } | { ok: false; issues: RangeIssue[] }

/** Same rules as the backend (from < to, at most 7 days), with field-level Spanish messages. */
export function validateRange(fromValue: string, toValue: string): RangeValidation {
  const issues: RangeIssue[] = []
  const from = fromValue.trim() ? parseZonedInput(fromValue) : null
  const to = toValue.trim() ? parseZonedInput(toValue) : null
  if (!fromValue.trim()) issues.push({ field: 'from', message: 'Indica la fecha y hora de inicio.' })
  else if (!from) issues.push({ field: 'from', message: 'Escribe una fecha y hora de inicio válidas.' })
  if (!toValue.trim()) issues.push({ field: 'to', message: 'Indica la fecha y hora de fin.' })
  else if (!to) issues.push({ field: 'to', message: 'Escribe una fecha y hora de fin válidas.' })
  if (from && to) {
    if (from.getTime() >= to.getTime()) {
      issues.push({ field: 'to', message: 'La fecha y hora de fin debe ser posterior a la de inicio.' })
    } else if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      issues.push({
        field: 'to',
        message: `El rango no puede superar ${MAX_RANGE_DAYS} días. Acorta las fechas.`,
      })
    }
  }
  return from && to && issues.length === 0 ? { ok: true, range: { from, to } } : { ok: false, issues }
}

const distanceFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** "1 h 05 min", "12 min", "45 s", "2 d 3 h". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return 'Sin dato'
  const seconds = Math.round(totalSeconds)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${pad(minutes % 60)} min`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}

/** "12,4 km". */
export function formatDistance(km: number): string {
  return Number.isFinite(km) ? `${distanceFormatter.format(Math.max(0, km))} km` : 'Sin dato'
}

const dateTimeSecondsFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** "9 nov 2026, 14:33:11" in Bogota: the playback position needs seconds. */
export function formatDateTimeSeconds(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin dato' : dateTimeSecondsFormatter.format(date)
}
