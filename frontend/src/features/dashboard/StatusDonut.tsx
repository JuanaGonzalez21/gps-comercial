import type { VehicleStatus } from '@/api/types'
import { formatNumber } from '@/lib/format'
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import { MovingIcon, NoSignalIcon, StoppedIcon } from '@/ui'
import { donutSegments, formatShare } from './chartMath'

const STATUS_ICONS = {
  moving: MovingIcon,
  stopped: StoppedIcon,
  no_signal: NoSignalIcon,
} as const

// Circumference 100 => stroke-dasharray values read as percentages.
const RADIUS = 100 / (2 * Math.PI)
const CENTER = 21

export interface StatusDonutProps {
  byStatus: Record<VehicleStatus, number>
  total: number
}

/**
 * Vehicles by derived status as a donut (own SVG). The SVG is labelled with a summary and the
 * legend is a real table with counts and percentages: the data never depends on colour alone.
 */
export function StatusDonut({ byStatus, total }: StatusDonutProps) {
  const segments = donutSegments(VEHICLE_STATUSES.map((status) => ({ key: status, count: byStatus[status] })))
  const summary =
    `Distribución de ${formatNumber(total)} vehículos por estado: ` +
    VEHICLE_STATUSES.map(
      (status) =>
        `${VEHICLE_STATUS_LABELS[status]} ${formatNumber(byStatus[status])} (${formatShare(byStatus[status], total)})`,
    ).join(', ') +
    '.'

  return (
    <div className="status-donut">
      <svg className="status-donut__svg" viewBox="0 0 42 42" role="img" aria-label={summary}>
        <circle className="status-donut__track" cx={CENTER} cy={CENTER} r={RADIUS} />
        {segments.map((segment) => (
          <circle
            key={segment.key}
            className={`status-donut__segment status-donut__segment--${segment.key}`}
            data-testid={`donut-segment-${segment.key}`}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            strokeDasharray={`${segment.length} ${100 - segment.length}`}
            strokeDashoffset={segment.offset}
          />
        ))}
        <text className="status-donut__value" x={CENTER} y={CENTER + 1} textAnchor="middle">
          {formatNumber(total)}
        </text>
        <text className="status-donut__caption" x={CENTER} y={CENTER + 6} textAnchor="middle">
          {total === 1 ? 'vehículo' : 'vehículos'}
        </text>
      </svg>

      <table className="dashboard-table">
        <caption className="visually-hidden">Vehículos por estado</caption>
        <thead>
          <tr>
            <th scope="col">Estado</th>
            <th scope="col" className="dashboard-table__number">
              Vehículos
            </th>
            <th scope="col" className="dashboard-table__number">
              <span aria-hidden="true">%</span>
              <span className="visually-hidden">Porcentaje</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {VEHICLE_STATUSES.map((status) => {
            const Icon = STATUS_ICONS[status]
            return (
              <tr key={status}>
                <th scope="row">
                  <span className={`legend-label legend-label--${status}`}>
                    <Icon className="legend-label__icon" />
                    {VEHICLE_STATUS_LABELS[status]}
                  </span>
                </th>
                <td className="dashboard-table__number">{formatNumber(byStatus[status])}</td>
                <td className="dashboard-table__number">{formatShare(byStatus[status], total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
