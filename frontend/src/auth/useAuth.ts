import { createContext, useContext } from 'react'
import type { Me, Permission } from '@/api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

/** Contract shared by the auth layer and every screen (docs/api-contract.md §9). */
export interface AuthContextValue {
  status: AuthStatus
  user: Me | null
  login(email: string, password: string): Promise<Me>
  logout(): Promise<void>
  changePassword(currentPassword: string, newPassword: string): Promise<Me>
  hasPermission(permission: Permission): boolean
  refreshUser(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}
