import { Link } from 'react-router'
import type { VehicleSort, VehicleSummary } from '@/api/types'
import { formatDateTime, formatDateTimeShort, formatRelative, formatSpeed } from '@/lib/format'
import { ArrowDownIcon, ArrowUpIcon, Skeleton, SortIcon, StatusBadge } from '@/ui'
import { NoPositionBadge } from './NoPositionBadge'

type SortField = 'name' | 'status' | 'last_message_at'

const ASCENDING: Record<SortField, VehicleSort> = {
  name: 'name',
  status: 'status',
  last_message_at: 'last_message_at',
}
const DESCENDING: Record<SortField, VehicleSort> = {
  name: '-name',
  status: '-status',
  last_message_at: '-last_message_at',
}

const SORT_DESCRIPTIONS: Record<VehicleSort, string> = {
  name: 'nombre, de la A a la Z',
  '-name': 'nombre, de la Z a la A',
  status: 'estado',
  '-status': 'estado, orden inverso',
  last_message_at: 'última actualización, más antigua primero',
  '-last_message_at': 'última actualización, más reciente primero',
}

function SortableHeader({
  label,
  field,
  sort,
  onSort,
  descendingFirst = false,
}: {
  label: string
  field: SortField
  sort: VehicleSort
  onSort: (sort: VehicleSort) => void
  /** Dates read best newest first. */
  descendingFirst?: boolean
}) {
  const ascending = sort === ASCENDING[field]
  const descending = sort === DESCENDING[field]
  const next = ascending
    ? DESCENDING[field]
    : descending
      ? ASCENDING[field]
      : descendingFirst
        ? DESCENDING[field]
        : ASCENDING[field]
  const Icon = ascending ? ArrowUpIcon : descending ? ArrowDownIcon : SortIcon
  return (
    <th scope="col" aria-sort={ascending ? 'ascending' : descending ? 'descending' : 'none'}>
      <button type="button" className="sort-button" onClick={() => onSort(next)}>
        <span>{label}</span>
        <Icon className="sort-button__icon" />
      </button>
    </th>
  )
}

interface VehicleTableProps {
  items: readonly VehicleSummary[]
  selectedId: number | null
  onToggleSelect: (id: number) => void
  sort: VehicleSort
  onSortChange: (sort: VehicleSort) => void
  registerRow: (id: number, element: HTMLElement | null) => void
  busy: boolean
}

/**
 * Desktop and tablet list (UX-06): sortable headers, row selection synced with the map.
 * Four columns so the table fits next to the map (about 34rem at 1280 px): the detail link lives
 * in the name cell and the speed under the status. Passenger counts are in the cards and the
 * detail. Wider content (zoom, long names) still scrolls inside a focusable, named region.
 */
export function VehicleTable({
  items,
  selectedId,
  onToggleSelect,
  sort,
  onSortChange,
  registerRow,
  busy,
}: VehicleTableProps) {
  return (
    // Scrollable regions must be reachable by keyboard (tabIndex) and named.
    <div className="table-scroll" role="region" aria-label="Tabla de vehículos" tabIndex={0}>
      <table className="data-table vehicle-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">
          Vehículos ordenados por {SORT_DESCRIPTIONS[sort]}. Selecciona un nombre para ubicarlo en el
          mapa; los vehículos sin posición no aparecen en él.
        </caption>
        <thead>
          <tr>
            <SortableHeader label="Vehículo" field="name" sort={sort} onSort={onSortChange} />
            <SortableHeader label="Estado" field="status" sort={sort} onSort={onSortChange} />
            <th scope="col">Conductor</th>
            <SortableHeader
              label="Actualizado"
              field="last_message_at"
              sort={sort}
              onSort={onSortChange}
              descendingFirst
            />
          </tr>
        </thead>
        <tbody>
          {items.map((vehicle) => {
            const selected = vehicle.id === selectedId
            const speed = vehicle.position?.speed_kmh
            return (
              <tr
                key={vehicle.id}
                ref={(element) => registerRow(vehicle.id, element)}
                className={selected ? 'is-selected' : undefined}
              >
                <th scope="row" className="vehicle-table__name">
                  {vehicle.position ? (
                    <button
                      type="button"
                      className="row-select"
                      aria-pressed={selected}
                      onClick={() => onToggleSelect(vehicle.id)}
                    >
                      {vehicle.name}
                    </button>
                  ) : (
                    // Nothing to locate on the map: plain text instead of a dead "select" button.
                    <span className="row-name">{vehicle.name}</span>
                  )}
                  <span className="vehicle-table__links">
                    {!vehicle.position && <NoPositionBadge />}
                    <Link to={`/app/vehicles/${vehicle.id}`} className="table-link">
                      Ver detalle{' '}<span className="visually-hidden">de {vehicle.name}</span>
                    </Link>
                  </span>
                </th>
                <td>
                  <StatusBadge status={vehicle.status} />
                  {speed !== null && speed !== undefined && (
                    <span className="data-table__note">
                      <span className="visually-hidden">Velocidad: </span>
                      {formatSpeed(speed)}
                    </span>
                  )}
                </td>
                <td>
                  {vehicle.driver ? (
                    vehicle.driver.name
                  ) : (
                    <span className="muted-text">Sin conductor asignado</span>
                  )}
                </td>
                <td>
                  {vehicle.last_message_at ? (
                    <>
                      <time dateTime={vehicle.last_message_at} title={formatDateTime(vehicle.last_message_at)}>
                        {formatDateTimeShort(vehicle.last_message_at)}
                      </time>
                      <span className="data-table__note">{formatRelative(vehicle.last_message_at)}</span>
                    </>
                  ) : (
                    <span className="muted-text">Sin dato</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function VehicleTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="table-scroll" aria-hidden="true">
      <table className="data-table vehicle-table">
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index}>
              <td>
                <Skeleton width="9rem" />
              </td>
              <td>
                <Skeleton width="7rem" height="1.5rem" pill />
              </td>
              <td>
                <Skeleton width="8rem" />
              </td>
              <td>
                <Skeleton width="10rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
