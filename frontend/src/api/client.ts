import { API_BASE_URL } from '@/config'
import { ApiError, clientError, isProblemDetails, parseRetryAfter, problemToApiError } from './errors'
import {
  beginWaking,
  endWaking,
  isBackendPossiblyAsleep,
  markBackendAnswered,
} from './serverStatus'
import type { AuthResponse, Me } from './types'

// Centralised HTTP client (ARQ-09). Every API call goes through apiFetch, which adds the session
// cookies and the CSRF header, parses Problem Details into ApiError, renews the session once on
// 401 and waits for a sleeping backend on safe requests (DEP-04). No token is ever stored in JS.

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  method?: HttpMethod
  /** Query string values. undefined, null and '' are skipped; booleans become "true"/"false". */
  query?: object
  /** Serialised as JSON. */
  body?: unknown
  signal?: AbortSignal
}

export const CSRF_COOKIE = 'gc_csrf'
const CSRF_HEADER = 'X-CSRF-Token'
const REFRESH_PATH = '/api/v1/auth/refresh'
const REFRESH_LOCK = 'gps-comercial:auth-refresh'
// Login answers 401 for bad credentials, and refresh/logout must never trigger another refresh.
const NO_REFRESH_PATHS: ReadonlySet<string> = new Set([
  '/api/v1/auth/login',
  REFRESH_PATH,
  '/api/v1/auth/logout',
])
const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD'])
const GATEWAY_STATUSES: ReadonlySet<number> = new Set([502, 503, 504])

/** Cold-start budget for safe requests: waits of 1, 2, 4, 8... seconds, about 150 s in total. */
export const COLD_START_BUDGET_MS = 150_000
const FIRST_RETRY_DELAY_MS = 1_000
/** A request pending this long while the backend may be asleep shows the "starting" banner. */
export const SLOW_REQUEST_MS = 6_000

// ---------- Auth events (consumed by AuthProvider; the client never touches React state) ----------

export type AuthEvent =
  | { type: 'session_expired' }
  | { type: 'password_change_required' }
  | { type: 'session_refreshed'; user: Me }

type AuthListener = (event: AuthEvent) => void
const authListeners = new Set<AuthListener>()

export function subscribeAuthEvents(listener: AuthListener): () => void {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

function emitAuthEvent(event: AuthEvent): void {
  for (const listener of authListeners) listener(event)
}

// ---------- Cookies ----------

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName !== name) continue
    const value = rest.join('=')
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

/**
 * The readable CSRF cookie is issued with the session cookies: without it there is no session
 * worth asking about, so anonymous visitors do not trigger 401 requests on page load.
 */
export function hasSessionCookie(): boolean {
  return Boolean(readCookie(CSRF_COOKIE))
}

// ---------- Public entry point ----------

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const response = await send(path, method, options)
  if (response.ok) return readBody<T>(response, method)

  const error = await toApiError(response)
  if (error.status === 401 && error.code === 'not_authenticated' && !NO_REFRESH_PATHS.has(path)) {
    return retryAfterRefresh<T>(path, method, options, error)
  }
  throw reportAuthError(error)
}

async function retryAfterRefresh<T>(
  path: string,
  method: HttpMethod,
  options: ApiRequestOptions,
  original: ApiError,
): Promise<T> {
  const refresh = await refreshSession()
  if (refresh.outcome === 'failed') throw refresh.error
  if (refresh.outcome === 'rejected') {
    emitAuthEvent({ type: 'session_expired' })
    throw original
  }
  // Repeating once is safe even for writes: a 401 means the server rejected the request
  // before running it.
  const response = await send(path, method, options)
  if (response.ok) return readBody<T>(response, method)
  const error = await toApiError(response)
  if (error.status === 401) emitAuthEvent({ type: 'session_expired' })
  throw reportAuthError(error)
}

function reportAuthError(error: ApiError): ApiError {
  if (error.status === 403 && error.code === 'password_change_required') {
    emitAuthEvent({ type: 'password_change_required' })
  }
  return error
}

// ---------- Session refresh (single-flight) ----------

type RefreshResult =
  | { outcome: 'refreshed' }
  | { outcome: 'rejected' }
  | { outcome: 'failed'; error: ApiError }

let refreshInFlight: Promise<RefreshResult> | null = null

/**
 * Concurrent 401s share one refresh. The Web Locks API extends that to other tabs, because the
 * backend revokes the whole session when a rotated refresh token is presented twice.
 */
function refreshSession(): Promise<RefreshResult> {
  refreshInFlight ??= withRefreshLock(runRefresh).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

function withRefreshLock(task: () => Promise<RefreshResult>): Promise<RefreshResult> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? locks.request(REFRESH_LOCK, task) : task()
}

