import type { ReactNode } from 'react'

// Placeholder from the shared skeleton: the signature is the contract, the behaviour is a no-op.
// Owner: ux-ui (frontend foundation), who replaces it with an accessible aria-live toast region.
export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
}

export interface ToastApi {
  show(options: ToastOptions): void
}

const noop: ToastApi = { show: () => undefined }

export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useToast(): ToastApi {
  return noop
}
