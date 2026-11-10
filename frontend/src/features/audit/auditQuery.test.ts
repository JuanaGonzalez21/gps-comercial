import { describe, expect, it } from 'vitest'
import { auditActionLabel } from './auditActions'
import {
  bogotaDayEndUtc,
  bogotaDayStartUtc,
  bogotaToday,
  buildAuditQuery,
  EMPTY_AUDIT_FILTERS,
} from './auditQuery'

describe('Bogota day boundaries', () => {
  it('maps a Bogota calendar day to UTC instants (UTC-05:00, inclusive end)', () => {
    expect(bogotaDayStartUtc('2026-11-01')).toBe('2026-11-01T05:00:00.000Z')
    expect(bogotaDayEndUtc('2026-11-09')).toBe('2026-11-10T04:59:59.999Z')
    // Month and year rollover.
    expect(bogotaDayEndUtc('2026-12-31')).toBe('2027-01-01T04:59:59.999Z')
  })

  it('rejects malformed or impossible dates', () => {
    expect(bogotaDayStartUtc('2026-02-31')).toBeNull()
    expect(bogotaDayStartUtc('09/11/2026')).toBeNull()
    expect(bogotaDayEndUtc('')).toBeNull()
  })

  it('knows that 22:00 in Bogota is still the same day there', () => {
    expect(bogotaToday(new Date('2026-11-10T03:00:00Z'))).toBe('2026-11-09')
    expect(bogotaToday(new Date('2026-11-10T05:00:00Z'))).toBe('2026-11-10')
  })
})

describe('buildAuditQuery', () => {
  it('omits empty filters and trims the actor', () => {
    const query = buildAuditQuery({ ...EMPTY_AUDIT_FILTERS, actor: '  ana  ' }, 2, 20)
    expect(query).toEqual({
      valid: true,
      params: {
        action: undefined,
        actor: 'ana',
        outcome: undefined,
        date_from: undefined,
        date_to: undefined,
        page: 2,
        page_size: 20,
      },
    })
  })

  it('accepts a single-day range and refuses an inverted one', () => {
    expect(buildAuditQuery({ ...EMPTY_AUDIT_FILTERS, dateFrom: '2026-11-09', dateTo: '2026-11-09' }, 1, 20).valid).toBe(
      true,
    )
    expect(buildAuditQuery({ ...EMPTY_AUDIT_FILTERS, dateFrom: '2026-11-09', dateTo: '2026-11-08' }, 1, 20)).toEqual({
      valid: false,
      field: 'dateTo',
      message: 'La fecha final debe ser igual o posterior a la inicial.',
    })
  })
})

describe('auditActionLabel', () => {
  it('translates known actions and shows unknown codes as they are', () => {
    expect(auditActionLabel('passenger.custom_field.updated')).toBe('Campo de pasajero editado')
    expect(auditActionLabel('access.denied')).toBe('Acceso denegado')
    expect(auditActionLabel('something.new')).toBe('something.new')
  })
})
