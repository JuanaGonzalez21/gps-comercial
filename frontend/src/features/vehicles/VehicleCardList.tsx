import type { VehicleSummary } from '@/api/types'
import { formatSpeed } from '@/lib/format'
import { Button, MapIcon, Skeleton, StatusBadge } from '@/ui'
import { NoPositionBadge } from './NoPositionBadge'
import { VehicleDetailLink, VehicleLastUpdate } from './VehicleTable'

interface VehicleCardListProps {
  items: readonly VehicleSummary[]
  selectedId: number | null
  onShowOnMap: (id: number) => void
  registerRow: (id: number, element: HTMLElement | null) => void
}

/** Small screens (UX-01): one row-like card per vehicle instead of a squeezed table. */
export function VehicleCardList({ items, selectedId, onShowOnMap, registerRow }: VehicleCardListProps) {
  return (
    <ul className="vehicle-cards" role="list">
      {items.map((vehicle) => {
        const selected = vehicle.id === selectedId
        const titleId = `vehicle-card-${vehicle.id}`
        const speed = vehicle.position?.speed_kmh
        return (
          <li
            key={vehicle.id}
            ref={(element) => registerRow(vehicle.id, element)}
            className={selected ? 'vehicle-card is-selected' : 'vehicle-card'}
            aria-current={selected ? 'true' : undefined}
          >
            <article aria-labelledby={titleId}>
              <h3 id={titleId} className="vehicle-card__name">
                {vehicle.name}
              </h3>
              <p className="vehicle-card__badges">
                <StatusBadge status={vehicle.status} />
                {!vehicle.position && <NoPositionBadge />}
              </p>
              {speed !== null && speed !== undefined && (
                <p className="vehicle-list-note">
                  <span className="visually-hidden">Velocidad: </span>
                  {formatSpeed(speed)}
                </p>
              )}
              <p className="vehicle-card__driver">
                <span className="visually-hidden">Conductor: </span>
                {vehicle.driver ? (
                  vehicle.driver.name
                ) : (
                  <span className="vehicle-list-empty">Sin conductor</span>
                )}
              </p>
              <p>
                <span className="visually-hidden">Última actualización: </span>
                <VehicleLastUpdate at={vehicle.last_message_at} status={vehicle.status} />
              </p>
              {!vehicle.position && (
                <p className="vehicle-card__note">
                  Su último reporte no trae coordenadas válidas, por eso no aparece en el mapa.
                </p>
              )}
              <div className="vehicle-card__actions">
                {/* Only vehicles with a position can be located: no disabled, unexplained button. */}
                {vehicle.position && (
                  <Button
                    variant="secondary"
                    icon={<MapIcon />}
                    onClick={() => onShowOnMap(vehicle.id)}
                  >
                    Ver en el mapa{' '}<span className="visually-hidden">{vehicle.name}</span>
                  </Button>
                )}
                <VehicleDetailLink id={vehicle.id} name={vehicle.name} />
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}

export function VehicleCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="vehicle-cards" role="list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="vehicle-card vehicle-card--skeleton">
          <Skeleton width="10rem" height="1.25rem" />
          <Skeleton width="7rem" height="1.5rem" pill />
          <Skeleton width="60%" />
          <Skeleton width="45%" />
        </li>
      ))}
    </ul>
  )
}
