import type { ProblemDetails } from './types'

/** Codes produced by the client itself, when no Problem Details came back from our API. */
export type ClientErrorCode = 'network_error' | 'server_unavailable' | 'invalid_response'

export interface ApiErrorInit {
  status: number
  code: string
  detail: string
  title?: string
  fieldErrors?: Record<string, string>
  requestId?: string | null
  retryAfterSeconds?: number | null
}

/**
 * Single error type for every failed API call (docs/api-contract.md §6 and §9).
 * `status` is 0 when the request never got an HTTP answer. `detail` is always a Spanish,
 * user-safe message: the backend's own text when present, otherwise a client fallback.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string
  readonly title: string
  readonly fieldErrors: Readonly<Record<string, string>>
  readonly requestId: string | null
  readonly retryAfterSeconds: number | null

  constructor(init: ApiErrorInit) {
    super(init.detail)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.detail = init.detail
    this.title = init.title ?? init.detail
    this.fieldErrors = init.fieldErrors ?? {}
    this.requestId = init.requestId ?? null
    this.retryAfterSeconds = init.retryAfterSeconds ?? null
  }
}

const FALLBACK_MESSAGES: Record<string, string> = {
  network_error: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  server_unavailable:
    'El servidor no respondió a tiempo. Puede estar iniciando; inténtalo de nuevo en unos segundos.',
  invalid_response: 'El servidor devolvió una respuesta inesperada. Inténtalo de nuevo.',
  validation_error: 'Revisa los campos marcados.',
  invalid_credentials: 'Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente.',
  not_authenticated: 'Tu sesión expiró. Inicia sesión de nuevo.',
  password_change_required: 'Debes cambiar tu contraseña antes de continuar.',
  forbidden: 'No tienes permiso para realizar esta acción.',
  csrf_failed: 'La solicitud fue rechazada por seguridad. Recarga la página e inténtalo de nuevo.',
  not_found: 'No encontramos el recurso solicitado.',
  conflict: 'La información cambió mientras trabajabas. Recarga los datos e inténtalo de nuevo.',
  rate_limited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  upstream_error: 'Wialon devolvió un error. Inténtalo de nuevo más tarde.',
  upstream_forbidden: 'La cuenta de Wialon no tiene permiso para esta operación.',
  upstream_unavailable: 'Wialon no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  upstream_not_configured: 'La integración con Wialon no está configurada.',
  internal_error: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
}

const GENERIC_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.'

// A write whose answer never arrived may or may not have been applied: say so (never auto-retry it).
const UNCERTAIN_WRITE_MESSAGE =
  'No recibimos respuesta del servidor. Es posible que la operación no se haya completado: revisa los datos antes de intentarlo de nuevo.'

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ProblemDetails>
  return typeof candidate.code === 'string' && typeof candidate.status === 'number'
}

export function problemToApiError(problem: ProblemDetails, retryAfterSeconds: number | null): ApiError {
  const fieldErrors: Record<string, string> = {}
  for (const item of problem.errors ?? []) {
    // Keep the first message per field: forms show one message at a time.
    if (item && typeof item.field === 'string' && !(item.field in fieldErrors)) {
      fieldErrors[item.field] = String(item.message)
    }
  }
  const detail =
    (typeof problem.detail === 'string' && problem.detail.trim()) ||
    FALLBACK_MESSAGES[problem.code] ||
    (typeof problem.title === 'string' && problem.title.trim()) ||
    GENERIC_MESSAGE
  return new ApiError({
    status: problem.status,
    code: problem.code,
    detail,
    title: typeof problem.title === 'string' ? problem.title : undefined,
    fieldErrors,
    requestId: problem.request_id ?? null,
    retryAfterSeconds,
  })
}

export function clientError(code: ClientErrorCode, status: number, unsafeMethod = false): ApiError {
  const detail = code === 'network_error' && unsafeMethod ? UNCERTAIN_WRITE_MESSAGE : FALLBACK_MESSAGES[code]
  return new ApiError({ status, code, detail })
}

/** User-facing Spanish message for any thrown value. */
export function getErrorMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (error instanceof ApiError) return error.detail
  return fallback
}

/** Parses a Retry-After header (seconds or HTTP date) into whole seconds. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds))
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000))
}
