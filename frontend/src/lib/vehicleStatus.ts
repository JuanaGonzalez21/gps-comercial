import type { VehicleStatus } from '@/api/types'

// The backend derives the status (docs/api-contract.md §2); the UI only names it.
// Labels are shared by the badge, the filters and the map markers so they never drift apart.

export const VEHICLE_STATUSES: readonly VehicleStatus[] = ['moving', 'stopped', 'no_signal']

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  moving: 'En movimiento',
  stopped: 'Detenido',
  no_signal: 'Sin señal',
}

export function isVehicleStatus(value: string): value is VehicleStatus {
  return (VEHICLE_STATUSES as readonly string[]).includes(value)
}
