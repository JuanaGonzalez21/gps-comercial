import type { VehicleStatus } from '@/api/types'
import { VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import { MovingIcon, NoSignalIcon, StoppedIcon } from './icons'
import './status-badge.css'

const STATUS_ICONS = {
  moving: MovingIcon,
  stopped: StoppedIcon,
  no_signal: NoSignalIcon,
} as const

/** Vehicle status as icon + text + colour: never colour alone (UX-03). */
export function StatusBadge({ status }: { status: VehicleStatus }) {
  const Icon = STATUS_ICONS[status]
  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon className="status-badge__icon" />
      <span>{VEHICLE_STATUS_LABELS[status]}</span>
    </span>
  )
}
