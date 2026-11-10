import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { getErrorMessage } from '@/api/errors'
import { useHistoryVehicle, useVehicleTrack, type TrackRequest } from '@/api/history'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useDocumentTitle, usePrefersReducedMotion } from '@/lib/hooks'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  HistoryIcon,
  PageHeader,
  Skeleton,
  Spinner,
  TextField,
} from '@/ui'
import { TrackResult } from './TrackResult'
import { VehiclePicker } from './VehiclePicker'
import {
  MAX_RANGE_DAYS,
  MAX_RANGE_MS,
  RANGE_PRESETS,
  parseIsoInstant,
  presetRange,
  toUtcIso,
  toZonedInput,
  validateRange,
  type RangePresetId,
} from './timeRange'
import './history.css'

// Route history (RF-24): choose a vehicle and a Bogota date-time range, then see the route on the
// map with playback and speed. The submitted query lives in the URL (?vehicle=&from=&to=), so a
// link from another view (for example /app/history?vehicle=42) opens it directly.

const historySchema = z
  .object({ vehicle_id: z.string(), from: z.string(), to: z.string() })
  .superRefine((values, ctx) => {
    if (!/^[1-9]\d*$/.test(values.vehicle_id)) {
      ctx.addIssue({ code: 'custom', path: ['vehicle_id'], message: 'Selecciona un vehículo.' })
    }
    const range = validateRange(values.from, values.to)
    if (!range.ok) {
      for (const issue of range.issues) {
        ctx.addIssue({ code: 'custom', path: [issue.field], message: issue.message })
      }
    }
  })

type HistoryFormValues = z.infer<typeof historySchema>

const FIELD_ORDER = ['vehicle_id', 'from', 'to'] as const

function positiveId(value: string | null): number | null {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : null
}

/** Form defaults and the query to run on arrival, read from the URL (last 24 h by default). */
function initialState(params: URLSearchParams): { values: HistoryFormValues; request: TrackRequest | null } {
  const vehicleId = positiveId(params.get('vehicle'))
  const from = parseIsoInstant(params.get('from'))
  const to = parseIsoInstant(params.get('to'))
  const urlRangeValid =
    from !== null && to !== null && from < to && to.getTime() - from.getTime() <= MAX_RANGE_MS
  const range = urlRangeValid ? { from, to } : presetRange('last_24h')
  return {
    values: {
      vehicle_id: vehicleId === null ? '' : String(vehicleId),
      from: toZonedInput(range.from),
      to: toZonedInput(range.to),
    },
    request:
      vehicleId === null ? null : { vehicleId, from: toUtcIso(range.from), to: toUtcIso(range.to) },
  }
}

function sameRequest(a: TrackRequest | null, b: TrackRequest): boolean {
  return a !== null && a.vehicleId === b.vehicleId && a.from === b.from && a.to === b.to
}

