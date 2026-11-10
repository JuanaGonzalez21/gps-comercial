import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Link, useParams } from 'react-router'
import { useAssignDriver, useUnassignDriver } from '@/api/drivers'
import { getErrorMessage, isApiError } from '@/api/errors'
import { useAssignPassenger, useUnassignPassenger } from '@/api/passengers'
import type { DriverRef, PassengerRef, Position, VehicleDetail, VehicleMarker } from '@/api/types'
import { useVehicleDetail } from '@/api/vehicleDetail'
import { useAuth } from '@/auth/useAuth'
import {
  formatCourse,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatSpeed,
  LOCALE,
  NO_DATA,
} from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import {
  Alert,
  Button,
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  ErrorState,
  HistoryIcon,
  LinkButton,
  LinkIcon,
  PageHeader,
  PinOffIcon,
  Skeleton,
  SteeringWheelIcon,
  StatusBadge,
  TruckIcon,
  UnlinkIcon,
  UsersIcon,
  useToast,
} from '@/ui'
import { ConfirmAction } from '@/features/drivers/shared/ConfirmAction'
import { AssignPersonDialog } from './AssignPersonDialog'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { useDriverOptions, usePassengerOptions } from './personOptions'
import { VehiclePositionMap } from './VehiclePositionMap'
import './vehicles.css'

const coordinateFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

/** Route ids are Wialon unit ids: positive integers. Anything else cannot exist. */
function parseVehicleId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Ruta de navegación" className="breadcrumb">
      <ol>
        <li>
          <Link to="/app/vehicles">Vehículos</Link>
        </li>
        <li aria-current="page">
          <ChevronRightIcon className="breadcrumb__separator" />
          <span>{current}</span>
        </li>
      </ol>
    </nav>
  )
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="detail-list__item">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

interface CardHeaderProps {
  id: string
  title: string
  description?: ReactNode
  /** Short figure on the right of the title (for example "2 vinculados"). */
  meta?: ReactNode
  /** Focus target when the button that opened a dialog no longer exists. */
  titleRef?: Ref<HTMLHeadingElement>
}

function CardHeader({ id, title, description, meta, titleRef }: CardHeaderProps) {
  return (
    <div className="card-head vehicle-detail__card-head">
      <div>
        <h2 id={id} ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="card-title">
          {title}
        </h2>
        {description && <p className="card-subtitle">{description}</p>}
      </div>
      {meta && <p className="card-meta">{meta}</p>}
    </div>
  )
}

/** Small inline empty state for a card (the page already has its own headings). */
function CardEmpty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="detail-empty">
      <span className="detail-empty__icon">{icon}</span>
      <div>
        <p className="detail-empty__title">{title}</p>
        {children && <div className="detail-empty__text">{children}</div>}
      </div>
    </div>
  )
}

function PositionCard({ vehicle }: { vehicle: VehicleDetail }) {
  const position: Position | null = vehicle.position
  const marker = useMemo<VehicleMarker | null>(
    () =>
      position && {
        id: vehicle.id,
        name: vehicle.name,
        status: vehicle.status,
        latitude: position.latitude,
        longitude: position.longitude,
        speed_kmh: position.speed_kmh,
        course_deg: position.course_deg,
        last_message_at: vehicle.last_message_at,
        driver_name: vehicle.driver?.name ?? null,
      },
    [vehicle.id, vehicle.name, vehicle.status, vehicle.last_message_at, vehicle.driver?.name, position],
  )

  return (
    <Card as="section" className="vehicle-detail__card vehicle-detail__card--position" aria-labelledby="vehicle-position-title">
      <CardHeader
        id="vehicle-position-title"
        title="Posición actual"
        description="Se actualiza cada 15 segundos mientras ves esta página."
      />
      {position && marker ? (
        <>
          <VehiclePositionMap vehicle={marker} />
          <dl className="detail-list detail-list--grid">
            <Detail term="Velocidad">{formatSpeed(position.speed_kmh)}</Detail>
            <Detail term="Rumbo">
              {formatCourse(position.course_deg)}
              {position.course_deg !== null && <span className="detail-list__extra"> · {position.course_deg}°</span>}
            </Detail>
            <Detail term="Altitud">
              {position.altitude_m === null ? NO_DATA : `${formatNumber(position.altitude_m)} m`}
            </Detail>
            <Detail term="Satélites">{formatNumber(position.satellites)}</Detail>
            <Detail term="Latitud">{coordinateFormatter.format(position.latitude)}</Detail>
            <Detail term="Longitud">{coordinateFormatter.format(position.longitude)}</Detail>
            <Detail term="Hora de la posición">
              <time dateTime={position.recorded_at}>{formatDateTime(position.recorded_at)}</time>
            </Detail>
          </dl>
        </>
      ) : (
        <CardEmpty icon={<PinOffIcon />} title="Sin posición">
          <p>
            El último reporte de este vehículo no trae coordenadas válidas, por eso no aparece en el mapa.
            Cuando informe una posición se mostrará aquí.
          </p>
        </CardEmpty>
      )}
    </Card>
  )
}

