import { useId } from 'react'
import type { TrackPoint } from '@/api/types'
import { formatCourse, formatNumber, formatSpeed, formatTime } from '@/lib/format'
import { Button, PauseIcon, PlayIcon } from '@/ui'
import { formatDateTimeSeconds } from './timeRange'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from './usePlayback'

export interface PlaybackControlsProps {
  points: readonly TrackPoint[]
  index: number
  playing: boolean
  speed: PlaybackSpeed
  onToggle: () => void
  onSeek: (index: number) => void
  onSpeedChange: (speed: PlaybackSpeed) => void
}

/** Play/pause, speed and a keyboard-accessible position slider, plus the current point in text. */
export function PlaybackControls({
  points,
  index,
  playing,
  speed,
  onToggle,
  onSeek,
  onSpeedChange,
}: PlaybackControlsProps) {
  const titleId = useId()
  const sliderId = useId()
  const last = points.length - 1
  const point = points[Math.min(index, last)]
  if (!point) return null
  const atEnd = index >= last && last > 0
  const canPlay = last > 0
  const label = playing ? 'Pausar' : atEnd ? 'Repetir' : 'Reproducir'
  const valueText = `${formatDateTimeSeconds(point.recorded_at)}, ${formatSpeed(point.speed_kmh)}`
  // Announced only when the playback state changes, never on every tick.
  const announcement = playing
    ? `Reproduciendo a velocidad x${speed}.`
    : atEnd
      ? 'Reproducción finalizada.'
      : ''

  return (
    <section className="playback" aria-labelledby={titleId}>
      <h3 id={titleId} className="playback__title">
        Reproducción
      </h3>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <div className="playback__bar">
        <Button
          className="playback__toggle"
          icon={playing ? <PauseIcon /> : <PlayIcon />}
          onClick={onToggle}
          disabled={!canPlay}
        >
          {label}
        </Button>
        <div className="playback__speeds" role="group" aria-label="Velocidad de reproducción">
          {PLAYBACK_SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              className="playback__speed"
              aria-pressed={option === speed}
              onClick={() => onSpeedChange(option)}
              disabled={!canPlay}
            >
              x{option}
            </button>
          ))}
        </div>
      </div>

      <div className="playback__scrubber">
        <label htmlFor={sliderId} className="playback__slider-label">
          Posición en el recorrido
        </label>
        <input
          id={sliderId}
          className="playback__slider"
          type="range"
          min={0}
          max={Math.max(0, last)}
          step={1}
          value={Math.min(index, last)}
          aria-valuetext={valueText}
          disabled={!canPlay}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div className="playback__ends" aria-hidden="true">
          <span>{formatTime(points[0].recorded_at)}</span>
          <span>{formatTime(points[last].recorded_at)}</span>
        </div>
      </div>

      <dl className="playback__current">
        <div>
          <dt>Fecha y hora</dt>
          <dd>
            <time dateTime={point.recorded_at}>{formatDateTimeSeconds(point.recorded_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Velocidad</dt>
          <dd>{formatSpeed(point.speed_kmh)}</dd>
        </div>
        <div>
          <dt>Rumbo</dt>
          <dd>{formatCourse(point.course_deg)}</dd>
        </div>
        <div>
          <dt>Punto</dt>
          <dd>
            {formatNumber(index + 1)} de {formatNumber(points.length)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
