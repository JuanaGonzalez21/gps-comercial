import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

describe('useAuth', () => {
  it('fails loudly outside the provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
  })

  it('exposes the auth contract inside the provider', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    expect(result.current.status).toBe('anonymous')
    expect(result.current.hasPermission('dashboard:read')).toBe(false)
  })
})
