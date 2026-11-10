import { QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useState, type ReactNode } from 'react'
import { AuthProvider } from '@/auth/AuthProvider'
import { ToastProvider } from '@/ui'
import { createQueryClient } from './queryClient'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  // A new identity (login, logout, expired session) must never see the previous user's data.
  const clearServerState = useCallback(() => queryClient.clear(), [queryClient])
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider onSessionReset={clearServerState}>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
