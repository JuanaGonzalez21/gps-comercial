import type { ReactNode } from 'react'
import type { DriverOut } from '@/api/types'
import { sortCaption, type NameSort } from './shared/listState'
import { NameSortHeader, OptionalText, RosterPerson, VehicleCell } from './shared/RosterTable'

interface DriverListProps {
  items: readonly DriverOut[]
  /** Resource name per id (null while unknown). */
  resourceNames: ReadonlyMap<number, string> | null
  linkVehicles: boolean
  /** Opens the assignment dialog; null when the role cannot assign. */
  onAssign: ((driver: DriverOut) => void) | null
  /** Row actions allowed for the current role; null hides the column. */
  renderActions: ((driver: DriverOut) => ReactNode) | null
}

interface DriverTableProps extends DriverListProps {
  sort: NameSort
  onSortChange: (sort: NameSort) => void
  busy: boolean
}

function vehicleCell(driver: DriverOut, linkVehicles: boolean, onAssign: DriverListProps['onAssign']) {
  return (
    <VehicleCell
      vehicle={driver.vehicle}
      linkable={linkVehicles}
      personName={driver.name}
      onAssign={onAssign ? () => onAssign(driver) : undefined}
    />
  )
}

/** Tablet and desktop: sortable table (UX-06). */
export function DriverTable({
  items,
  resourceNames,
  linkVehicles,
  onAssign,
  renderActions,
  sort,
  onSortChange,
  busy,
}: DriverTableProps) {
  return (
    <div className="roster-table-scroll" role="region" aria-label="Tabla de conductores" tabIndex={0}>
      <table className="roster-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">Conductores {sortCaption(sort)}.</caption>
        <thead>
          <tr>
            <NameSortHeader sort={sort} onSort={onSortChange} />
            <th scope="col">Código</th>
            <th scope="col">Teléfono</th>
            <th scope="col">Vehículo</th>
            {renderActions && (
              <th scope="col" className="roster-table__actions">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((driver) => (
            <tr key={`${driver.resource_id}-${driver.id}`}>
              <th scope="row">
                <RosterPerson
                  name={driver.name}
                  resourceName={resourceNames?.get(driver.resource_id) ?? null}
                  description={driver.description}
                />
              </th>
              <td className="roster-table__nowrap">
                <OptionalText value={driver.code} mono />
              </td>
              <td className="roster-table__nowrap">
                <OptionalText value={driver.phone} />
              </td>
              <td>{vehicleCell(driver, linkVehicles, onAssign)}</td>
              {renderActions && <td className="roster-table__actions">{renderActions(driver)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Phones (< 48rem): one stacked card per driver instead of a squeezed table. */
export function DriverCards({ items, resourceNames, linkVehicles, onAssign, renderActions }: DriverListProps) {
  return (
    <ul className="roster-cards" role="list">
      {items.map((driver) => {
        const titleId = `driver-card-${driver.resource_id}-${driver.id}`
        return (
          <li key={`${driver.resource_id}-${driver.id}`} className="roster-card">
            <article aria-labelledby={titleId}>
              <RosterPerson
                name={driver.name}
                resourceName={resourceNames?.get(driver.resource_id) ?? null}
                description={driver.description}
                titleId={titleId}
              />
              <dl className="roster-card__details">
                <div>
                  <dt>Código</dt>
                  <dd>
                    <OptionalText value={driver.code} mono />
                  </dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <OptionalText value={driver.phone} />
                  </dd>
                </div>
                <div>
                  <dt>Vehículo</dt>
                  <dd>{vehicleCell(driver, linkVehicles, onAssign)}</dd>
                </div>
              </dl>
              {renderActions && <div className="roster-card__actions">{renderActions(driver)}</div>}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
