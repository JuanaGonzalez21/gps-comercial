import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import type { VehicleSort, VehicleStatus, VehicleSummary } from '@/api/types'
import { formatDateTime, formatDateTimeShort, formatRelative, formatSpeed } from '@/lib/format'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, Skeleton, SortIcon, StatusBadge } from '@/ui'
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

/* ---------- Pieces shared with the mobile cards ---------- */

/** 40 px chevron link to the detail; its accessible name says where it goes ("Ver detalle de …"). */
export function VehicleDetailLink({ id, name }: { id: number; name: string }) {
  return (
    <Link to={`/app/vehicles/${id}`} className="vehicle-detail-link">
      <ChevronRightIcon />
      <span className="visually-hidden">Ver detalle de {name}</span>
    </Link>
  )
}

/** Date of the last message and how long ago; the relative part turns red when there is no signal. */
export function VehicleLastUpdate({ at, status }: { at: string | null; status: VehicleStatus }) {
  if (!at) return <span className="vehicle-list-empty">Sin dato</span>
  const relativeClass =
    status === 'no_signal' ? 'vehicle-list-note vehicle-list-note--alert' : 'vehicle-list-note'
  return (
    <>
      <time dateTime={at} title={formatDateTime(at)} className="vehicle-list-time">
        {formatDateTimeShort(at)}
      </time>
      <span className={relativeClass}>{formatRelative(at)}</span>
    </>
  )
}

function SortableHeader({
  label,
  field,
  sort,
  onSort,
  className,
  descendingFirst = false,
}: {
  label: string
  field: SortField
  sort: VehicleSort
  onSort: (sort: VehicleSort) => void
  className: string
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
    <th
      scope="col"
      className={className}
      aria-sort={ascending ? 'ascending' : descending ? 'descending' : 'none'}
    >
      <button type="button" className="vehicle-table__sort" onClick={() => onSort(next)}>
        <span>{label}</span>
        <Icon className="vehicle-table__sort-icon" />
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
 * Desktop and tablet list (UX-06): sortable headers and selection synced with the map (RF-15).
 * Clicking a located row (or its name button, the keyboard path) selects it on the map; the chevron
 * opens the detail. Wider content (zoom) scrolls inside a focusable, named region.
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
  // Pointer shortcut for the whole row; links and buttons inside keep their own action.
  const selectFromRow = (event: MouseEvent<HTMLTableRowElement>, id: number) => {
    if (event.target instanceof Element && event.target.closest('a, button')) return
    onToggleSelect(id)
  }

  return (
    // Scrollable regions must be reachable by keyboard (tabIndex) and named.
    <div className="vehicle-table-scroll" role="region" aria-label="Tabla de vehículos" tabIndex={0}>
      <table className="vehicle-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">
          Vehículos ordenados por {SORT_DESCRIPTIONS[sort]}. Selecciona una fila o su nombre para ubicarlo en
          el mapa; los vehículos sin posición no aparecen en él.
        </caption>
        <thead>
          <tr>
            <SortableHeader
              label="Vehículo"
              field="name"
              sort={sort}
              onSort={onSortChange}
              className="vehicle-table__col-name"
            />
            <SortableHeader
              label="Estado"
              field="status"
              sort={sort}
              onSort={onSortChange}
              className="vehicle-table__col-status"
            />
            <th scope="col">Conductor</th>
            <SortableHeader
              label="Actualizado"
              field="last_message_at"
              sort={sort}
              onSort={onSortChange}
              className="vehicle-table__col-updated"
              descendingFirst
            />
            <th scope="col" className="vehicle-table__col-link">
              <span className="visually-hidden">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((vehicle) => {
            const selected = vehicle.id === selectedId
            const speed = vehicle.position?.speed_kmh
            const rowClass = [
              vehicle.position ? 'is-locatable' : '',
              selected ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <tr
                key={vehicle.id}
                ref={(element) => registerRow(vehicle.id, element)}
                className={rowClass || undefined}
                onClick={vehicle.position ? (event) => selectFromRow(event, vehicle.id) : undefined}
              >
                <th scope="row">
                  {vehicle.position ? (
                    <button
                      type="button"
                      className="vehicle-table__select"
                      aria-pressed={selected}
                      title={vehicle.name}
                      onClick={() => onToggleSelect(vehicle.id)}
                    >
                      {vehicle.name}
                    </button>
                  ) : (
                    // Nothing to locate on the map: plain text instead of a dead "select" button.
                    <>
                      <span className="vehicle-table__name" title={vehicle.name}>
                        {vehicle.name}
                      </span>
                      <NoPositionBadge />
                    </>
                  )}
                </th>
                <td>
                  <StatusBadge status={vehicle.status} />
                  {speed !== null && speed !== undefined && (
                    <span className="vehicle-list-note">
                      <span className="visually-hidden">Velocidad: </span>
                      {formatSpeed(speed)}
                    </span>
                  )}
                </td>
                <td>
                  {vehicle.driver ? (
                    <span className="vehicle-table__driver" title={vehicle.driver.name}>
                      {vehicle.driver.name}
                    </span>
                  ) : (
                    <span className="vehicle-list-empty">Sin conductor</span>
                  )}
                </td>
                <td>
                  <VehicleLastUpdate at={vehicle.last_message_at} status={vehicle.status} />
                </td>
                <td className="vehicle-table__link-cell">
                  <VehicleDetailLink id={vehicle.id} name={vehicle.name} />
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
    <div className="vehicle-table-scroll" aria-hidden="true">
      <table className="vehicle-table">
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index}>
              <td className="vehicle-table__col-name">
                <Skeleton width="9rem" />
              </td>
              <td className="vehicle-table__col-status">
                <Skeleton width="7rem" height="1.5rem" pill />
              </td>
              <td>
                <Skeleton width="8rem" />
              </td>
              <td className="vehicle-table__col-updated">
                <Skeleton width="6rem" />
              </td>
              <td className="vehicle-table__col-link" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
