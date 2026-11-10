import { vi } from 'vitest'
import type { Me, Permission } from '@/api/types'

// Test helpers: fake HTTP answers shaped like the backend contract (docs/api-contract.md §6–7).

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function problemResponse(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(
    { type: 'about:blank', title: 'Error', status, detail: 'Detalle del servidor.', code, errors: null, ...extra },
    status,
    { 'Content-Type': 'application/problem+json', ...headers },
  )
}

export function textResponse(body: string, status: number, contentType = 'text/html'): Response {
  return new Response(body, { status, headers: { 'Content-Type': contentType } })
}

export interface FetchCall {
  url: string
  method: string
  headers: Headers
  body: unknown
}

type Handler = (call: FetchCall) => Response | Promise<Response>

/**
 * Replaces global fetch with a router: `handler` receives the parsed request and returns a fresh
 * Response (bodies can only be read once). Every call is recorded for assertions.
 */
export function mockFetch(handler: Handler) {
  const calls: FetchCall[] = []
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    return handler(call)
  })
  return { spy, calls }
}

export function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/`
}

export function clearCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

const ALL_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'vehicles:read',
  'drivers:read',
  'passengers:read',
  'history:read',
  'drivers:write',
  'passengers:write',
  'assignments:write',
  'vehicles:custom_fields:write',
  'exports:csv',
  'users:manage',
  'audit:read',
]

export const VIEWER_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'vehicles:read',
  'drivers:read',
  'passengers:read',
  'history:read',
]

export function makeUser(overrides: Partial<Me> = {}): Me {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'ana.perez@example.com',
    full_name: 'Ana Pérez',
    role: { code: 'admin', name: 'Administrador' },
    permissions: ALL_PERMISSIONS,
    must_change_password: false,
    ...overrides,
  }
}
