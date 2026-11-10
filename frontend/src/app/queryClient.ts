import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

// Server state cache (ARQ-10). UI state stays in components; server data lives here.

/**
 * 4xx answers are final. Transport failures were already retried by the API client during a
 * cold start, so stacking more waits would only delay the error state. Other 5xx: one retry.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return false
    if (
      error.code === 'network_error' ||
      error.code === 'server_unavailable' ||
      error.code === 'invalid_response'
    ) {
      return false
    }
  }
  return failureCount < 1
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: shouldRetryQuery,
      },
      // Writes are never repeated automatically: their outcome could be unknown.
      mutations: { retry: false },
    },
  })
}
