import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiFetch } from '@/api/client'
import { clearCookie, jsonResponse, makeUser, mockFetch, problemResponse, setCookie } from '@/test/http'
import { AuthProvider } from './AuthProvider'
import { useSessionEndReason } from './sessionEnd'
import { useAuth } from './useAuth'

function useAuthAndReason() {
  return { auth: useAuth(), reason: useSessionEndReason() }
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('useAuth', () => {
  afterEach(() => clearCookie('gc_csrf'))

  it('fails loudly outside the provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
  })

  it('is anonymous without a session cookie and does not call the API', () => {
    const { calls } = mockFetch(() => jsonResponse({}))
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.status).toBe('anonymous')
    expect(result.current.hasPermission('dashboard:read')).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('restores the session from /auth/me when the cookie exists', async () => {
    setCookie('gc_csrf', 'csrf-1')
    const user = makeUser()
    mockFetch(({ url }) => (url === '/api/v1/auth/me' ? jsonResponse(user) : jsonResponse({})))

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.user?.email).toBe(user.email)
    expect(result.current.hasPermission('users:manage')).toBe(true)
  })

  it('logs in and exposes the permissions of the role', async () => {
    const viewer = makeUser({ role: { code: 'viewer', name: 'Visualizador' }, permissions: ['vehicles:read'] })
    mockFetch(() => jsonResponse({ user: viewer }))
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(() => result.current.login('ana.perez@example.com', 'Clave-Segura-2026'))

    expect(result.current.status).toBe('authenticated')
    expect(result.current.hasPermission('vehicles:read')).toBe(true)
    expect(result.current.hasPermission('users:manage')).toBe(false)
  })

  it('becomes anonymous with reason "expired" when the session cannot be renewed', async () => {
    setCookie('gc_csrf', 'csrf-1')
    let sessionAlive = true
    mockFetch(({ url }) => {
      if (url === '/api/v1/auth/me') return jsonResponse(makeUser())
      if (url === '/api/v1/auth/refresh') return problemResponse(401, 'not_authenticated')
      return sessionAlive ? jsonResponse({ items: [] }) : problemResponse(401, 'not_authenticated')
    })
    const { result } = renderHook(useAuthAndReason, { wrapper })
    await waitFor(() => expect(result.current.auth.status).toBe('authenticated'))

    sessionAlive = false
    await act(async () => {
      await apiFetch('/api/v1/vehicles').catch(() => undefined)
    })

    expect(result.current.auth.status).toBe('anonymous')
    expect(result.current.auth.user).toBeNull()
    expect(result.current.reason).toBe('expired')
  })

  it('logs out and records the reason', async () => {
    mockFetch(({ url }) =>
      url === '/api/v1/auth/logout' ? new Response(null, { status: 204 }) : jsonResponse({ user: makeUser() }),
    )
    const { result } = renderHook(useAuthAndReason, { wrapper })
    await act(() => result.current.auth.login('ana.perez@example.com', 'Clave-Segura-2026'))

    await act(() => result.current.auth.logout())

    expect(result.current.auth.status).toBe('anonymous')
    expect(result.current.reason).toBe('logout')
  })
})
