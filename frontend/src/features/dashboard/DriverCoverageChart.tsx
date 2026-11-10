import { formatNumber } from '@/lib/format'
import { SteeringWheelIcon, UnlinkIcon } from '@/ui'
import { formatShare, share } from './chartMath'

export interface DriverCoverageChartProps {
  withDriver: number
  withoutDriver: number
}

/**
 * Vehicles with and without a bound driver (RF-13, RF-23) as a horizontal bar chart. It is a
 * real table with the values in text; each bar is a small own SVG under its label that repeats
 * the number visually (hidden from assistive tech, so nothing is read twice). Bars stay inside
 * the first column, so the table fits a 360 px screen.
 */
export function DriverCoverageChart({ withDriver, withoutDriver }: DriverCoverageChartProps) {
  const total = withDriver + withoutDriver
  const rows = [
    { key: 'with', label: 'Con conductor', count: withDriver, Icon: SteeringWheelIcon },
    { key: 'without', label: 'Sin conductor', count: withoutDriver, Icon: UnlinkIcon },
  ] as const

  return (
    <div className="coverage-chart">
      <p className="coverage-chart__headline">
        <span className="coverage-chart__headline-value">{formatShare(withDriver, total)}</span>
        <span>de los vehículos tiene un conductor vinculado en Wialon.</span>
      </p>
      <table className="dashboard-table coverage-chart__table">
        <caption className="visually-hidden">Vehículos con y sin conductor asignado</caption>
        <thead>
          <tr>
            <th scope="col">Asignación</th>
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
          {rows.map(({ key, label, count, Icon }) => (
            <tr key={key}>
              <th scope="row" className="coverage-chart__label-cell">
                <span className={`legend-label legend-label--${key}`}>
                  <Icon className="legend-label__icon" />
                  {label}
                </span>
                <svg
                  className="coverage-chart__bar"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect className="coverage-chart__bar-track" x={0} y={0} width={100} height={10} />
                  <rect
                    className={`coverage-chart__bar-value coverage-chart__bar-value--${key}`}
                    data-testid={`coverage-bar-${key}`}
                    x={0}
                    y={0}
                    width={share(count, total) * 100}
                    height={10}
                  />
                </svg>
              </th>
              <td className="dashboard-table__number">{formatNumber(count)}</td>
              <td className="dashboard-table__number">{formatShare(count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
