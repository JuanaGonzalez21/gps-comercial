import { useId, useMemo, type MouseEvent } from 'react'
import type { TrackPoint } from '@/api/types'
import { formatDateTimeShort, formatNumber, formatSpeed, formatTime } from '@/lib/format'
import { Card } from '@/ui'
import { nearestIndex, niceSpeedMax, sampleIndices } from './speedScale'

// Speed over time, drawn as own SVG (no chart library). The plot stretches to its container
// (preserveAspectRatio="none" + non-scaling strokes) and the axis labels are HTML, so text keeps
// its size from 360 px to desktop. A vertical cursor follows the playback position; the part
// already played is filled in teal and the rest in a light tint, both outlined by the speed line.

const WIDTH = 1000
const HEIGHT = 200
const TABLE_ROWS = 24
const DAY_MS = 24 * 60 * 60 * 1000

export interface SpeedChartProps {
  points: readonly TrackPoint[]
  currentIndex: number
  /** Mouse shortcut to move the playback; keyboard users have the position slider. */
  onSeek: (index: number) => void
  /** Statistics from the API (all points, not only the simplified ones drawn here). */
  maxSpeedKmh: number | null
  avgSpeedKmh: number | null
}

function speedMeta(maxSpeedKmh: number | null, avgSpeedKmh: number | null): string {
  const parts = ['km/h']
  if (maxSpeedKmh !== null) parts.push(`máx. ${formatNumber(maxSpeedKmh)}`)
  if (avgSpeedKmh !== null) parts.push(`prom. ${formatNumber(avgSpeedKmh)}`)
  return parts.join(' · ')
}

export function SpeedChart({ points, currentIndex, onSeek, maxSpeedKmh, avgSpeedKmh }: SpeedChartProps) {
  const titleId = useId()
  // useId may contain characters that are not safe inside url(#…).
  const clipId = `speed-played-${useId().replace(/[^\w-]/g, '')}`
  const chart = useMemo(() => {
    const times = points.map((point) => new Date(point.recorded_at).getTime())
    const first = times[0] ?? 0
    const span = (times[times.length - 1] ?? 0) - first
    const xAt = (index: number) => {
      if (span > 0) return ((times[index] - first) / span) * WIDTH
      return points.length > 1 ? (index / (points.length - 1)) * WIDTH : WIDTH / 2
    }
    const speeds = points
      .map((point) => point.speed_kmh)
      .filter((speed): speed is number => speed !== null && Number.isFinite(speed))
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : null
    const axisMax = niceSpeedMax(maxSpeed ?? 0)
    const yAt = (speed: number) => HEIGHT - (Math.max(0, speed) / axisMax) * HEIGHT

    // Points without speed break the line instead of being drawn as 0 km/h.
    let line = ''
    let area = ''
    let segment: Array<[number, number]> = []
    const flush = () => {
      if (segment.length === 0) return
      line += segment.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
      const [startX] = segment[0]
      const [endX] = segment[segment.length - 1]
      area += `M${startX.toFixed(1)} ${HEIGHT}${segment
        .map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`)
        .join('')}L${endX.toFixed(1)} ${HEIGHT}Z`
      segment = []
    }
    points.forEach((point, index) => {
      if (point.speed_kmh === null || !Number.isFinite(point.speed_kmh)) flush()
      else segment.push([xAt(index), yAt(point.speed_kmh)])
    })
    flush()
    return { times, first, span, xAt, maxSpeed, axisMax, line, area }
  }, [points])

  if (points.length === 0) return null
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const middlePoint = points[nearestIndex(chart.times, chart.first + chart.span / 2)]
  const formatAxisTime = chart.span > DAY_MS ? formatDateTimeShort : formatTime
  const cursorX = chart.xAt(Math.min(currentIndex, points.length - 1))

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || points.length < 2) return
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    if (chart.span > 0) onSeek(nearestIndex(chart.times, chart.first + fraction * chart.span))
    else onSeek(Math.round(fraction * (points.length - 1)))
  }

  const summary =
    chart.maxSpeed === null
      ? `Sin datos de velocidad entre ${formatTime(firstPoint.recorded_at)} y ${formatTime(lastPoint.recorded_at)}.`
      : `Velocidad entre ${formatTime(firstPoint.recorded_at)} y ${formatTime(lastPoint.recorded_at)}; ` +
        `máxima ${formatSpeed(chart.maxSpeed)}. La línea vertical marca la posición de la reproducción.`

  return (
    <Card as="section" padded={false} className="track-card speed-chart" aria-labelledby={titleId}>
      <div className="speed-chart__head">
        <h3 id={titleId} className="card-title">
          Velocidad en el tiempo
        </h3>
        <p className="card-meta">{speedMeta(maxSpeedKmh, avgSpeedKmh)}</p>
      </div>
      {chart.maxSpeed === null ? (
        <p className="speed-chart__empty">Wialon no reportó velocidad para los puntos de este rango.</p>
      ) : (
        <div className="speed-chart__frame">
          <div className="speed-chart__y-axis" aria-hidden="true">
            <span>{formatNumber(chart.axisMax)}</span>
            <span>{formatNumber(chart.axisMax / 2)}</span>
            <span>0</span>
          </div>
          <div className="speed-chart__plot">
            <svg
              className="speed-chart__svg"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={summary}
              onClick={handleClick}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={0} width={Math.max(0, cursorX)} height={HEIGHT} />
                </clipPath>
              </defs>
              {[0, 0.5].map((fraction) => (
                <line
                  key={fraction}
                  className="speed-chart__grid"
                  x1={0}
                  x2={WIDTH}
                  y1={HEIGHT * fraction}
                  y2={HEIGHT * fraction}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path className="speed-chart__area" d={chart.area} />
              <path className="speed-chart__area speed-chart__area--played" d={chart.area} clipPath={`url(#${clipId})`} />
              <path className="speed-chart__line" d={chart.line} vectorEffect="non-scaling-stroke" />
              <line
                className="speed-chart__cursor"
                data-testid="speed-chart-cursor"
                x1={cursorX}
                x2={cursorX}
                y1={0}
                y2={HEIGHT}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="speed-chart__x-axis" aria-hidden="true">
              <span>{formatAxisTime(firstPoint.recorded_at)}</span>
              {points.length > 2 && <span>{formatAxisTime(middlePoint.recorded_at)}</span>}
              <span>{formatAxisTime(lastPoint.recorded_at)}</span>
            </div>
          </div>
        </div>
      )}
      <details className="speed-chart__details">
        <summary>Ver la velocidad en una tabla</summary>
        <div className="speed-chart__table-wrap">
          <table className="history-table">
            <caption className="visually-hidden">
              Velocidad registrada a lo largo del recorrido (muestra de {Math.min(points.length, TABLE_ROWS)}{' '}
              puntos)
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Velocidad</th>
              </tr>
            </thead>
            <tbody>
              {sampleIndices(points.length, TABLE_ROWS).map((index) => (
                <tr key={index}>
                  <td>{formatDateTimeShort(points[index].recorded_at)}</td>
                  <td>{formatSpeed(points[index].speed_kmh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}
