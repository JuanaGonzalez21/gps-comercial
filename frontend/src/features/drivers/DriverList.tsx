import type { ReactNode } from 'react'
import type { DriverOut } from '@/api/types'
import { sortCaption, type NameSort } from './shared/listState'
import { NameSortHeader, OptionalText, VehicleCell } from './shared/RosterTable'

interface DriverListProps {
  items: readonly DriverOut[]
  /** Resource name per id, only when the account has several resources. */
  resourceNames: ReadonlyMap<number, string> | null
  linkVehicles: boolean
  /** Row actions allowed for the current role; null hides the column. */
  renderActions: ((driver: DriverOut) => ReactNode) | null
}

interface DriverTableProps extends DriverListProps {
  sort: NameSort
  onSortChange: (sort: NameSort) => void
  busy: boolean
}

/** Tablet and desktop: sortable table (UX-06). */
export function DriverTable({
  items,
  resourceNames,
  linkVehicles,
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
                <span className="visually-hidden">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((driver) => (
            <tr key={`${driver.resource_id}-${driver.id}`}>
              <th scope="row">
                {driver.name}
                {driver.description && <span className="roster-note">{driver.description}</span>}
                {resourceNames && (
                  <span className="roster-note">Recurso: {resourceNames.get(driver.resource_id) ?? driver.resource_id}</span>
                )}
              </th>
              <td>
                <OptionalText value={driver.code} />
              </td>
              <td>
                <OptionalText value={driver.phone} />
              </td>
              <td>
                <VehicleCell vehicle={driver.vehicle} linkable={linkVehicles} />
              </td>
              {renderActions && <td className="roster-table__actions">{renderActions(driver)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Small screens (360 px): one readable card per driver instead of a squeezed table. */
export function DriverCards({ items, resourceNames, linkVehicles, renderActions }: DriverListProps) {
  return (
    <ul className="roster-cards" role="list">
      {items.map((driver) => {
        const titleId = `driver-card-${driver.resource_id}-${driver.id}`
        return (
          <li key={`${driver.resource_id}-${driver.id}`} className="roster-card">
            <article aria-labelledby={titleId}>
              <h3 id={titleId} className="roster-card__name">
                {driver.name}
              </h3>
              <dl className="roster-card__details">
                <div>
                  <dt>Vehículo</dt>
                  <dd>
                    <VehicleCell vehicle={driver.vehicle} linkable={linkVehicles} />
                  </dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>
                    <OptionalText value={driver.code} />
                  </dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <OptionalText value={driver.phone} />
                  </dd>
                </div>
                {driver.description && (
                  <div>
                    <dt>Descripción</dt>
                    <dd>{driver.description}</dd>
                  </div>
                )}
                {resourceNames && (
                  <div>
                    <dt>Recurso</dt>
                    <dd>{resourceNames.get(driver.resource_id) ?? driver.resource_id}</dd>
                  </div>
                )}
              </dl>
              {renderActions?.(driver)}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
