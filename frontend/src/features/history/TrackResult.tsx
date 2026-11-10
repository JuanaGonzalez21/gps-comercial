import { useId } from 'react'
import type { Track } from '@/api/types'
import { formatDateTime, formatNumber, formatSpeed } from '@/lib/format'
import { Alert, Card } from '@/ui'
import { PlaybackControls } from './PlaybackControls'
import { SpeedChart } from './SpeedChart'
import { TrackMap } from './TrackMap'
import { formatDistance, formatDuration } from './timeRange'
import { usePlayback } from './usePlayback'

export interface TrackResultProps {
  track: Track
  reducedMotion: boolean
}

/** Summary tile: short visible label ("Vel. máxima") with the full term for screen readers. */
function StatTile({
  label,
  fullLabel,
  value,
  tone = 'soft',
  size = 'lg',
}: {
  label: string
  fullLabel?: string
  value: string
  tone?: 'accent' | 'soft'
  size?: 'lg' | 'md'
}) {
  return (
    <div className={`track-tile track-tile--${tone} track-tile--${size}`}>
      <dt>
        {fullLabel ? (
          <>
            <span aria-hidden="true">{label}</span>
            <span className="visually-hidden">{fullLabel}</span>
          </>
        ) : (
          label
        )}
      </dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * A loaded route with points: map, playback, speed chart and statistics share one playback
 * position. Mount it with a key per track so the playback starts again for each query.
 */
export function TrackResult({ track, reducedMotion }: TrackResultProps) {
  const { points, stats } = track
  const playback = usePlayback(points.length)
  const mapTitleId = useId()
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
          <Card as="section" padded={false} className="track-card" aria-labelledby={mapTitleId}>
            <h3 id={mapTitleId} className="visually-hidden">
              Mapa y reproducción
            </h3>
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
          </Card>
          <SpeedChart
            points={points}
            currentIndex={playback.index}
            onSeek={playback.seek}
            maxSpeedKmh={stats.max_speed_kmh}
            avgSpeedKmh={stats.avg_speed_kmh}
          />
        </div>

        <Card as="section" padded={false} className="track-card track-stats" aria-labelledby={statsTitleId}>
          <h3 id={statsTitleId} className="card-title">
            Resumen del recorrido
          </h3>
          <dl className="track-stats__tiles">
            <StatTile label="Distancia" value={formatDistance(stats.distance_km)} tone="accent" />
            <StatTile label="Duración" value={formatDuration(stats.duration_s)} />
            <StatTile
              label="Vel. máxima"
              fullLabel="Velocidad máxima"
              value={formatSpeed(stats.max_speed_kmh)}
              size="md"
            />
            <StatTile
              label="Vel. promedio"
              fullLabel="Velocidad promedio"
              value={formatSpeed(stats.avg_speed_kmh)}
              size="md"
            />
          </dl>
          <dl className="track-stats__list">
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
            Velocidad promedio calculada con las posiciones reportadas. Horas en America/Bogota.
          </p>
        </Card>
      </div>
    </div>
  )
}
