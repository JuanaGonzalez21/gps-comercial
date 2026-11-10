import type { ReactNode } from 'react'
import { Button, SelectField, TextField, type SelectOption } from '@/ui'
import { toAssignedFilter, toNameSort, type AssignedFilter, type NameSort } from './listState'

const ASSIGNED_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'yes', label: 'Con vehículo' },
  { value: 'no', label: 'Sin vehículo' },
]

const SORT_OPTIONS: readonly SelectOption[] = [
  { value: 'name', label: 'A–Z' },
  { value: '-name', label: 'Z–A' },
]

interface RosterFiltersProps {
  /** Accessible name of the search landmark, for example "Filtrar conductores". */
  label: string
  searchLabel: string
  searchPlaceholder: string
  search: string
  onSearchChange: (value: string) => void
  assigned: AssignedFilter
  onAssignedChange: (value: AssignedFilter) => void
  sort: NameSort
  onSortChange: (value: NameSort) => void
  /** Cards have no sortable header, so small screens get a sort select instead. */
  showSort: boolean
  hasFilters: boolean
  onClear: () => void
  /** Extra filters owned by the page (for example the passenger's vehicle). */
  children?: ReactNode
}

/** Server-side search and filters of the drivers and passengers lists (UX-06). */
export function RosterFilters({
  label,
  searchLabel,
  searchPlaceholder,
  search,
  onSearchChange,
  assigned,
  onAssignedChange,
  sort,
  onSortChange,
  showSort,
  hasFilters,
  onClear,
  children,
}: RosterFiltersProps) {
  return (
    <form role="search" aria-label={label} className="roster-filters" onSubmit={(event) => event.preventDefault()}>
      <TextField
        type="search"
        label={searchLabel}
        placeholder={searchPlaceholder}
        autoComplete="off"
        maxLength={100}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="roster-filters__row">
        <SelectField
          label="Asignación"
          options={ASSIGNED_OPTIONS}
          value={assigned}
          onChange={(event) => onAssignedChange(toAssignedFilter(event.target.value))}
        />
        {children}
        {showSort && (
          <SelectField
            label="Ordenar por nombre"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(event) => onSortChange(toNameSort(event.target.value))}
          />
        )}
      </div>
      {hasFilters && (
        <Button variant="ghost" className="roster-filters__clear" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </form>
  )
}