/**
 * After an assignment or an unassignment the button that opened the dialog is gone (or replaced):
 * once the dialog has closed, focus moves to the card title instead of getting lost.
 */
function useFocusAfterDialog(open: boolean) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const pending = useRef(false)
  useEffect(() => {
    if (open || !pending.current) return
    pending.current = false
    titleRef.current?.focus()
  }, [open])
  const focusTitleOnClose = () => {
    pending.current = true
  }
  return { titleRef, focusTitleOnClose }
}

function UnlinkButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    // The accessible name starts with the visible label (WCAG 2.5.3) and says who is unlinked.
    <Button
      variant="ghost"
      size="sm"
      icon={<UnlinkIcon />}
      className="person__action"
      aria-label={`Desvincular a ${name}`}
      onClick={onClick}
    >
      Desvincular
    </Button>
  )
}

function assignedMessage(person: { name: string; vehicle: { name: string } | null }, vehicleName: string): string {
  return person.vehicle
    ? `«${person.name}» pasó de «${person.vehicle.name}» a «${vehicleName}».`
    : `«${person.name}» quedó vinculado a «${vehicleName}».`
}

type DriverDialog = { kind: 'assign' } | { kind: 'unassign'; driver: DriverRef }

function DriverCard({ vehicle, canAssign }: { vehicle: VehicleDetail; canAssign: boolean }) {
  const { driver } = vehicle
  const toast = useToast()
  const assignDriver = useAssignDriver()
  const unassignDriver = useUnassignDriver()
  const [dialog, setDialog] = useState<DriverDialog | null>(null)
  const { titleRef, focusTitleOnClose } = useFocusAfterDialog(dialog !== null)
  const closeDialog = () => setDialog(null)

  const confirmUnassign = (current: DriverRef) =>
    unassignDriver.mutate(current, {
      onSuccess: () => {
        focusTitleOnClose()
        closeDialog()
        toast.show({
          tone: 'success',
          title: 'Conductor desvinculado',
          description: `«${current.name}» ya no está vinculado a «${vehicle.name}».`,
        })
      },
    })

  return (
    <Card as="section" className="vehicle-detail__card" aria-labelledby="vehicle-driver-title">
      <CardHeader id="vehicle-driver-title" title="Conductor asignado" titleRef={titleRef} />
      {driver ? (
        <div className="person person--driver">
          <span className="person__icon person__icon--driver">
            <SteeringWheelIcon />
          </span>
          <div className="person__text">
            <p className="person__name">{driver.name}</p>
            <p className="person__meta">
              {driver.phone ? (
                <a className="person__phone" href={telHref(driver.phone)}>
                  <span className="visually-hidden">Teléfono: </span>
                  {driver.phone}
                </a>
              ) : (
                'Sin teléfono registrado'
              )}
            </p>
            <p className="person__meta">Vinculado en Wialon</p>
          </div>
          {canAssign && (
            <UnlinkButton
              name={driver.name}
              onClick={() => {
                unassignDriver.reset()
                setDialog({ kind: 'unassign', driver })
              }}
            />
          )}
        </div>
      ) : (
        <>
          <CardEmpty icon={<SteeringWheelIcon />} title="Sin conductor asignado">
            <p>Este vehículo no tiene un conductor vinculado en Wialon.</p>
          </CardEmpty>
          {/* Only without a driver: a vehicle has one driver, so changing it is unlink, then assign. */}
          {canAssign && (
            <Button
              variant="secondary"
              size="sm"
              icon={<LinkIcon />}
              className="vehicle-detail__card-action"
              onClick={() => setDialog({ kind: 'assign' })}
            >
              Asignar conductor
            </Button>
          )}
        </>
      )}

      {dialog?.kind === 'assign' && (
        <AssignPersonDialog
          kind="driver"
          vehicle={vehicle}
          useOptions={useDriverOptions}
          onClose={closeDialog}
          onAssign={async (person) => {
            await assignDriver.mutateAsync({ ref: person, unitId: vehicle.id })
            focusTitleOnClose()
            closeDialog()
            toast.show({ tone: 'success', title: 'Conductor asignado', description: assignedMessage(person, vehicle.name) })
          }}
        />
      )}
      {dialog?.kind === 'unassign' && (
        <ConfirmAction
          title={`¿Desvincular a «${dialog.driver.name}»?`}
          message={`El conductor dejará de estar vinculado a «${vehicle.name}» en Wialon. Puedes volver a asignarlo después.`}
          confirmLabel="Desvincular"
          destructive={false}
          busy={unassignDriver.isPending}
          error={unassignDriver.error}
          errorTitle="No se pudo desvincular"
          onConfirm={() => confirmUnassign(dialog.driver)}
          onCancel={closeDialog}
        />
      )}
    </Card>
  )
}

