import type { RoleCode } from '@/api/types'
import type { UserSort } from '@/api/users'
import { Button, SelectField, TextField, type SelectOption } from '@/ui'
import { isRoleCode } from './roles'

export type ActiveFilter = '' | 'active' | 'inactive'

const ACTIVE_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
]

const USER_SORT_OPTIONS: readonly (SelectOption & { value: UserSort })[] = [
  { value: 'full_name', label: 'Nombre (A–Z)' },
  { value: '-full_name', label: 'Nombre (Z–A)' },
  { value: 'email', label: 'Correo (A–Z)' },
  { value: '-email', label: 'Correo (Z–A)' },
  { value: '-created_at', label: 'Creados recientemente' },
  { value: 'created_at', label: 'Creados hace más tiempo' },
]

function toActive(value: string): ActiveFilter {
  return value === 'active' || value === 'inactive' ? value : ''
}

function toSort(value: string): UserSort {
  return USER_SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'full_name'
}

interface UserFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  role: RoleCode | ''
  onRoleChange: (value: RoleCode | '') => void
  roleOptions: readonly SelectOption[]
  active: ActiveFilter
  onActiveChange: (value: ActiveFilter) => void
  sort: UserSort
  onSortChange: (value: UserSort) => void
  hasFilters: boolean
  onClear: () => void
}

/** Server-side search and filters for the users list (UX-06). */
export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  roleOptions,
  active,
  onActiveChange,
  sort,
  onSortChange,
  hasFilters,
  onClear,
}: UserFiltersProps) {
  return (
    <form
      role="search"
      aria-label="Filtrar usuarios"
      className="admin-filters admin-filters--users"
      onSubmit={(event) => event.preventDefault()}
    >
      <TextField
        type="search"
        label="Buscar usuario"
        placeholder="Nombre o correo"
        autoComplete="off"
        value={search}
        maxLength={100}
        onChange={(event) => onSearchChange(event.target.value)}
        fieldClassName="admin-filters__wide"
      />
      <SelectField
        label="Rol"
        options={[{ value: '', label: 'Todos' }, ...roleOptions]}
        value={role}
        onChange={(event) => onRoleChange(isRoleCode(event.target.value) ? event.target.value : '')}
      />
      <SelectField
        label="Estado"
        options={ACTIVE_OPTIONS}
        value={active}
        onChange={(event) => onActiveChange(toActive(event.target.value))}
      />
      <SelectField
        label="Ordenar por"
        options={USER_SORT_OPTIONS}
        value={sort}
        onChange={(event) => onSortChange(toSort(event.target.value))}
        fieldClassName="admin-filters__wide"
      />
      {hasFilters && (
        <div className="admin-filters__actions">
          <Button variant="ghost" onClick={onClear}>
            Limpiar filtros
          </Button>
        </div>
      )}
    </form>
  )
}
