import type { ReactNode } from 'react'
import type { PassengerOut } from '@/api/types'
import { sortCaption, type NameSort } from '@/features/drivers/shared/listState'
import { NameSortHeader, OptionalText, VehicleCell } from '@/features/drivers/shared/RosterTable'
import { Button } from '@/ui'

interface PassengerListProps {
  items: readonly PassengerOut[]
  resourceNames: ReadonlyMap<number, string> | null
  linkVehicles: boolean
  /** Opens the custom fields editor (read-only for roles without passengers:write). */
  onOpenFields: (passenger: PassengerOut) => void
  /** Row actions allowed for the current role; null hides them. */
  renderActions: ((passenger: PassengerOut) => ReactNode) | null
}

interface PassengerTableProps extends PassengerListProps {
  sort: NameSort
  onSortChange: (sort: NameSort) => void
  busy: boolean
}

function fieldCount(count: number): string {
  return count === 1 ? '1 campo' : `${count} campos`
}

function FieldsButton({ passenger, onOpen }: { passenger: PassengerOut; onOpen: (p: PassengerOut) => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={() => onOpen(passenger)}>
      {`${fieldCount(passenger.custom_fields.length)} `}
      <span className="visually-hidden">personalizados de {passenger.name}</span>
    </Button>
  )
}

/** Tablet and desktop: sortable table (UX-06). */
export function PassengerTable({
  items,
  resourceNames,
  linkVehicles,
  onOpenFields,
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
            <th scope="col">Campos personalizados</th>
            {renderActions && (
              <th scope="col" className="roster-table__actions">
                <span className="visually-hidden">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((passenger) => (
            <tr key={`${passenger.resource_id}-${passenger.id}`}>
              <th scope="row">
                {passenger.name}
                {resourceNames && (
                  <span className="roster-note">
                    Recurso: {resourceNames.get(passenger.resource_id) ?? passenger.resource_id}
                  </span>
                )}
              </th>
              <td>
                <OptionalText value={passenger.code} />
              </td>
              <td>
                <OptionalText value={passenger.phone} />
              </td>
              <td>
                <VehicleCell vehicle={passenger.vehicle} linkable={linkVehicles} />
              </td>
              <td>
                <FieldsButton passenger={passenger} onOpen={onOpenFields} />
              </td>
              {renderActions && <td className="roster-table__actions">{renderActions(passenger)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Small screens (360 px): cards with a preview of the first custom fields. */
export function PassengerCards({ items, resourceNames, linkVehicles, onOpenFields, renderActions }: PassengerListProps) {
  return (
    <ul className="roster-cards" role="list">
      {items.map((passenger) => {
        const titleId = `passenger-card-${passenger.resource_id}-${passenger.id}`
        const preview = passenger.custom_fields.slice(0, 2)
        return (
          <li key={`${passenger.resource_id}-${passenger.id}`} className="roster-card">
            <article aria-labelledby={titleId}>
              <h3 id={titleId} className="roster-card__name">
                {passenger.name}
              </h3>
              <dl className="roster-card__details">
                <div>
                  <dt>Vehículo</dt>
                  <dd>
                    <VehicleCell vehicle={passenger.vehicle} linkable={linkVehicles} />
                  </dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd>
                    <OptionalText value={passenger.code} />
                  </dd>
                </div>
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <OptionalText value={passenger.phone} />
                  </dd>
                </div>
                {preview.map((field) => (
                  <div key={field.key}>
                    <dt>{field.key}</dt>
                    <dd>{field.value || <span className="roster-muted">Sin valor</span>}</dd>
                  </div>
                ))}
                {resourceNames && (
                  <div>
                    <dt>Recurso</dt>
                    <dd>{resourceNames.get(passenger.resource_id) ?? passenger.resource_id}</dd>
                  </div>
                )}
              </dl>
              <div className="roster-actions">
                <FieldsButton passenger={passenger} onOpen={onOpenFields} />
              </div>
              {renderActions?.(passenger)}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
