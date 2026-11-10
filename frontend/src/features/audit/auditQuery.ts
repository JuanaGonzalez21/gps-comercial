import type { AuditListParams, AuditOutcome } from '@/api/types'

// Filters are typed as calendar days in Bogota and sent to the API as UTC instants (ISO-8601).
// Colombia keeps UTC-05:00 all year (no daylight saving time since 1993), so a fixed offset is exact.
const BOGOTA_OFFSET_HOURS = 5
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDay(day: string): [number, number, number] | null {
  const match = DAY_PATTERN.exec(day)
  if (!match) return null
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(Date.UTC(year, month - 1, date))
  // Rejects impossible dates such as 2026-02-31 (Date would roll them over).
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null
  }
  return [year, month, date]
}

/** "2026-11-01" (Bogota) -> "2026-11-01T05:00:00.000Z": the first instant of that day. */
export function bogotaDayStartUtc(day: string): string | null {
  const parts = parseDay(day)
  if (!parts) return null
  const [year, month, date] = parts
  return new Date(Date.UTC(year, month - 1, date, BOGOTA_OFFSET_HOURS)).toISOString()
}

/** "2026-11-09" (Bogota) -> "2026-11-10T04:59:59.999Z": the last instant of that day (inclusive). */
export function bogotaDayEndUtc(day: string): string | null {
  const parts = parseDay(day)
  if (!parts) return null
  const [year, month, date] = parts
  return new Date(Date.UTC(year, month - 1, date + 1, BOGOTA_OFFSET_HOURS) - 1).toISOString()
}

/** Today's calendar day in Bogota as YYYY-MM-DD (the max of the date inputs). */
export function bogotaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export interface AuditFilterValues {
  action: string
  actor: string
  outcome: AuditOutcome | ''
  dateFrom: string
  dateTo: string
}

export const EMPTY_AUDIT_FILTERS: AuditFilterValues = {
  action: '',
  actor: '',
  outcome: '',
  dateFrom: '',
  dateTo: '',
}

export const DATE_RANGE_ERROR = 'La fecha final debe ser igual o posterior a la inicial.'

export type AuditQuery =
  | { valid: true; params: AuditListParams }
  | { valid: false; field: 'dateTo'; message: string }

/** Builds the API query from what the user typed; an inverted range is reported, not sent. */
export function buildAuditQuery(values: AuditFilterValues, page: number, pageSize: number): AuditQuery {
  const dateFrom = values.dateFrom ? bogotaDayStartUtc(values.dateFrom) : null
  const dateTo = values.dateTo ? bogotaDayEndUtc(values.dateTo) : null
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { valid: false, field: 'dateTo', message: DATE_RANGE_ERROR }
  }
  const actor = values.actor.trim()
  return {
    valid: true,
    params: {
      action: values.action || undefined,
      actor: actor || undefined,
      outcome: values.outcome || undefined,
      date_from: dateFrom ?? undefined,
      date_to: dateTo ?? undefined,
      page,
      page_size: pageSize,
    },
  }
}
