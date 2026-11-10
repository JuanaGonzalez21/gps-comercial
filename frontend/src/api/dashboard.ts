import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { DashboardSummary } from './types'

/**
 * KPIs refresh every 30 s without reloading the page. With refetchIntervalInBackground=false,
 * TanStack Query skips the interval while the tab is hidden and refetches when it is shown again.
 */
export const DASHBOARD_REFRESH_MS = 30_000

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
}

export function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/api/v1/dashboard/summary', { signal })
}

/** Fleet KPIs (RF-23). The backend derives every number; the UI only presents them. */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}
