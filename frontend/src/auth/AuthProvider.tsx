import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { hasSessionCookie, subscribeAuthEvents } from '@/api/client'
import { isApiError } from '@/api/errors'
import type { Me, Permission } from '@/api/types'
import { SessionEndContext, type SessionEndReason } from './sessionEnd'
import { AuthContext, type AuthContextValue, type AuthStatus } from './useAuth'

interface AuthState {
  status: AuthStatus
  user: Me | null
  endReason: SessionEndReason
}

interface AuthProviderProps {
  children: ReactNode
  /** Called when the signed-in identity changes, to drop cached data of the previous user. */
  onSessionReset?: () => void
}

function initialState(): AuthState {
  // Without the readable CSRF cookie there is no session: skip the /auth/me round trip.
  return hasSessionCookie()
    ? { status: 'loading', user: null, endReason: null }
    : { status: 'anonymous', user: null, endReason: null }
}

/** Session state for the whole app (docs/api-contract.md §9). Tokens stay in HttpOnly cookies. */
export function AuthProvider({ children, onSessionReset }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState)
  // Latest callback without re-subscribing to client events when the parent re-renders.
  const onSessionResetRef = useRef(onSessionReset)
  useEffect(() => {
    onSessionResetRef.current = onSessionReset
  }, [onSessionReset])

  const endSession = useCallback((reason: SessionEndReason) => {
    onSessionResetRef.current?.()
    // Only a session the user actually had can "expire"; a failed bootstrap is just anonymous.
    setState((previous) => ({
      status: 'anonymous',
      user: null,
      endReason: reason === 'expired' && previous.status !== 'authenticated' ? null : reason,
    }))
  }, [])

  // Bootstrap: who is signed in? (the client renews an expired access token transparently)
  const initialStatus = useRef(state.status)
  useEffect(() => {
    if (initialStatus.current !== 'loading') return
    let active = true
    authApi
      .fetchMe()
      .then((user) => {
        if (active) setState({ status: 'authenticated', user, endReason: null })
      })
      .catch(() => {
        if (active) setState({ status: 'anonymous', user: null, endReason: null })
      })
    return () => {
      active = false
    }
  }, [])

  // Events raised by the API client while the app runs.
  useEffect(
    () =>
      subscribeAuthEvents((event) => {
        if (event.type === 'session_expired') {
          endSession('expired')
        } else if (event.type === 'password_change_required') {
          // The guard sends the user to /change-password as soon as the flag is set.
          setState((previous) =>
            previous.user
              ? { ...previous, user: { ...previous.user, must_change_password: true } }
              : previous,
          )
        } else if (event.type === 'session_refreshed') {
          setState((previous) =>
            previous.status === 'authenticated' ? { ...previous, user: event.user } : previous,
          )
        }
      }),
    [endSession],
  )

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login({ email, password })
    onSessionResetRef.current?.()
    setState({ status: 'authenticated', user, endReason: null })
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // 401 = the server already considers the session closed. Anything else must be reported:
      // pretending to be signed out while the cookies are still valid would be misleading.
      if (!(isApiError(error) && error.status === 401)) throw error
    }
    endSession('logout')
  }, [endSession])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { user } = await authApi.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    })
    setState({ status: 'authenticated', user, endReason: null })
    return user
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.fetchMe()
      setState({ status: 'authenticated', user, endReason: null })
    } catch (error) {
      if (isApiError(error) && error.status === 401) endSession('expired')
      else throw error
    }
  }, [endSession])

  const { status, user } = state
  const hasPermission = useCallback(
    (permission: Permission) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, changePassword, hasPermission, refreshUser }),
    [status, user, login, logout, changePassword, hasPermission, refreshUser],
  )

  return (
    <AuthContext value={value}>
      <SessionEndContext value={state.endReason}>{children}</SessionEndContext>
    </AuthContext>
  )
}
