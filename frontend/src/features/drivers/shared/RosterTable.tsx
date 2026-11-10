import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { VehicleRef } from '@/api/types'
import { ArrowDownIcon, ArrowUpIcon, Skeleton, TruckIcon } from '@/ui'
import type { NameSort } from './listState'

// Building blocks shared by the drivers and passengers lists: sortable name header, vehicle
// cell and loading skeletons (UX-06).

/** The current order is exposed with aria-sort; the table caption also states it. */
export function NameSortHeader({ sort, onSort }: { sort: NameSort; onSort: (sort: NameSort) => void }) {
  const ascending = sort === 'name'
  const Icon = ascending ? ArrowUpIcon : ArrowDownIcon
  return (
    <th scope="col" aria-sort={ascending ? 'ascending' : 'descending'}>
      <button type="button" className="roster-sort-button" onClick={() => onSort(ascending ? '-name' : 'name')}>
        <span>Nombre</span>
        <Icon />
      </button>
    </th>
  )
}

/** Bound vehicle, or a clear "Sin vehículo" (RF-13 style: absence is stated, never blank). */
export function VehicleCell({ vehicle, linkable }: { vehicle: VehicleRef | null; linkable: boolean }) {
  if (!vehicle) return <span className="roster-muted">Sin vehículo</span>
  return (
    <span className="roster-vehicle">
      <TruckIcon />
      {linkable ? <Link to={`/app/vehicles/${vehicle.id}`}>{vehicle.name}</Link> : vehicle.name}
    </span>
  )
}

/** Optional text cell: "Sin dato" instead of an empty cell. */
export function OptionalText({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className="roster-muted">Sin dato</span>
}

export function RosterTableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="roster-table-scroll" aria-hidden="true">
      <table className="roster-table">
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <td key={column}>
                  <Skeleton width={column === 0 ? '9rem' : '6rem'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RosterCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="roster-cards" role="list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="roster-card">
          <Skeleton width="10rem" height="1.25rem" />
          <div className="roster-card__details">
            <Skeleton width="70%" />
            <Skeleton width="55%" />
            <Skeleton width="80%" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Wraps row actions; `label` names the group for screen readers ("Acciones de Luz Gómez"). */
export function RosterActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="roster-actions" role="group" aria-label={label}>
      {children}
    </div>
  )
}
