import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { VehicleRef, VehicleSummary } from '@/api/types'
import { formatNumber } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { Alert, Button, Dialog, SelectField, Spinner, TextField, type SelectOption } from '@/ui'
import { useVehicleOptions } from './useVehicleOptions'

// Assign or change the vehicle of a driver or passenger (RF-17, RF-09). The vehicle list is
// searched on the server; the backend waits until Wialon confirms the binding (a few seconds).

const schema = z.object({
  unit_id: z.string().min(1, { error: 'Elige un vehículo de la lista.' }),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface AssignVehicleDialogProps {
  /** Name of the driver or passenger. */
  personName: string
  /** "conductor" or "pasajero", used in the explanatory texts. */
  noun: string
  currentVehicle: VehicleRef | null
  onClose: () => void
  /** Resolves once Wialon confirmed the assignment; rejects with the API error. */
  onAssign: (vehicle: VehicleRef) => Promise<unknown>
  /** Extra context for each option, for example the vehicle's current driver. */
  describeVehicle?: (vehicle: VehicleSummary) => string | null
}

function assignmentErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, 'No se pudo asignar el vehículo. Inténtalo de nuevo.')
  // 404/409: the list was stale. It is re-read right away, so say it.
  if (isApiError(error) && (error.code === 'not_found' || error.code === 'conflict')) {
    return `${message} Actualizamos la lista con los datos de Wialon.`
  }
  return message
}

export function AssignVehicleDialog({
  personName,
  noun,
  currentVehicle,
  onClose,
  onAssign,
  describeVehicle,
}: AssignVehicleDialogProps) {
  const formId = useId()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const vehicles = useVehicleOptions(search)
  // The chosen vehicle stays selectable even when a new search no longer lists it.
  const [chosen, setChosen] = useState<VehicleRef | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { unit_id: '' },
  })

  // The dialog has just opened (its effect runs first): start on the search box.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (failure) errorRef.current?.focus()
  }, [failure])

  // The current vehicle is not offered: assigning it again would only answer "already assigned".
  const items = (vehicles.data?.items ?? []).filter((vehicle) => vehicle.id !== currentVehicle?.id)
  const total = vehicles.data ? vehicles.data.total - (vehicles.data.items.length - items.length) : 0

  const options: SelectOption[] = [
    {
      value: '',
      label: vehicles.isPending ? 'Cargando vehículos…' : 'Selecciona un vehículo',
    },
  ]
  if (chosen && !items.some((vehicle) => vehicle.id === chosen.id)) {
    options.push({ value: String(chosen.id), label: chosen.name })
  }
  for (const vehicle of items) {
    const extra = describeVehicle?.(vehicle)
    options.push({ value: String(vehicle.id), label: extra ? `${vehicle.name} (${extra})` : vehicle.name })
  }

  let hint: string
  if (vehicles.isPending) hint = 'Cargando vehículos…'
  else if (!vehicles.data) hint = 'No se pudo cargar la lista de vehículos.'
  else if (items.length === 0 && search) hint = `Ningún vehículo coincide con «${search}».`
  else if (items.length === 0) hint = 'No hay otros vehículos disponibles.'
  else if (total > items.length)
    hint = `Se muestran ${formatNumber(items.length)} de ${formatNumber(total)} vehículos. Escribe en la búsqueda para encontrar otros.`
  else hint = `${formatNumber(items.length)} vehículos disponibles.`

  const nameOf = (id: string): string | null => {
    if (chosen && String(chosen.id) === id) return chosen.name
    return items.find((vehicle) => String(vehicle.id) === id)?.name ?? null
  }

  const onSubmit = handleSubmit(async ({ unit_id }) => {
    const name = nameOf(unit_id)
    if (name === null) return
    setFailure(null)
    try {
      await onAssign({ id: Number(unit_id), name })
    } catch (error) {
      setFailure(assignmentErrorMessage(error))
    }
  })

  const title = currentVehicle ? `Cambiar el vehículo de «${personName}»` : `Asignar vehículo a «${personName}»`

  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      busy={isSubmitting}
      description={
        currentVehicle ? (
          <p>
            Vehículo actual: <strong>{currentVehicle.name}</strong>. Si eliges otro, el {noun} se reasigna.
          </p>
        ) : (
          <p>El cambio se guarda en Wialon.</p>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} loadingText="Guardando…">
            {currentVehicle ? 'Cambiar vehículo' : 'Asignar vehículo'}
          </Button>
        </>
      }
    >
      <form id={formId} className="roster-form" noValidate onSubmit={onSubmit}>
        {failure && (
          <Alert ref={errorRef} focusable tone="error" role="alert" title="No se pudo asignar el vehículo">
            {failure}
          </Alert>
        )}
        <TextField
          ref={searchRef}
          type="search"
          label="Buscar vehículo"
          placeholder="Nombre del vehículo"
          autoComplete="off"
          maxLength={100}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          // Enter in the search box filters; it must not submit the assignment.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          disabled={isSubmitting}
        />
        {vehicles.isError && !vehicles.data ? (
          <Alert
            tone="error"
            role="alert"
            title="No pudimos cargar los vehículos"
            action={
              <Button size="sm" variant="secondary" onClick={() => void vehicles.refetch()} loading={vehicles.isFetching}>
                Reintentar
              </Button>
            }
          >
            {getErrorMessage(vehicles.error)}
          </Alert>
        ) : (
          <Controller
            name="unit_id"
            control={control}
            render={({ field, fieldState }) => (
              <SelectField
                label="Vehículo"
                isRequired
                hint={hint}
                error={fieldState.error?.message}
                options={options}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                onChange={(event) => {
                  const id = event.target.value
                  const name = nameOf(id)
                  setChosen(name === null ? null : { id: Number(id), name })
                  field.onChange(id)
                }}
              />
            )}
          />
        )}
        <div role="status" className="roster-saving roster-saving--form">
          {isSubmitting && (
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
