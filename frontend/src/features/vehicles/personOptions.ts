import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { driverKeys, fetchDrivers, type DriverQueryParams } from '@/api/drivers'
import { fetchPassengers, passengerKeys, type PassengerQueryParams } from '@/api/passengers'

/** Largest page the API serves; a search narrows longer lists. */
export const PERSON_OPTIONS_LIMIT = 100

/** Drivers for the "Asignar conductor" dialog of a vehicle, searched on the server. */
export function useDriverOptions(search: string) {
  const params: DriverQueryParams = {
    search: search || undefined,
    sort: 'name',
    page: 1,
    page_size: PERSON_OPTIONS_LIMIT,
  }
  return useQuery({
    queryKey: driverKeys.list(params),
    queryFn: ({ signal }) => fetchDrivers(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Passengers for the "Asignar pasajero" dialog of a vehicle, searched on the server. */
export function usePassengerOptions(search: string) {
  const params: PassengerQueryParams = {
    search: search || undefined,
    sort: 'name',
    page: 1,
    page_size: PERSON_OPTIONS_LIMIT,
  }
  return useQuery({
    queryKey: passengerKeys.list(params),
    queryFn: ({ signal }) => fetchPassengers(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
