import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { HealthStatus, SystemInfo } from './types'

export const systemKeys = {
  info: ['system', 'info'] as const,
  health: ['system', 'health'] as const,
}

export function fetchSystemInfo(signal?: AbortSignal): Promise<SystemInfo> {
  return apiFetch<SystemInfo>('/api/v1/system/info', { signal })
}

/** GET /health: wakes a sleeping backend; the client shows the "starting" banner meanwhile. */
export function pingHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health')
}

/** Where fleet data comes from. "fake" must be announced in the UI (never shown as real data). */
export function useSystemInfo(enabled: boolean) {
  return useQuery({
    queryKey: systemKeys.info,
    queryFn: ({ signal }) => fetchSystemInfo(signal),
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * Fire-and-forget wake-up call for public pages (landing, login). The abort signal is ignored on
 * purpose: leaving the page must not stop waking the server.
 */
export function useServerWakeUp() {
  return useQuery({
    queryKey: systemKeys.health,
    queryFn: () => pingHealth(),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
