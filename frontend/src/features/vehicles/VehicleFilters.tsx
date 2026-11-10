import { useState } from 'react'
import type { VehicleSort, VehicleStatus } from '@/api/types'
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS, isVehicleStatus } from '@/lib/vehicleStatus'
import { Button, SelectField, TextField, type SelectOption } from '@/ui'

export type DriverFilter = '' | 'with' | 'without'

const EXTRA_FILTERS_ID = 'vehicle-extra-filters'

const SORT_OPTIONS: readonly (SelectOption & { value: VehicleSort })[] = [
  { value: 'name', label: 'Nombre (A–Z)' },
  { value: '-name', label: 'Nombre (Z–A)' },
  { value: 'status', label: 'Estado' },
  { value: '-last_message_at', label: 'Actualización más reciente' },
  { value: 'last_message_at', label: 'Actualización más antigua' },
]

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  ...VEHICLE_STATUSES.map((status) => ({ value: status, label: VEHICLE_STATUS_LABELS[status] })),
]

const DRIVER_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'with', label: 'Con conductor' },
  { value: 'without', label: 'Sin conductor' },
]

interface VehicleFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: VehicleStatus | ''
  onStatusChange: (value: VehicleStatus | '') => void
  driver: DriverFilter
  onDriverChange: (value: DriverFilter) => void
  sort: VehicleSort
  onSortChange: (value: VehicleSort) => void
  /**
   * Small screens: the table headers are not shown (cards), so sorting needs a select, and the
   * extra filters fold behind a toggle so the vehicles start higher on the page.
   */
  compact: boolean
  hasFilters: boolean
  onClear: () => void
}

function toDriverFilter(value: string): DriverFilter {
  return value === 'with' || value === 'without' ? value : ''
}

function toSort(value: string): VehicleSort {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'name'
}

/** Search landmark with server-side filters (RF-10, UX-06). */
export function VehicleFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  driver,
  onDriverChange,
  sort,
  onSortChange,
  compact,
  hasFilters,
  onClear,
}: VehicleFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  const activeExtra = (status ? 1 : 0) + (driver ? 1 : 0)
  const showExtra = !compact || expanded
  return (
    <form
      role="search"
      aria-label="Filtrar vehículos"
      className="vehicle-filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <TextField
        type="search"
        label="Buscar vehículo"
        placeholder="Nombre del vehículo"
        autoComplete="off"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        fieldClassName="vehicle-filters__search"
        maxLength={100}
      />
      {compact && (
        <Button
          variant="secondary"
          size="sm"
          className="vehicle-filters__toggle"
          aria-expanded={expanded}
          aria-controls={EXTRA_FILTERS_ID}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Ocultar filtros' : 'Más filtros'}
          {activeExtra > 0 && ` (${activeExtra} activos)`}
        </Button>
      )}
      {showExtra && (
        <div id={EXTRA_FILTERS_ID} className="vehicle-filters__extra">
          <SelectField
            label="Estado"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              const value = event.target.value
              onStatusChange(isVehicleStatus(value) ? value : '')
            }}
          />
          <SelectField
            label="Conductor"
            options={DRIVER_OPTIONS}
            value={driver}
            onChange={(event) => onDriverChange(toDriverFilter(event.target.value))}
          />
          {compact && (
            <SelectField
              label="Ordenar por"
              fieldClassName="vehicle-filters__sort"
              options={SORT_OPTIONS}
              value={sort}
              onChange={(event) => onSortChange(toSort(event.target.value))}
            />
          )}
        </div>
      )}
      {hasFilters && (
        <Button variant="ghost" className="vehicle-filters__clear" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </form>
  )
}
