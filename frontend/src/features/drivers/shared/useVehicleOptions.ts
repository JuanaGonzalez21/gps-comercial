import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { VehicleListParams } from '@/api/types'
import { fetchVehicles, vehicleKeys } from '@/api/vehicles'

/** Largest page the API serves; the demo account has about 60 vehicles. */
export const VEHICLE_OPTIONS_LIMIT = 100

/**
 * Vehicles for a select (assignment dialog, passenger filter), searched on the server by name.
 * No polling here: the list only needs names, not live positions.
 */
export function useVehicleOptions(search = '', enabled = true) {
  const params: VehicleListParams = {
    search: search || undefined,
    sort: 'name',
    page: 1,
    page_size: VEHICLE_OPTIONS_LIMIT,
  }
  return useQuery({
    queryKey: vehicleKeys.list(params),
    queryFn: ({ signal }) => fetchVehicles(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  })
}
