import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import { scopedPath, useResyncFleetViews, type ResourceScopedRef } from './resources'
import type { AssignmentInput, DriverInput, DriverListParams, DriverOut, Page } from './types'

// Drivers (RF-16, RF-17, RF-18). They are stored in Wialon; the backend validates again, checks
// `drivers:write` / `assignments:write` and audits every change.

/** Sort keys accepted by GET /drivers (backend/app/api/v1/drivers.py). */
export type DriverSort = 'name' | '-name'

export interface DriverQueryParams extends DriverListParams {
  sort?: DriverSort
}

/** PUT body: every editable attribute is sent, so a blank value (null) clears it in Wialon. */
export type DriverUpdateInput = Omit<DriverInput, 'resource_id'>

const BASE = '/api/v1/drivers'

export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (params: DriverQueryParams) => [...driverKeys.lists(), params] as const,
}

export function fetchDrivers(params: DriverQueryParams, signal?: AbortSignal): Promise<Page<DriverOut>> {
  return apiFetch<Page<DriverOut>>(BASE, { query: params, signal })
}

export function createDriver(input: DriverInput): Promise<DriverOut> {
  return apiFetch<DriverOut>(BASE, { method: 'POST', body: input })
}

export function updateDriver(ref: ResourceScopedRef, input: DriverUpdateInput): Promise<DriverOut> {
  return apiFetch<DriverOut>(scopedPath(BASE, ref), { method: 'PUT', body: input })
}

export function deleteDriver(ref: ResourceScopedRef): Promise<void> {
  return apiFetch<void>(scopedPath(BASE, ref), { method: 'DELETE' })
}

/** Binds the driver to a vehicle; the backend waits until Wialon confirms it (a few seconds). */
export function assignDriver(ref: ResourceScopedRef, unitId: number): Promise<DriverOut> {
  const body: AssignmentInput = { unit_id: unitId }
  return apiFetch<DriverOut>(`${scopedPath(BASE, ref)}/assignment`, { method: 'PUT', body })
}

export function unassignDriver(ref: ResourceScopedRef): Promise<DriverOut> {
  return apiFetch<DriverOut>(`${scopedPath(BASE, ref)}/assignment`, { method: 'DELETE' })
}

/** Server-side search, assignment filter, sort and paging. */
export function useDrivers(params: DriverQueryParams) {
  return useQuery({
    queryKey: driverKeys.list(params),
    queryFn: ({ signal }) => fetchDrivers(params, signal),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

// Mutations are never retried automatically (an unanswered write may have been applied).
// `onSettled` re-reads the lists, also after a failure, so the screen shows what Wialon has.

function useResyncDrivers() {
  return useResyncFleetViews([driverKeys.all])
}

export function useCreateDriver() {
  const resync = useResyncDrivers()
  return useMutation({
    mutationFn: createDriver,
    onSettled: (_data, error) => resync(error),
  })
}

export function useUpdateDriver() {
  const resync = useResyncDrivers()
  return useMutation({
    mutationFn: ({ ref, input }: { ref: ResourceScopedRef; input: DriverUpdateInput }) =>
      updateDriver(ref, input),
    onSettled: (_data, error) => resync(error),
  })
}

export function useDeleteDriver() {
  const resync = useResyncDrivers()
  return useMutation({
    mutationFn: deleteDriver,
    onSettled: (_data, error) => resync(error),
  })
}

export function useAssignDriver() {
  const resync = useResyncDrivers()
  return useMutation({
    mutationFn: ({ ref, unitId }: { ref: ResourceScopedRef; unitId: number }) => assignDriver(ref, unitId),
    onSettled: (_data, error) => resync(error),
  })
}

export function useUnassignDriver() {
  const resync = useResyncDrivers()
  return useMutation({
    mutationFn: unassignDriver,
    onSettled: (_data, error) => resync(error),
  })
}