function TrackSkeleton() {
  return (
    <div className="track-skeleton" aria-hidden="true">
      <Skeleton height="clamp(18rem, 50vh, 30rem)" />
      <div className="track-skeleton__side">
        <Skeleton height="1.5rem" width="60%" />
        <Skeleton height="3rem" />
        <Skeleton height="3rem" />
        <Skeleton height="3rem" />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  useDocumentTitle('Historial de recorridos')
  const [searchParams, setSearchParams] = useSearchParams()
  const reducedMotion = usePrefersReducedMotion()
  const [initial] = useState(() => initialState(searchParams))
  const [request, setRequest] = useState<TrackRequest | null>(initial.request)

  const {
    control,
    register,
    handleSubmit,
    setFocus,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<HistoryFormValues>({
    resolver: zodResolver(historySchema),
    defaultValues: initial.values,
    // Focus follows the visual order (vehicle, from, to), not the registration order.
    shouldFocusError: false,
  })

  const track = useVehicleTrack(request)
  const vehicle = useHistoryVehicle(request?.vehicleId ?? null)
  const vehicleName = vehicle.data?.name ?? (request ? `Vehículo ${request.vehicleId}` : '')

  const applyPreset = (id: RangePresetId) => {
    const range = presetRange(id)
    // After a first submit the fields validate live, so a preset also clears stale errors.
    setValue('from', toZonedInput(range.from), { shouldDirty: true, shouldValidate: isSubmitted })
    setValue('to', toZonedInput(range.to), { shouldDirty: true, shouldValidate: isSubmitted })
  }

  const onSubmit = handleSubmit(
    (values) => {
      const range = validateRange(values.from, values.to)
      if (!range.ok) return
      const next: TrackRequest = {
        vehicleId: Number(values.vehicle_id),
        from: toUtcIso(range.range.from),
        to: toUtcIso(range.range.to),
      }
      // Same query again: the user wants fresh data, not the cached answer.
      if (sameRequest(request, next)) void track.refetch()
      setRequest(next)
      setSearchParams({ vehicle: String(next.vehicleId), from: next.from, to: next.to }, { replace: true })
    },
    (invalid) => {
      const first = FIELD_ORDER.find((field) => invalid[field])
      if (first) setFocus(first)
    },
  )

  const rangeText = request
    ? `del ${formatDateTime(request.from)} al ${formatDateTime(request.to)}`
    : ''

  let announcement = ''
  let content
  if (!request) {
    content = (
      <EmptyState
        headingLevel="h3"
        icon={<HistoryIcon />}
        title="Elige un vehículo y un rango de fechas"
        description="Selecciona el vehículo, indica desde y hasta cuándo (hora de Colombia) y pulsa «Ver recorrido». Los rangos rápidos llenan las fechas por ti."
      />
    )
  } else if (track.isPending) {
    announcement = 'Cargando recorrido…'
    content = <TrackSkeleton />
  } else if (track.isError) {
    content = (
      <ErrorState
        headingLevel="h3"
        title="No pudimos cargar el recorrido"
        message={getErrorMessage(track.error)}
        onRetry={() => void track.refetch()}
        retrying={track.isFetching}
      />
    )
  } else if (track.data.points.length === 0) {
    announcement = 'No hay posiciones en el rango elegido.'
    content = (
      <EmptyState
        headingLevel="h3"
        icon={<HistoryIcon />}
        title="No hay recorrido en este rango"
        description={`${vehicleName} no reportó posiciones ${rangeText}. Prueba con otro rango, por ejemplo «Ayer» o «Últimas 24 h».`}
      />
    )
  } else {
    announcement = `Recorrido cargado: ${formatNumber(track.data.points.length)} puntos.`
    content = (
      <TrackResult
        key={`${request.vehicleId}|${request.from}|${request.to}|${track.dataUpdatedAt}`}
        track={track.data}
        reducedMotion={reducedMotion}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Historial de recorridos"
        description="Revisa por dónde pasó un vehículo, reprodúcelo y consulta su velocidad."
      />

      <Card as="section" className="history-query" aria-labelledby="history-query-title">
        <h2 id="history-query-title" className="history-section-title">
          Consulta
        </h2>
        <form className="history-form" noValidate onSubmit={onSubmit}>
          <Controller
            control={control}
            name="vehicle_id"
            render={({ field, fieldState }) => (
              <VehiclePicker
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                selectRef={field.ref}
                error={fieldState.error?.message}
              />
            )}
          />

          <fieldset className="history-form__range">
            <legend className="history-form__legend">Rango de fechas (hora de Colombia)</legend>
            <div className="history-presets" role="group" aria-label="Rangos rápidos">
              {RANGE_PRESETS.map((preset) => (
                <Button key={preset.id} variant="secondary" size="sm" onClick={() => applyPreset(preset.id)}>
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="history-form__dates">
              <TextField
                type="datetime-local"
                label="Desde"
                isRequired
                error={errors.from?.message}
                {...register('from')}
              />
              <TextField
                type="datetime-local"
                label="Hasta"
                isRequired
                hint={`Máximo ${MAX_RANGE_DAYS} días entre ambas fechas.`}
                error={errors.to?.message}
                {...register('to')}
              />
            </div>
          </fieldset>

          <div className="history-form__actions">
            <Button
              type="submit"
              icon={<HistoryIcon />}
              loading={track.isFetching}
              loadingText="Cargando recorrido…"
            >
              Ver recorrido
            </Button>
          </div>
        </form>
      </Card>

      <section className="history-results" aria-labelledby="history-results-title">
        <div className="history-results__header">
          <div>
            <h2 id="history-results-title" className="history-section-title">
              {request ? `Recorrido de ${vehicleName}` : 'Recorrido'}
            </h2>
            {request && <p className="history-results__range">Horas de Colombia, {rangeText}.</p>}
          </div>
          <div className="history-results__actions">
            {request && track.isFetching && !track.isPending && (
              <span className="history-results__refreshing">
                <Spinner size="sm" /> Actualizando…
              </span>
            )}
            {request && (
              <Link className="history-results__link" to={`/app/vehicles/${request.vehicleId}`}>
                Ver detalle del vehículo
              </Link>
            )}
          </div>
        </div>
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
        {content}
      </section>
    </>
  )
}
