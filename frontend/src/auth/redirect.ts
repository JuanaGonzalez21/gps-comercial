/** Router state sent to /login by the guards. */
export interface LoginRedirectState {
  /** Where the user was going; only in-app paths are honoured after login. */
  from?: { pathname: string; search?: string }
  /** Set after a voluntary logout, to confirm it on the login page. */
  loggedOut?: boolean
}

export const DEFAULT_APP_PATH = '/app/dashboard'

function asRedirectState(state: unknown): LoginRedirectState | null {
  return typeof state === 'object' && state !== null ? (state as LoginRedirectState) : null
}

/** Path to open after signing in. Anything outside /app falls back to the dashboard. */
export function getPostLoginPath(state: unknown): string {
  const from = asRedirectState(state)?.from
  if (from && typeof from.pathname === 'string' && from.pathname.startsWith('/app/')) {
    const search = typeof from.search === 'string' ? from.search : ''
    return `${from.pathname}${search}`
  }
  return DEFAULT_APP_PATH
}

export function wasLoggedOut(state: unknown): boolean {
  return asRedirectState(state)?.loggedOut === true
}
