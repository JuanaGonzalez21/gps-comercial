import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCookie, jsonResponse, mockFetch, problemResponse, setCookie, textResponse } from '@/test/http'
import { apiFetch, subscribeAuthEvents, type AuthEvent } from './client'
import { ApiError } from './errors'
import { isServerWaking } from './serverStatus'

const ME = { id: 'u1', email: 'a@b.co', full_name: 'A', role: { code: 'admin', name: 'Administrador' }, permissions: [], must_change_password: false }

describe('apiFetch', () => {
  beforeEach(() => setCookie('gc_csrf', 'csrf-123'))
  afterEach(() => {
    clearCookie('gc_csrf')
    vi.useRealTimers()
  })

  it('sends the CSRF header and JSON body on unsafe methods only', async () => {
    const { calls } = mockFetch(() => jsonResponse({ ok: true }))

    await apiFetch('/api/v1/drivers', { method: 'POST', body: { name: 'Luz' } })
    await apiFetch('/api/v1/vehicles', { query: { search: 'camion', status: undefined, has_driver: false } })

    expect(calls[0].headers.get('X-CSRF-Token')).toBe('csrf-123')
    expect(calls[0].headers.get('Content-Type')).toBe('application/json')
    expect(calls[0].body).toEqual({ name: 'Luz' })
    expect(calls[1].headers.get('X-CSRF-Token')).toBeNull()
    expect(calls[1].url).toBe('/api/v1/vehicles?search=camion&has_driver=false')
  })

  it('turns Problem Details into ApiError with field errors and Retry-After', async () => {
    mockFetch(() =>
      problemResponse(
        422,
        'validation_error',
        {
          detail: 'Revisa los campos marcados.',
          request_id: 'req-1',
          errors: [
            { field: 'name', message: 'Este campo es obligatorio.' },
            { field: 'name', message: 'Segundo mensaje ignorado.' },
            { field: 'phone', message: 'El formato no es válido.' },
          ],
        },
        { 'Retry-After': '30' },
      ),
    )

    const error = await apiFetch('/api/v1/drivers', { method: 'POST', body: {} }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_error',
      detail: 'Revisa los campos marcados.',
      requestId: 'req-1',
      retryAfterSeconds: 30,
      fieldErrors: { name: 'Este campo es obligatorio.', phone: 'El formato no es válido.' },
    })
  })

  it('shares one refresh between concurrent 401s and retries each request once', async () => {
    let vehiclesCalls = 0
    const { calls } = mockFetch(({ url }) => {
      if (url === '/api/v1/auth/refresh') return jsonResponse({ user: ME })
      vehiclesCalls += 1
      // The first two calls (one per request) find an expired access token.
      return vehiclesCalls <= 2 ? problemResponse(401, 'not_authenticated') : jsonResponse({ items: [] })
    })

    const [first, second] = await Promise.all([
      apiFetch('/api/v1/vehicles'),
      apiFetch('/api/v1/vehicles/positions'),
    ])

    expect(first).toEqual({ items: [] })
    expect(second).toEqual({ items: [] })
    const refreshCalls = calls.filter((call) => call.url === '/api/v1/auth/refresh')
    expect(refreshCalls).toHaveLength(1)
    expect(refreshCalls[0].method).toBe('POST')
    expect(refreshCalls[0].headers.get('X-CSRF-Token')).toBe('csrf-123')
    expect(calls).toHaveLength(5)
  })

  it('reports an expired session when the refresh is rejected', async () => {
    const events: AuthEvent[] = []
    const unsubscribe = subscribeAuthEvents((event) => events.push(event))
    mockFetch(({ url }) =>
      url === '/api/v1/auth/refresh'
        ? problemResponse(401, 'not_authenticated')
        : problemResponse(401, 'not_authenticated'),
    )

    await expect(apiFetch('/api/v1/vehicles')).rejects.toMatchObject({ status: 401 })

    expect(events).toEqual([{ type: 'session_expired' }])
    unsubscribe()
  })

  it('never tries to refresh on a failed login', async () => {
    const { calls } = mockFetch(() => problemResponse(401, 'invalid_credentials'))

    await expect(
      apiFetch('/api/v1/auth/login', { method: 'POST', body: { email: 'a@b.co', password: 'x' } }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(calls).toHaveLength(1)
  })

  it('announces password_change_required to the auth layer', async () => {
    const events: AuthEvent[] = []
    const unsubscribe = subscribeAuthEvents((event) => events.push(event))
    mockFetch(() => problemResponse(403, 'password_change_required'))

    await expect(apiFetch('/api/v1/vehicles')).rejects.toMatchObject({ code: 'password_change_required' })
    expect(events).toEqual([{ type: 'password_change_required' }])
    unsubscribe()
  })

  it('retries a GET while the server is starting (non-JSON 503) and shows the banner', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const { calls } = mockFetch(() => {
      attempts += 1
      return attempts === 1 ? textResponse('<html>waking up</html>', 503) : jsonResponse({ status: 'ok' })
    })

    const pending = apiFetch('/health')
    await vi.advanceTimersByTimeAsync(0)
    expect(isServerWaking()).toBe(true)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toEqual({ status: 'ok' })
    expect(calls).toHaveLength(2)
    expect(isServerWaking()).toBe(false)
  })

  it('gives up on a GET after the cold-start budget with a clear error', async () => {
    vi.useFakeTimers()
    const { calls } = mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const pending = apiFetch('/api/v1/vehicles').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(151_000)

    const error = await pending
    expect(error).toMatchObject({ status: 0, code: 'server_unavailable' })
    // 1 + 7 retries (waits of 1, 2, 4, 8, 16, 32, 64 s) + one last try at the 150 s mark.
    expect(calls.length).toBe(9)
    expect(isServerWaking()).toBe(false)
  })

  it('never retries a POST, even when the server looks asleep', async () => {
    const { calls } = mockFetch(() => textResponse('<html>waking up</html>', 503))

    await expect(apiFetch('/api/v1/drivers', { method: 'POST', body: { name: 'Luz' } })).rejects.toMatchObject({
      status: 503,
      code: 'server_unavailable',
    })
    expect(calls).toHaveLength(1)
  })

  it('warns that a write without answer may have been applied', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await apiFetch('/api/v1/drivers', { method: 'DELETE' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 0, code: 'network_error' })
    expect((error as ApiError).detail).toMatch(/pudo no completarse|no se haya completado/)
  })

  it('does not treat our own 503 Problem Details (Wialon down) as a cold start', async () => {
    const { calls } = mockFetch(() =>
      problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no responde.' }),
    )

    await expect(apiFetch('/api/v1/vehicles')).rejects.toMatchObject({
      status: 503,
      code: 'upstream_unavailable',
      detail: 'Wialon no responde.',
    })
    expect(calls).toHaveLength(1)
  })
})
