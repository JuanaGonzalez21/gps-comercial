import type { VehicleSort, VehicleStatus } from '@/api/types'
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import { Button, FilterChip, SearchIcon, SelectField, TextField, type SelectOption } from '@/ui'

export type DriverFilter = '' | 'with' | 'without'

/** Fleet-wide totals per status (dashboard summary). Only valid when nothing else filters the list. */
export interface StatusCounts {
  total: number
  byStatus: Record<VehicleStatus, number>
}

const SORT_OPTIONS: readonly (SelectOption & { value: VehicleSort })[] = [
  { value: 'name', label: 'Nombre (A–Z)' },
  { value: '-name', label: 'Nombre (Z–A)' },
  { value: 'status', label: 'Estado' },
  { value: '-last_message_at', label: 'Actualización más reciente' },
  { value: 'last_message_at', label: 'Actualización más antigua' },
]

const DRIVER_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'with', label: 'Con conductor' },
  { value: 'without', label: 'Sin conductor' },
]

/** Chip dot per status: same colours as the map markers and the legend (the label names it too). */
const STATUS_DOT: Record<VehicleStatus, string> = {
  moving: 'var(--color-teal)',
  stopped: 'var(--color-neutral)',
  no_signal: 'var(--color-brand)',
}

interface VehicleFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: VehicleStatus | ''
  onStatusChange: (value: VehicleStatus | '') => void
  driver: DriverFilter
  onDriverChange: (value: DriverFilter) => void
  sort: VehicleSort
  onSortChange: (value: VehicleSort) => void
  /** Small screens: the table headers are not shown (cards), so sorting needs a select (UX-06). */
  compact: boolean
  /** Counts for the status chips, or null when they would not match the filtered list. */
  counts: StatusCounts | null
  hasFilters: boolean
  onClear: () => void
}

function toDriverFilter(value: string): DriverFilter {
  return value === 'with' || value === 'without' ? value : ''
}

function toSort(value: string): VehicleSort {
  return SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'name'
}

/** Search landmark with server-side filters (RF-10, UX-06): search, driver and status chips. */
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
  counts,
  hasFilters,
  onClear,
}: VehicleFiltersProps) {
  return (
    <form
      role="search"
      aria-label="Filtrar vehículos"
      className="vehicle-filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="vehicle-filters__fields">
        <TextField
          type="search"
          label="Buscar vehículo"
          placeholder="Nombre o conductor"
          leadingIcon={<SearchIcon />}
          autoComplete="off"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          maxLength={100}
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
            options={SORT_OPTIONS}
            value={sort}
            onChange={(event) => onSortChange(toSort(event.target.value))}
          />
        )}
      </div>
      <div className="vehicle-filters__chips">
        <div role="group" aria-label="Estado" className="vehicle-filters__status">
          <FilterChip
            pressed={status === ''}
            onClick={() => onStatusChange('')}
            dotColor="currentColor"
            count={counts?.total}
          >
            Todos
          </FilterChip>
          {VEHICLE_STATUSES.map((value) => (
            <FilterChip
              key={value}
              pressed={status === value}
              onClick={() => onStatusChange(value)}
              dotColor={STATUS_DOT[value]}
              count={counts?.byStatus[value]}
            >
              {VEHICLE_STATUS_LABELS[value]}
            </FilterChip>
          ))}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Limpiar filtros
          </Button>
        )}
      </div>
    </form>
  )
}
