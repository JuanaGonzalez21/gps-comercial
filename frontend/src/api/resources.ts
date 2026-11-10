import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { isApiError } from './errors'
import type { ResourceOut } from './types'
import { vehicleKeys } from './vehicles'

// Wialon resources: the containers where drivers and passengers live. A driver or passenger is
// identified by the pair (resource_id, id), so the helpers shared by drivers.ts and passengers.ts
// (scoped paths and the views to refresh after a write) are kept here too.

/** Identifies a resource-scoped entity (driver or passenger). */
export interface ResourceScopedRef {
  resource_id: number
  id: number
}

export const resourceKeys = {
  all: ['resources'] as const,
}

/**
 * Query key prefixes of other views that display drivers or passengers: vehicle list/detail
 * (bound driver, passenger count) and the dashboard KPIs. Invalidating a prefix that has no
 * cached query is harmless.
 */
const RELATED_VIEW_KEYS: readonly (readonly string[])[] = [vehicleKeys.all, ['dashboard']]

export function fetchResources(signal?: AbortSignal): Promise<ResourceOut[]> {
  return apiFetch<ResourceOut[]>('/api/v1/resources', { signal })
}

/** Resources change rarely: keep them for a few minutes. Needs `drivers:read` on the server. */
export function useResources(enabled = true) {
  return useQuery({
    queryKey: resourceKeys.all,
    queryFn: ({ signal }) => fetchResources(signal),
    staleTime: 5 * 60_000,
    enabled,
  })
}

/** "/api/v1/drivers" + ref -> "/api/v1/drivers/{resource_id}/{id}". */
export function scopedPath(base: string, ref: ResourceScopedRef): string {
  return `${base}/${encodeURIComponent(ref.resource_id)}/${encodeURIComponent(ref.id)}`
}

/**
 * After a write, lists are re-read from the server (Wialon is the source of truth), also after a
 * failure: a 404/409 means the list is stale and a missing answer may hide an applied change.
 * Only a 422 is skipped, because the server rejected the input before touching Wialon.
 */
export function shouldResync(error: unknown): boolean {
  return !(isApiError(error) && error.code === 'validation_error')
}

/** Returns a function that refreshes the given keys plus the vehicle and dashboard views. */
export function useResyncFleetViews(ownKeys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient()
  return (error: unknown) => {
    if (!shouldResync(error)) return Promise.resolve()
    const keys = [...ownKeys, ...RELATED_VIEW_KEYS]
    return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))).then(
      () => undefined,
    )
  }
}