async function runRefresh(): Promise<RefreshResult> {
  // The refresh needs the CSRF header; without the cookie it would be rejected anyway.
  if (!hasSessionCookie()) return { outcome: 'rejected' }
  try {
    const response = await send(REFRESH_PATH, 'POST', {})
    if (response.ok) {
      const payload = await readBody<AuthResponse>(response, 'POST').catch(() => null)
      if (payload?.user) emitAuthEvent({ type: 'session_refreshed', user: payload.user })
      return { outcome: 'refreshed' }
    }
    const error = await toApiError(response)
    // 401/403 mean the session is over; anything else (network, 5xx) may be transient.
    return error.status === 401 || error.status === 403
      ? { outcome: 'rejected' }
      : { outcome: 'failed', error }
  } catch (error) {
    return {
      outcome: 'failed',
      error: error instanceof ApiError ? error : clientError('network_error', 0, true),
    }
  }
}

// ---------- Transport with cold-start handling ----------

type Attempt = { kind: 'response'; response: Response } | { kind: 'network' }

/**
 * Sends one logical request. Only GET/HEAD are retried, with exponential backoff, while the
 * answer looks like a sleeping backend. Writes are never repeated automatically: their outcome
 * would be unknown.
 */
async function send(path: string, method: HttpMethod, options: ApiRequestOptions): Promise<Response> {
  const url = buildUrl(path, options.query)
  const retryable = SAFE_METHODS.has(method)
  const deadline = Date.now() + COLD_START_BUDGET_MS
  let delay = FIRST_RETRY_DELAY_MS
  let retried = false
  let waking = false
  try {
    for (;;) {
      const attempt = await attemptFetch(url, buildInit(method, options))
      if (attempt.kind === 'response' && !(await isColdStartResponse(attempt.response, method))) {
        markBackendAnswered()
        return attempt.response
      }
      const remaining = deadline - Date.now()
      if (!retryable || remaining <= 0) {
        if (attempt.kind === 'response') return attempt.response
        throw clientError(retried ? 'server_unavailable' : 'network_error', 0, !retryable)
      }
      if (!waking) {
        waking = true
        beginWaking()
      }
      await sleep(Math.min(delay, remaining), options.signal)
      delay *= 2
      retried = true
    }
  } finally {
    if (waking) endWaking()
  }
}

async function attemptFetch(url: string, init: RequestInit): Promise<Attempt> {
  let slow = false
  // Through the hosting proxy a cold start often looks like a request that just hangs.
  const timer = isBackendPossiblyAsleep()
    ? setTimeout(() => {
        slow = true
        beginWaking()
      }, SLOW_REQUEST_MS)
    : undefined
  try {
    return { kind: 'response', response: await fetch(url, init) }
  } catch (error) {
    if (init.signal?.aborted) throw error // a cancellation is not a network failure
    return { kind: 'network' }
  } finally {
    clearTimeout(timer)
    if (slow) endWaking()
  }
}

async function isColdStartResponse(response: Response, method: HttpMethod): Promise<boolean> {
  const { status } = response
  if (status >= 400 && status < 500) return false // a definitive answer
  if (method === 'HEAD' || status === 204) return status >= 500 // no body to inspect
  // A non-JSON answer is a proxy or host page shown while the backend boots.
  if (!isJson(response)) return true
  // Our own Problem Details (for example Wialon unavailable) are real answers, not a cold start.
  if (GATEWAY_STATUSES.has(status)) return !isProblemDetails(await peekJson(response))
  return false
}

function buildInit(method: HttpMethod, options: ApiRequestOptions): RequestInit {
  const headers = new Headers({ Accept: 'application/json, application/problem+json' })
  let body: string | undefined
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }
  if (!SAFE_METHODS.has(method)) {
    // Double-submit CSRF token (SEG-11), read on every attempt because a refresh rotates it.
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers.set(CSRF_HEADER, csrf)
  }
  return { method, headers, body, credentials: 'include', signal: options.signal }
}

function buildUrl(path: string, query?: object): string {
  const base = `${API_BASE_URL}${path}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.append(key, String(value))
    }
  }
  const search = params.toString()
  return search ? `${base}?${search}` : base
}

async function readBody<T>(response: Response, method: HttpMethod): Promise<T> {
  if (response.status === 204 || method === 'HEAD') return undefined as T
  if (!isJson(response)) throw clientError('invalid_response', response.status)
  try {
    return (await response.json()) as T
  } catch {
    throw clientError('invalid_response', response.status)
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
  if (isJson(response)) {
    const body: unknown = await response.json().catch(() => null)
    if (isProblemDetails(body)) return problemToApiError(body, retryAfter)
  }
  return clientError(response.status >= 500 ? 'server_unavailable' : 'invalid_response', response.status)
}

function isJson(response: Response): boolean {
  return (response.headers.get('Content-Type') ?? '').toLowerCase().includes('json')
}

function peekJson(response: Response): Promise<unknown> {
  return response
    .clone()
    .json()
    .catch(() => null)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