type PassengerDialog = { kind: 'assign' } | { kind: 'unassign'; passenger: PassengerRef }

function PassengersCard({ vehicle, canAssign }: { vehicle: VehicleDetail; canAssign: boolean }) {
  const { passengers } = vehicle
  const toast = useToast()
  const assignPassenger = useAssignPassenger()
  const unassignPassenger = useUnassignPassenger()
  const [dialog, setDialog] = useState<PassengerDialog | null>(null)
  const { titleRef, focusTitleOnClose } = useFocusAfterDialog(dialog !== null)
  const closeDialog = () => setDialog(null)

  const confirmUnassign = (current: PassengerRef) =>
    unassignPassenger.mutate(current, {
      onSuccess: () => {
        focusTitleOnClose()
        closeDialog()
        toast.show({
          tone: 'success',
          title: 'Pasajero desvinculado',
          description: `«${current.name}» ya no está vinculado a «${vehicle.name}».`,
        })
      },
    })

  return (
    <Card as="section" className="vehicle-detail__card" aria-labelledby="vehicle-passengers-title">
      <CardHeader
        id="vehicle-passengers-title"
        title="Pasajeros asignados"
        titleRef={titleRef}
        meta={
          passengers.length === 0
            ? undefined
            : passengers.length === 1
              ? '1 vinculado'
              : `${formatNumber(passengers.length)} vinculados`
        }
      />
      {passengers.length > 0 ? (
        <ul className="person-list" role="list">
          {passengers.map((passenger) => (
            <li key={`${passenger.resource_id}-${passenger.id}`} className="person">
              <span className="person__icon">
                <UsersIcon />
              </span>
              <div className="person__text">
                <p className="person__name">{passenger.name}</p>
                <p className="person__meta">
                  {passenger.phone ? (
                    <a className="person__phone" href={telHref(passenger.phone)}>
                      <span className="visually-hidden">Teléfono de {passenger.name}: </span>
                      {passenger.phone}
                    </a>
                  ) : (
                    'Sin teléfono registrado'
                  )}
                </p>
              </div>
              {canAssign && (
                <UnlinkButton
                  name={passenger.name}
                  onClick={() => {
                    unassignPassenger.reset()
                    setDialog({ kind: 'unassign', passenger })
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <CardEmpty icon={<UsersIcon />} title="Sin pasajeros asignados">
          <p>Ningún pasajero está vinculado a este vehículo en Wialon.</p>
        </CardEmpty>
      )}
      {canAssign && (
        <Button
          variant="secondary"
          size="sm"
          icon={<LinkIcon />}
          className="vehicle-detail__card-action"
          onClick={() => setDialog({ kind: 'assign' })}
        >
          Asignar pasajero
        </Button>
      )}

      {dialog?.kind === 'assign' && (
        <AssignPersonDialog
          kind="passenger"
          vehicle={vehicle}
          useOptions={usePassengerOptions}
          onClose={closeDialog}
          onAssign={async (person) => {
            await assignPassenger.mutateAsync({ ref: person, unitId: vehicle.id })
            closeDialog()
            toast.show({ tone: 'success', title: 'Pasajero asignado', description: assignedMessage(person, vehicle.name) })
          }}
        />
      )}
      {dialog?.kind === 'unassign' && (
        <ConfirmAction
          title={`¿Desvincular a «${dialog.passenger.name}»?`}
          message={`El pasajero dejará de estar vinculado a «${vehicle.name}» en Wialon. Puedes volver a asignarlo después.`}
          confirmLabel="Desvincular"
          destructive={false}
          busy={unassignPassenger.isPending}
          error={unassignPassenger.error}
          errorTitle="No se pudo desvincular"
          onConfirm={() => confirmUnassign(dialog.passenger)}
          onCancel={closeDialog}
        />
      )}
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <>
      <p className="visually-hidden" role="status">
        Cargando el vehículo…
      </p>
      <div className="vehicle-detail__skeleton-header" aria-hidden="true">
        <Skeleton width="16rem" height="2rem" />
        <Skeleton width="20rem" />
      </div>
      <div className="vehicle-detail__grid" aria-hidden="true">
        <div className="card card--padded vehicle-detail__card vehicle-detail__card--position">
          <Skeleton width="10rem" height="1.25rem" />
          <Skeleton height="20rem" />
          <Skeleton height="8rem" />
        </div>
        <div className="vehicle-detail__aside">
          <div className="card card--padded vehicle-detail__card">
            <Skeleton width="10rem" height="1.25rem" />
            <Skeleton width="70%" />
          </div>
          <div className="card card--padded vehicle-detail__card">
            <Skeleton width="10rem" height="1.25rem" />
            <Skeleton width="60%" />
            <Skeleton width="65%" />
          </div>
        </div>
      </div>
    </>
  )
}

function NotFoundState() {
  return (
    <>
      <Breadcrumb current="Vehículo no encontrado" />
      <div className="state-block">
        <div className="state-block__icon">
          <TruckIcon />
        </div>
        <h1 className="state-block__title">Vehículo no encontrado</h1>
        <p className="state-block__text">
          No existe un vehículo con esta dirección o ya no está disponible en la cuenta de Wialon.
        </p>
        <div className="state-block__action">
          <LinkButton to="/app/vehicles" variant="secondary" icon={<ChevronLeftIcon />}>
            Volver a vehículos
          </LinkButton>
        </div>
      </div>
    </>
  )
}

/** Vehicle detail (RF-12): transformed data, position, status, driver (RF-13), passengers (RF-09)
 * and custom fields (RF-19..RF-22). */
export default function VehicleDetailPage() {
  const params = useParams()
  const vehicleId = parseVehicleId(params.id)
  const detail = useVehicleDetail(vehicleId)
  const { hasPermission } = useAuth()
  const vehicle = detail.data
  useDocumentTitle(vehicle ? vehicle.name : 'Detalle del vehículo')

  const notFound =
    vehicleId === null || (!vehicle && isApiError(detail.error) && detail.error.status === 404)
  if (notFound) return <NotFoundState />

  if (!vehicle && detail.isError) {
    return (
      <>
        <Breadcrumb current="Detalle del vehículo" />
        <PageHeader title="Detalle del vehículo" />
        <ErrorState
          title="No pudimos cargar el vehículo"
          message={getErrorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </>
    )
  }

  if (!vehicle) {
    return (
      <>
        <Breadcrumb current="Detalle del vehículo" />
        <DetailSkeleton />
      </>
    )
  }

  const canAssign = hasPermission('assignments:write')
  const lastMessage = vehicle.last_message_at

  return (
    <>
      <Breadcrumb current={vehicle.name} />
      <PageHeader
        title={vehicle.name}
        description={
          <span className="vehicle-detail__meta">
            <StatusBadge status={vehicle.status} />
            <span>
              Última actualización:{' '}
              {lastMessage ? (
                <>
                  <time dateTime={lastMessage} className="vehicle-detail__nowrap">
                    {formatDateTime(lastMessage)}
                  </time>{' '}
                  <span className="vehicle-detail__nowrap">({formatRelative(lastMessage)})</span>
                </>
              ) : (
                'sin reportes'
              )}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton to="/app/vehicles" variant="ghost" size="sm" icon={<ChevronLeftIcon />}>
              Volver a la lista
            </LinkButton>
            {hasPermission('history:read') && (
              <LinkButton
                to={`/app/history?vehicle=${vehicle.id}`}
                variant="secondary"
                size="sm"
                icon={<HistoryIcon />}
              >
                Ver historial
              </LinkButton>
            )}
          </>
        }
      />

      {detail.isError && (
        <Alert
          tone="warning"
          role="status"
          className="vehicles-alert"
          title="No se pudo actualizar la información"
          action={
            <Button size="sm" variant="secondary" onClick={() => void detail.refetch()}>
              Reintentar
            </Button>
          }
        >
          {`Se muestran los últimos datos recibidos. ${getErrorMessage(detail.error)}`}
        </Alert>
      )}

      <div className="vehicle-detail__grid">
        <PositionCard vehicle={vehicle} />
        <div className="vehicle-detail__aside">
          <DriverCard vehicle={vehicle} canAssign={canAssign} />
          <PassengersCard vehicle={vehicle} canAssign={canAssign} />
        </div>
        <CustomFieldsEditor vehicleId={vehicle.id} />
      </div>
    </>
  )
}
