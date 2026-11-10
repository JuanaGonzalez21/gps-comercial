import { Link } from 'react-router'
import type { VehicleRef } from '@/api/types'
import {
  ActionMenu,
  ArrowDownIcon,
  ArrowUpIcon,
  Avatar,
  EditIcon,
  LinkIcon,
  Skeleton,
  TruckIcon,
  initialsOf,
  type ActionMenuItem,
} from '@/ui'
import type { NameSort } from './listState'

// Building blocks shared by the drivers and passengers lists (design handoff "4. Conductores y
// 5. Pasajeros"): sortable name header, person cell, vehicle cell, row actions and skeletons (UX-06).

/** "Conductor simulado 07" → "C7" (as in the design); otherwise first and last initials. */
function rosterInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  if (parts.length > 1 && /^\d{1,3}$/.test(last)) return `${parts[0]?.charAt(0).toUpperCase() ?? ''}${Number(last)}`
  return initialsOf(name)
}

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

interface RosterPersonProps {
  name: string
  /** Shown as "Recurso: …" when the resource name is known. */
  resourceName: string | null
  description?: string | null
  /** Cards name their article with this h3 id; table rows use the row header instead. */
  titleId?: string
}

/** Avatar with initials + name (700) + resource and description in grey. */
export function RosterPerson({ name, resourceName, description, titleId }: RosterPersonProps) {
  const Name = titleId ? 'h3' : 'span'
  return (
    <div className="roster-person">
      <Avatar name={name} initials={rosterInitials(name)} size="sm" />
      <div className="roster-person__text">
        <Name id={titleId} className="roster-person__name">
          {name}
        </Name>
        {resourceName && <span className="roster-note">Recurso: {resourceName}</span>}
        {description && <span className="roster-note">{description}</span>}
      </div>
    </div>
  )
}

interface VehicleCellProps {
  vehicle: VehicleRef | null
  linkable: boolean
  personName: string
  /** Present when the role may assign: an unassigned person gets the dashed "Asignar vehículo". */
  onAssign?: () => void
}

/** Bound vehicle (link to its detail), "Asignar vehículo" or a clear "Sin vehículo". */
export function VehicleCell({ vehicle, linkable, personName, onAssign }: VehicleCellProps) {
  if (!vehicle) {
    if (!onAssign) return <span className="roster-muted">Sin vehículo</span>
    return (
      <button type="button" className="roster-assign" onClick={onAssign}>
        <LinkIcon />
        Asignar vehículo <span className="visually-hidden">a {personName}</span>
      </button>
    )
  }
  return linkable ? (
    <Link to={`/app/vehicles/${vehicle.id}`} className="roster-vehicle">
      <TruckIcon />
      {vehicle.name}
    </Link>
  ) : (
    <span className="roster-vehicle">
      <TruckIcon />
      {vehicle.name}
    </span>
  )
}

/** Optional text cell: "Sin dato" instead of an empty cell. */
export function OptionalText({ value, mono = false }: { value: string | null; mono?: boolean }) {
  if (!value) return <span className="roster-muted">Sin dato</span>
  return mono ? <span className="mono">{value}</span> : <>{value}</>
}

interface RosterRowActionsProps {
  name: string
  /** Present when the role may edit. */
  onEdit?: () => void
  /** "⋮" menu; destructive items last. Empty hides the menu. */
  menuItems: readonly ActionMenuItem[]
}

/** Edit icon button + "⋮" menu, grouped and named per row ("Acciones de Luz Gómez"). */
export function RosterRowActions({ name, onEdit, menuItems }: RosterRowActionsProps) {
  if (!onEdit && menuItems.length === 0) return null
  return (
    <div className="roster-row-actions" role="group" aria-label={`Acciones de ${name}`}>
      {onEdit && (
        <button type="button" className="icon-button" aria-label={`Editar a ${name}`} onClick={onEdit}>
          <EditIcon />
        </button>
      )}
      {menuItems.length > 0 && <ActionMenu label={`Más acciones para ${name}`} items={menuItems} />}
    </div>
  )
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
                  <Skeleton width={column === 0 ? '12rem' : '6rem'} />
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
          <Skeleton width="12rem" height="1.25rem" />
          <div className="roster-card__details">
            <Skeleton width="55%" />
            <Skeleton width="70%" />
            <Skeleton width="60%" />
          </div>
        </li>
      ))}
    </ul>
  )
}
