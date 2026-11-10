import type { UseQueryResult } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { Page, VehicleRef } from '@/api/types'
import { formatNumber } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { Alert, Button, Dialog, SelectField, Spinner, TextField, type SelectOption } from '@/ui'
import '@/features/drivers/shared/roster.css'

// Assign a driver or a passenger to the vehicle being viewed, without leaving its detail page.
// The mirror of AssignVehicleDialog: people are searched on the server and the backend waits
// until Wialon confirms the binding (a few seconds).

export interface PersonOption {
  resource_id: number
  id: number
  name: string
  code: string | null
  vehicle: VehicleRef | null
}

const TEXTS = {
  driver: {
    noun: 'conductor',
    plural: 'conductores',
    action: 'Asignar conductor',
    search: 'Buscar conductor',
    field: 'Conductor',
    choose: 'Selecciona un conductor',
    required: 'Elige un conductor de la lista.',
    error: 'No se pudo asignar el conductor',
  },
  passenger: {
    noun: 'pasajero',
    plural: 'pasajeros',
    action: 'Asignar pasajero',
    search: 'Buscar pasajero',
    field: 'Pasajero',
    choose: 'Selecciona un pasajero',
    required: 'Elige un pasajero de la lista.',
    error: 'No se pudo asignar el pasajero',
  },
} as const

interface AssignPersonDialogProps {
  kind: keyof typeof TEXTS
  vehicle: VehicleRef
  /** Server search of the people to offer (useDriverOptions or usePassengerOptions). */
  useOptions: (search: string) => UseQueryResult<Page<PersonOption>>
  onClose: () => void
  /** Resolves once Wialon confirmed the assignment; rejects with the API error. */
  onAssign: (person: PersonOption) => Promise<unknown>
}

const keyOf = (person: PersonOption) => `${person.resource_id}:${person.id}`

function assignmentErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error, `${fallback}. Inténtalo de nuevo.`)
  // 404/409: what was on screen is stale. It is re-read right away, so say it.
  if (isApiError(error) && (error.code === 'not_found' || error.code === 'conflict')) {
    return `${message} Actualizamos los datos con lo que hay en Wialon.`
  }
  return message
}

export function AssignPersonDialog({ kind, vehicle, useOptions, onClose, onAssign }: AssignPersonDialogProps) {
  const text = TEXTS[kind]
  const formId = useId()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const people = useOptions(search)
  // The chosen person stays selectable even when a new search no longer lists them.
  const [chosen, setChosen] = useState<PersonOption | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // The dialog has just opened: start on the search box.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (failure) errorRef.current?.focus()
  }, [failure])

  // People already on this vehicle are not offered: assigning them again would only fail.
  const items = (people.data?.items ?? []).filter((person) => person.vehicle?.id !== vehicle.id)
  const total = people.data ? people.data.total - (people.data.items.length - items.length) : 0

  const options: SelectOption[] = [{ value: '', label: people.isPending ? `Cargando ${text.plural}…` : text.choose }]
  if (chosen && !items.some((person) => keyOf(person) === keyOf(chosen))) {
    options.push({ value: keyOf(chosen), label: chosen.name })
  }
  for (const person of items) {
    const code = person.code ? ` · ${person.code}` : ''
    const where = person.vehicle ? ` (ahora en ${person.vehicle.name})` : ''
    options.push({ value: keyOf(person), label: `${person.name}${code}${where}` })
  }

  let hint: string
  if (people.isPending) hint = `Cargando ${text.plural}…`
  else if (!people.data) hint = `No se pudo cargar la lista de ${text.plural}.`
  else if (items.length === 0 && search) hint = `Ningún ${text.noun} coincide con «${search}».`
  else if (items.length === 0) hint = `No hay otros ${text.plural} disponibles.`
  else if (total > items.length)
    hint = `Se muestran ${formatNumber(items.length)} de ${formatNumber(total)} ${text.plural}. Escribe en la búsqueda para encontrar otros.`
  else if (items.length === 1) hint = `1 ${text.noun} disponible.`
  else hint = `${formatNumber(items.length)} ${text.plural} disponibles.`

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!chosen) {
      setFieldError(text.required)
      return
    }
    setFailure(null)
    setSubmitting(true)
    try {
      await onAssign(chosen)
    } catch (error) {
      setFailure(assignmentErrorMessage(error, text.error))
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      title={`${text.action} a «${vehicle.name}»`}
      onClose={onClose}
      busy={submitting}
      description={<p>Busca por nombre, código o teléfono. El cambio se guarda en Wialon.</p>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={submitting} loadingText="Guardando…">
            {text.action}
          </Button>
        </>
      }
    >
      <form id={formId} className="roster-form" noValidate onSubmit={(event) => void submit(event)}>
        {failure && (
          <Alert ref={errorRef} focusable tone="error" role="alert" title={text.error}>
            {failure}
          </Alert>
        )}
        <TextField
          ref={searchRef}
          type="search"
          label={text.search}
          placeholder="Nombre, código o teléfono"
          autoComplete="off"
          maxLength={100}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          // Enter in the search box filters; it must not submit the assignment.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          disabled={submitting}
        />
        {people.isError && !people.data ? (
          <Alert
            tone="error"
            role="alert"
            title={`No pudimos cargar los ${text.plural}`}
            action={
              <Button size="sm" variant="secondary" onClick={() => void people.refetch()} loading={people.isFetching}>
                Reintentar
              </Button>
            }
          >
            {getErrorMessage(people.error)}
          </Alert>
        ) : (
          <SelectField
            label={text.field}
            isRequired
            hint={hint}
            error={fieldError ?? undefined}
            options={options}
            value={chosen ? keyOf(chosen) : ''}
            disabled={submitting}
            onChange={(event) => {
              const key = event.target.value
              const person =
                items.find((option) => keyOf(option) === key) ?? (chosen && keyOf(chosen) === key ? chosen : null)
              setChosen(person)
              setFieldError(null)
            }}
          />
        )}
        {/* Moving someone from another vehicle is allowed; say it before saving. */}
        <p className="assign-person__note" role="status">
          {chosen?.vehicle
            ? `«${chosen.name}» está ahora en «${chosen.vehicle.name}»: al asignarlo pasa a «${vehicle.name}».`
            : null}
        </p>
        <div role="status" className="roster-saving roster-saving--form">
          {submitting && (
            <>
              <Spinner size="sm" />
              <span>Guardando en Wialon. La asignación tarda unos segundos en confirmarse…</span>
            </>
          )}
        </div>
      </form>
    </Dialog>
  )
}
