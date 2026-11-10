import type { ReactNode } from 'react'
import { Button, SearchIcon, SegmentedControl, SelectField, TextField, type SegmentOption, type SelectOption } from '@/ui'
import { toNameSort, type AssignedFilter, type NameSort } from './listState'

const ASSIGNED_OPTIONS: readonly SegmentOption<AssignedFilter>[] = [
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

/** Filter card: server-side search + "Asignación" segmented control (UX-06, RF-28). */
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
        leadingIcon={<SearchIcon />}
        fieldClassName="roster-filters__search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="roster-filters__assigned">
        {/* Visible caption; the group itself is named "Asignación" (no double reading). */}
        <span className="field__label" aria-hidden="true">
          Asignación
        </span>
        <SegmentedControl label="Asignación" options={ASSIGNED_OPTIONS} value={assigned} onChange={onAssignedChange} />
      </div>
      {children}
      {showSort && (
        <SelectField
          label="Ordenar por nombre"
          options={SORT_OPTIONS}
          fieldClassName="roster-filters__select"
          value={sort}
          onChange={(event) => onSortChange(toNameSort(event.target.value))}
        />
      )}
      {hasFilters && (
        <Button variant="ghost" className="roster-filters__clear" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </form>
  )
}
