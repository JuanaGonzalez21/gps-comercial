import { apiFetch } from './client'
import type { AuthResponse, ChangePasswordInput, LoginInput, Me } from './types'

// Auth endpoints (docs/api-contract.md §4 and §7). Session state lives in AuthProvider, not in
// TanStack Query: guards need a synchronous status and the session is not shared server data.

const AUTH_PATH = '/api/v1/auth'

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(`${AUTH_PATH}/login`, { method: 'POST', body: input })
}

export function logout(): Promise<void> {
  return apiFetch<void>(`${AUTH_PATH}/logout`, { method: 'POST' })
}

export function fetchMe(signal?: AbortSignal): Promise<Me> {
  return apiFetch<Me>(`${AUTH_PATH}/me`, { signal })
}

export function changePassword(input: ChangePasswordInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(`${AUTH_PATH}/change-password`, { method: 'POST', body: input })
}
