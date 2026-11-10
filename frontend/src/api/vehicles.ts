import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  Page,
  VehicleListParams,
  VehiclePositions,
  VehiclePositionsParams,
  VehicleSummary,
} from './types'

/** Positions refresh without reloading the page (RF-14). TanStack pauses it while the tab is hidden. */
export const POSITIONS_REFRESH_MS = 15_000

export const vehicleKeys = {
  all: ['vehicles'] as const,
  lists: () => [...vehicleKeys.all, 'list'] as const,
  list: (params: VehicleListParams) => [...vehicleKeys.lists(), params] as const,
  positions: (params: VehiclePositionsParams) => [...vehicleKeys.all, 'positions', params] as const,
}

export function fetchVehicles(
  params: VehicleListParams,
  signal?: AbortSignal,
): Promise<Page<VehicleSummary>> {
  return apiFetch<Page<VehicleSummary>>('/api/v1/vehicles', { query: params, signal })
}

export function fetchVehiclePositions(
  params: VehiclePositionsParams,
  signal?: AbortSignal,
): Promise<VehiclePositions> {
  return apiFetch<VehiclePositions>('/api/v1/vehicles/positions', { query: params, signal })
}

/** Server-side search, filters, sort and paging (RF-10). */
export function useVehicles(params: VehicleListParams) {
  return useQuery({
    queryKey: vehicleKeys.list(params),
    queryFn: ({ signal }) => fetchVehicles(params, signal),
    // Keep the current page visible while the next one loads (no flash of empty table).
    placeholderData: keepPreviousData,
    // The table shows status and speed too: refresh it with the map so both stay consistent.
    refetchInterval: POSITIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

/** Every vehicle with a valid position, independent of the table page (RF-11). */
export function useVehiclePositions(params: VehiclePositionsParams) {
  return useQuery({
    queryKey: vehicleKeys.positions(params),
    queryFn: ({ signal }) => fetchVehiclePositions(params, signal),
    placeholderData: keepPreviousData,
    refetchInterval: POSITIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}
