import { createContext, useContext } from 'react'

/**
 * Why the last authenticated session ended. Route guards use it to pick the login redirect:
 * "expired" adds ?reason=expired, "logout" drops the return path. null = never signed in here.
 */
export type SessionEndReason = 'expired' | 'logout' | null

export const SessionEndContext = createContext<SessionEndReason>(null)

export function useSessionEndReason(): SessionEndReason {
  return useContext(SessionEndContext)
}
