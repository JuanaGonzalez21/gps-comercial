import { useId } from 'react'
import type { Track } from '@/api/types'
import { formatDateTime, formatNumber, formatSpeed } from '@/lib/format'
import { Alert } from '@/ui'
import { PlaybackControls } from './PlaybackControls'
import { SpeedChart } from './SpeedChart'
import { TrackMap } from './TrackMap'
import { formatDistance, formatDuration } from './timeRange'
import { usePlayback } from './usePlayback'

export interface TrackResultProps {
  track: Track
  reducedMotion: boolean
}

/**
 * A loaded route with points: map, playback, speed chart and statistics share one playback
 * position. Mount it with a key per track so the playback starts again for each query.
 */
export function TrackResult({ track, reducedMotion }: TrackResultProps) {
  const { points, stats } = track
  const playback = usePlayback(points.length)
  const statsTitleId = useId()
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return (
    <div className="track-result">
      {(stats.simplified || stats.truncated || points.length === 1) && (
        <div className="track-result__notices">
          {stats.simplified && (
            <Alert tone="info" title="Se simplificó el recorrido para mostrarlo con fluidez">
              El mapa dibuja {formatNumber(stats.returned_points)} de {formatNumber(stats.total_points)}{' '}
              puntos y conserva la forma de la ruta. La distancia y las velocidades se calculan con
              todos los puntos.
            </Alert>
          )}
          {stats.truncated && (
            <Alert tone="warning" title="El recorrido puede estar incompleto">
              Wialon tenía más mensajes de los que se cargan en una sola consulta. Acorta el rango de
              fechas para ver todo el detalle.
            </Alert>
          )}
          {points.length === 1 && (
            <Alert tone="info" title="Solo hay una posición en este rango">
              El vehículo reportó un único punto, por eso no hay recorrido que reproducir.
            </Alert>
          )}
        </div>
      )}

      <div className="track-result__body">
        <div className="track-result__main">
          <TrackMap points={points} currentIndex={playback.index} reducedMotion={reducedMotion} />
          <PlaybackControls
            points={points}
            index={playback.index}
            playing={playback.playing}
            speed={playback.speed}
            onToggle={playback.toggle}
            onSeek={playback.seek}
            onSpeedChange={playback.setSpeed}
          />
          <SpeedChart points={points} currentIndex={playback.index} onSeek={playback.seek} />
        </div>

        <section className="track-stats" aria-labelledby={statsTitleId}>
          <h3 id={statsTitleId} className="track-stats__title">
            Resumen del recorrido
          </h3>
          <dl className="track-stats__list">
            <div>
              <dt>Distancia</dt>
              <dd>{formatDistance(stats.distance_km)}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{formatDuration(stats.duration_s)}</dd>
            </div>
            <div>
              <dt>Velocidad máxima</dt>
              <dd>{formatSpeed(stats.max_speed_kmh)}</dd>
            </div>
            <div>
              <dt>Velocidad promedio</dt>
              <dd>{formatSpeed(stats.avg_speed_kmh)}</dd>
            </div>
            <div>
              <dt>Primera posición</dt>
              <dd>
                <time dateTime={firstPoint.recorded_at}>{formatDateTime(firstPoint.recorded_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Última posición</dt>
              <dd>
                <time dateTime={lastPoint.recorded_at}>{formatDateTime(lastPoint.recorded_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Puntos en el mapa</dt>
              <dd>
                {formatNumber(stats.returned_points)} de {formatNumber(stats.total_points)}
              </dd>
            </div>
          </dl>
          <p className="track-stats__note">
            Velocidad promedio de las posiciones reportadas. Horas en America/Bogota.
          </p>
        </section>
      </div>
    </div>
  )
}
