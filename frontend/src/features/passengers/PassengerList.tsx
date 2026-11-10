import type { ReactNode } from 'react'
import type { PassengerOut } from '@/api/types'
import { sortCaption, type RosterSort } from '@/features/drivers/shared/listState'
import { NameSortHeader, OptionalText, RosterPerson, VehicleCell } from '@/features/drivers/shared/RosterTable'

interface PassengerListProps {
  items: readonly PassengerOut[]
  /** Resource name per id (null while unknown). */
  resourceNames: ReadonlyMap<number, string> | null
  linkVehicles: boolean
  /** Opens the custom fields editor (read-only for roles without passengers:write). */
  onOpenFields: (passenger: PassengerOut) => void
  /** Opens the assignment dialog; null when the role cannot assign. */
  onAssign: ((passenger: PassengerOut) => void) | null
  /** Row actions allowed for the current role; null hides them. */
  renderActions: ((passenger: PassengerOut) => ReactNode) | null
}

interface PassengerTableProps extends PassengerListProps {
  sort: RosterSort
  onSortChange: (sort: RosterSort) => void
  busy: boolean
}

/** "1 campo" / "N campos" chip that opens the custom fields dialog (RF-27). */
function FieldsChip({ passenger, onOpen }: { passenger: PassengerOut; onOpen: (p: PassengerOut) => void }) {
  const count = passenger.custom_fields.length
  return (
    <button type="button" className="roster-chip" onClick={() => onOpen(passenger)}>
      {count === 1 ? '1 campo ' : `${count} campos `}
      <span className="visually-hidden">
        {count === 1 ? 'personalizado' : 'personalizados'} de {passenger.name}
      </span>
    </button>
  )
}

function vehicleCell(passenger: PassengerOut, linkVehicles: boolean, onAssign: PassengerListProps['onAssign']) {
  return (
    <VehicleCell
      vehicle={passenger.vehicle}
      linkable={linkVehicles}
      personName={passenger.name}
      onAssign={onAssign ? () => onAssign(passenger) : undefined}
    />
  )
}

/** Tablet and desktop: sortable table (UX-06). */
export function PassengerTable({
  items,
  resourceNames,
  linkVehicles,
  onOpenFields,
  onAssign,
  renderActions,
  sort,
  onSortChange,
  busy,
}: PassengerTableProps) {
  return (
    <div className="roster-table-scroll" role="region" aria-label="Tabla de pasajeros" tabIndex={0}>
      <table className="roster-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">Pasajeros {sortCaption(sort)}.</caption>
        <thead>
          <tr>
            <NameSortHeader sort={sort} onSort={onSortChange} />
            <th scope="col">Código</th>
            <th scope="col">Teléfono</th>
            <th scope="col">Vehículo</th>
            <th scope="col">Campos</th>
            {renderActions && (
              <th scope="col" className="roster-table__actions">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((passenger) => (
            <tr key={`${passenger.resource_id}-${passenger.id}`}>
              <th scope="row">
                <RosterPerson
                  name={passenger.name}
                  resourceName={resourceNames?.get(passenger.resource_id) ?? null}
                />
              </th>
              <td className="roster-table__nowrap">
                <OptionalText value={passenger.code} mono />
              </td>
              <td className="roster-table__nowrap">
                <OptionalText value={passenger.phone} />
              </td>
              <td>{vehicleCell(passenger, linkVehicles, onAssign)}</td>
              <td className="roster-table__nowrap">
                <FieldsChip passenger={passenger} onOpen={onOpenFields} />
              </td>
              {renderActions && <td className="roster-table__actions">{renderActions(passenger)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Phones (< 48rem): one stacked card per passenger. */
export function PassengerCards({
  items,
  resourceNames,
  linkVehicles,
  onOpenFields,
  onAssign,
  renderActions,
}: PassengerListProps) {
  return (
    <ul className="roster-cards" role="list">
      {items.map((passenger) => {
        const titleId = `passenger-card-${passenger.resource_id}-${passenger.id}`
        return (
          <li key={`${passenger.resource_id}-${passenger.id}`} className="roster-card">
            <article aria-labelledby={titleId}>
              <RosterPerson
                name={passenger.name}
                resourceName={resourceNames?.get(passenger.resource_id) ?? null}
                titleId={titleId}
              />
              <dl className="roster-card__details">
                <div>
                  <dt>Código</dt>
                  <dd>
                    <OptionalText value={passenger.code} mono />
                  </dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <OptionalText value={passenger.phone} />
                  </dd>
                </div>
                <div>
                  <dt>Vehículo</dt>
                  <dd>{vehicleCell(passenger, linkVehicles, onAssign)}</dd>
                </div>
                <div>
                  <dt>Campos</dt>
                  <dd>
                    <FieldsChip passenger={passenger} onOpen={onOpenFields} />
                  </dd>
                </div>
              </dl>
              {renderActions && <div className="roster-card__actions">{renderActions(passenger)}</div>}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
