import { useId } from 'react'
import type { TrackPoint } from '@/api/types'
import { formatCourse, formatNumber, formatSpeed } from '@/lib/format'
import { Button, PauseIcon, PlayIcon, SegmentedControl, type SegmentOption } from '@/ui'
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

type SpeedValue = `${PlaybackSpeed}`

const SPEED_OPTIONS: ReadonlyArray<SegmentOption<SpeedValue>> = PLAYBACK_SPEEDS.map((option) => ({
  value: `${option}`,
  label: `x${option}`,
}))

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
    <>
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
        {/* A single point has nothing to play: no speed choice. */}
        {canPlay && (
          <SegmentedControl
            size="sm"
            label="Velocidad de reproducción"
            options={SPEED_OPTIONS}
            value={`${speed}`}
            onChange={(value) => onSpeedChange(Number(value) as PlaybackSpeed)}
          />
        )}
        <label htmlFor={sliderId} className="visually-hidden">
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
      </div>

      <dl className="track-facts">
        <div className="track-facts__item track-facts__item--wide">
          <dt>Fecha y hora</dt>
          <dd>
            <time dateTime={point.recorded_at}>{formatDateTimeSeconds(point.recorded_at)}</time>
          </dd>
        </div>
        <div className="track-facts__item">
          <dt>Velocidad</dt>
          <dd>{formatSpeed(point.speed_kmh)}</dd>
        </div>
        <div className="track-facts__item">
          <dt>Rumbo</dt>
          <dd>{formatCourse(point.course_deg)}</dd>
        </div>
        <div className="track-facts__item">
          <dt>Punto</dt>
          <dd>
            {formatNumber(index + 1)} de {formatNumber(points.length)}
          </dd>
        </div>
      </dl>
    </>
  )
}
