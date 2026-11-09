import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './useAuth'

// Placeholder from the shared skeleton: always anonymous. Owner: frontend data layer.
const anonymous: AuthContextValue = {
  status: 'anonymous',
  user: null,
  login: () => Promise.reject(new Error('Not implemented')),
  logout: () => Promise.resolve(),
  changePassword: () => Promise.reject(new Error('Not implemented')),
  hasPermission: () => false,
  refreshUser: () => Promise.resolve(),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext value={anonymous}>{children}</AuthContext>
}
