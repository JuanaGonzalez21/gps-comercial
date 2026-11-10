import type { VehicleSummary } from '@/api/types'
import { formatDateTime, formatNumber, formatRelative, formatSpeed } from '@/lib/format'
import { Button, LinkButton, MapIcon, Skeleton, StatusBadge } from '@/ui'

interface VehicleCardListProps {
  items: readonly VehicleSummary[]
  selectedId: number | null
  onShowOnMap: (id: number) => void
  registerRow: (id: number, element: HTMLElement | null) => void
}

/** Small screens (UX-01): one readable card per vehicle instead of a squeezed table. */
export function VehicleCardList({ items, selectedId, onShowOnMap, registerRow }: VehicleCardListProps) {
  return (
    <ul className="vehicle-cards" role="list">
      {items.map((vehicle) => {
        const selected = vehicle.id === selectedId
        const titleId = `vehicle-card-${vehicle.id}`
        return (
          <li
            key={vehicle.id}
            ref={(element) => registerRow(vehicle.id, element)}
            className={selected ? 'vehicle-card is-selected' : 'vehicle-card'}
            aria-current={selected ? 'true' : undefined}
          >
            <article aria-labelledby={titleId}>
              <div className="vehicle-card__header">
                <h3 id={titleId} className="vehicle-card__name">
                  {vehicle.name}
                </h3>
                <StatusBadge status={vehicle.status} />
              </div>
              <dl className="vehicle-card__details">
                <div>
                  <dt>Conductor</dt>
                  <dd>{vehicle.driver ? vehicle.driver.name : 'Sin conductor asignado'}</dd>
                </div>
                <div>
                  <dt>Velocidad</dt>
                  <dd>{formatSpeed(vehicle.position?.speed_kmh)}</dd>
                </div>
                <div>
                  <dt>Pasajeros</dt>
                  <dd>{formatNumber(vehicle.passenger_count)}</dd>
                </div>
                <div>
                  <dt>Última actualización</dt>
                  <dd>
                    {vehicle.last_message_at
                      ? `${formatDateTime(vehicle.last_message_at)} · ${formatRelative(vehicle.last_message_at)}`
                      : 'Sin dato'}
                  </dd>
                </div>
              </dl>
              <div className="vehicle-card__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<MapIcon />}
                  disabled={!vehicle.position}
                  onClick={() => onShowOnMap(vehicle.id)}
                >
                  Ver en el mapa
                </Button>
                <LinkButton size="sm" variant="ghost" to={`/app/vehicles/${vehicle.id}`}>
                  Detalle<span className="visually-hidden"> de {vehicle.name}</span>
                </LinkButton>
              </div>
              {!vehicle.position && (
                <p className="data-table__note">Sin posición válida para mostrar en el mapa.</p>
              )}
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
        <li key={index} className="vehicle-card">
          <div className="vehicle-card__header">
            <Skeleton width="8rem" height="1.25rem" />
            <Skeleton width="6.5rem" height="1.5rem" pill />
          </div>
          <div className="vehicle-card__details">
            <Skeleton width="70%" />
            <Skeleton width="50%" />
            <Skeleton width="80%" />
          </div>
        </li>
      ))}
    </ul>
  )
}
