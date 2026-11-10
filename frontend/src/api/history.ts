import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Page, Track, TrackParams, VehicleDetail, VehicleSummary } from './types'
import { fetchVehicles } from './vehicles'

/** Points the backend returns after its RDP simplification (accepted range 100–5000). */
export const TRACK_MAX_POINTS = 2_000
/** GET /vehicles accepts page_size up to 100: enough for the selector, search narrows the rest. */
export const VEHICLE_OPTIONS_LIMIT = 100

/** A submitted history query: vehicle and an ISO-8601 UTC range. */
export interface TrackRequest {
  vehicleId: number
  from: string
  to: string
}

export const historyKeys = {
  all: ['history'] as const,
  track: (request: TrackRequest | null) =>
    [...historyKeys.all, 'track', request?.vehicleId, request?.from, request?.to] as const,
  vehicleOptions: (search: string) => [...historyKeys.all, 'vehicle-options', search] as const,
  vehicle: (id: number | null) => [...historyKeys.all, 'vehicle', id] as const,
}

export function fetchVehicleTrack(
  vehicleId: number,
  params: TrackParams,
  signal?: AbortSignal,
): Promise<Track> {
  return apiFetch<Track>(`/api/v1/vehicles/${vehicleId}/track`, { query: params, signal })
}

export function fetchHistoryVehicle(id: number, signal?: AbortSignal): Promise<VehicleDetail> {
  return apiFetch<VehicleDetail>(`/api/v1/vehicles/${id}`, { signal })
}

/**
 * Route of one vehicle in a range (RF-24). Only runs once the user submits a valid range. A past
 * range does not change, so the answer stays fresh for a few minutes (no new Wialon load).
 */
export function useVehicleTrack(request: TrackRequest | null) {
  return useQuery({
    queryKey: historyKeys.track(request),
    queryFn: request
      ? ({ signal }) =>
          fetchVehicleTrack(
            request.vehicleId,
            { from: request.from, to: request.to, max_points: TRACK_MAX_POINTS },
            signal,
          )
      : skipToken,
    staleTime: 5 * 60_000,
  })
}

/** Vehicles for the history selector, searched on the server and sorted by name. */
export function useVehicleOptions(search: string) {
  return useQuery<Page<VehicleSummary>>({
    queryKey: historyKeys.vehicleOptions(search),
    queryFn: ({ signal }) =>
      fetchVehicles(
        { search: search || undefined, sort: 'name', page: 1, page_size: VEHICLE_OPTIONS_LIMIT },
        signal,
      ),
    // Keep the previous options while a new search loads (the select never empties abruptly).
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/** One vehicle by id: names a vehicle chosen through the URL (?vehicle=ID) or not yet listed. */
export function useHistoryVehicle(id: number | null) {
  return useQuery({
    queryKey: historyKeys.vehicle(id),
    queryFn: id === null ? skipToken : ({ signal }) => fetchHistoryVehicle(id, signal),
    staleTime: 60_000,
  })
}
