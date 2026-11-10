import { useId } from 'react'
import type { AuditOutcome } from '@/api/types'
import { Button, SelectField, TextField, type SelectOption } from '@/ui'
import { ACTION_FILTER_GROUPS, isKnownActionFilter } from './auditActions'
import type { AuditFilterValues } from './auditQuery'

const OUTCOME_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'success', label: 'Éxito' },
  { value: 'failure', label: 'Fallo' },
]

function toOutcome(value: string): AuditOutcome | '' {
  return value === 'success' || value === 'failure' ? value : ''
}

/**
 * Action select with option groups (the shared SelectField takes a flat list). Same markup and
 * classes as the design-system field, so it looks and behaves like the others.
 */
function ActionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="field admin-filters__wide">
      <label htmlFor={id} className="field__label">
        Acción
      </label>
      <select
        id={id}
        className="field__control field__select"
        value={value}
        onChange={(event) => onChange(isKnownActionFilter(event.target.value) ? event.target.value : '')}
      >
        <option value="">Todas las acciones</option>
        {ACTION_FILTER_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

interface AuditFiltersProps {
  values: AuditFilterValues
  onChange: (values: AuditFilterValues) => void
  /** Latest selectable day (today in Bogota). */
  maxDay: string
  dateError: string | null
  hasFilters: boolean
  onClear: () => void
}

/** Audit filters: action prefix, actor e-mail, outcome and a date range in Bogota time. */
export function AuditFilters({ values, onChange, maxDay, dateError, hasFilters, onClear }: AuditFiltersProps) {
  const noteId = useId()
  const set = <K extends keyof AuditFilterValues>(key: K, value: AuditFilterValues[K]) =>
    onChange({ ...values, [key]: value })
  return (
    <form
      role="search"
      aria-label="Filtrar el registro de auditoría"
      className="admin-filters admin-filters--audit"
      onSubmit={(event) => event.preventDefault()}
    >
      <ActionSelect value={values.action} onChange={(value) => set('action', value)} />
      <TextField
        type="search"
        label="Usuario (correo)"
        placeholder="Parte del correo"
        autoComplete="off"
        spellCheck={false}
        maxLength={254}
        value={values.actor}
        onChange={(event) => set('actor', event.target.value)}
        fieldClassName="admin-filters__wide"
      />
      <SelectField
        label="Resultado"
        options={OUTCOME_OPTIONS}
        value={values.outcome}
        onChange={(event) => set('outcome', toOutcome(event.target.value))}
        fieldClassName="audit-filters__outcome"
      />
      <TextField
        type="date"
        label="Desde"
        max={maxDay}
        describedBy={noteId}
        value={values.dateFrom}
        onChange={(event) => set('dateFrom', event.target.value)}
      />
      <TextField
        type="date"
        label="Hasta"
        max={maxDay}
        min={values.dateFrom || undefined}
        describedBy={noteId}
        value={values.dateTo}
        error={dateError ?? undefined}
        onChange={(event) => set('dateTo', event.target.value)}
      />
      <div className="admin-filters__actions">
        {hasFilters && (
          <Button variant="ghost" onClick={onClear}>
            Limpiar filtros
          </Button>
        )}
      </div>
      <p id={noteId} className="admin-note audit-filters__note">
        Las fechas usan la hora de Bogotá; «Hasta» incluye el día completo.
      </p>
    </form>
  )
}
