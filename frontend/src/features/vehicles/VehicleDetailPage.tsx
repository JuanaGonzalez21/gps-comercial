import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { Position, VehicleDetail, VehicleMarker } from '@/api/types'
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
  PageHeader,
  PinOffIcon,
  Skeleton,
  SteeringWheelIcon,
  StatusBadge,
  TruckIcon,
  UsersIcon,
} from '@/ui'
import { CustomFieldsEditor } from './CustomFieldsEditor'
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
}

function CardHeader({ id, title, description, meta }: CardHeaderProps) {
  return (
    <div className="card-head vehicle-detail__card-head">
      <div>
        <h2 id={id} className="card-title">
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

function DriverCard({ vehicle, canAssign }: { vehicle: VehicleDetail; canAssign: boolean }) {
  const { driver } = vehicle
  return (
    <Card as="section" className="vehicle-detail__card" aria-labelledby="vehicle-driver-title">
      <CardHeader id="vehicle-driver-title" title="Conductor asignado" />
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
        </div>
      ) : (
        <CardEmpty icon={<SteeringWheelIcon />} title="Sin conductor asignado">
          <p>Este vehículo no tiene un conductor vinculado en Wialon.</p>
          {canAssign && (
            <p>
              <Link to="/app/drivers">Asignar un conductor desde Conductores</Link>
            </p>
          )}
        </CardEmpty>
      )}
    </Card>
  )
}

function PassengersCard({ vehicle, canAssign }: { vehicle: VehicleDetail; canAssign: boolean }) {
  const { passengers } = vehicle
  return (
    <Card as="section" className="vehicle-detail__card" aria-labelledby="vehicle-passengers-title">
      <CardHeader
        id="vehicle-passengers-title"
        title="Pasajeros asignados"
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
            </li>
          ))}
        </ul>
      ) : (
        <CardEmpty icon={<UsersIcon />} title="Sin pasajeros asignados">
          <p>Ningún pasajero está vinculado a este vehículo en Wialon.</p>
          {canAssign && (
            <p>
              <Link to="/app/passengers">Asignar pasajeros desde Pasajeros</Link>
            </p>
          )}
        </CardEmpty>
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
