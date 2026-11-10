import { lazy, Suspense, useState, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDashboardSummary } from '@/api/dashboard'
import { getErrorMessage } from '@/api/errors'
import type { DashboardSummary, VehicleStatus } from '@/api/types'
import { useVehiclePositions, useVehicles } from '@/api/vehicles'
import { useAuth } from '@/auth/useAuth'
import { LOCALE, TIME_ZONE, formatDateTimeShort, formatNumber, formatRelative } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import {
  Alert,
  ArrowRightIcon,
  Button,
  Card,
  ChevronRightIcon,
  EmptyState,
  ErrorState,
  type IconProps,
  LinkButton,
  MapIcon,
  MovingIcon,
  NoSignalIcon,
  PageHeader,
  PinOffIcon,
  RefreshIcon,
  Skeleton,
  SteeringWheelIcon,
  StoppedIcon,
  TruckIcon,
  UsersIcon,
} from '@/ui'
import { MapLegend } from '@/map/MapLegend'
import { formatShare } from './chartMath'
import './dashboard.css'

// Fleet dashboard (RF-23): backend KPIs, two visualisations with text alternatives (status bar and
// driver coverage bars) plus the fleet map and the vehicles that need attention. KPIs refresh every
// 30 s while the tab is visible (api/dashboard.ts); every figure links to its filtered list.

// Leaflet (~180 kB) loads only when the map card is rendered.
const VehicleMap = lazy(() => import('@/map/VehicleMap').then((module) => ({ default: module.VehicleMap })))

const clockFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function formatClock(value: string | number): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin dato' : clockFormatter.format(date)
}

const STATUS_ICONS: Record<VehicleStatus, ComponentType<IconProps>> = {
  moving: MovingIcon,
  stopped: StoppedIcon,
  no_signal: NoSignalIcon,
}

const ATTENTION_LIMIT = 4

/* ---------- Estado de la flota ---------- */

function FleetStatusCard({ summary, canSeeVehicles }: { summary: DashboardSummary; canSeeVehicles: boolean }) {
  const total = summary.vehicles_total
  const byStatus = summary.vehicles_by_status
  const barLabel = VEHICLE_STATUSES.map(
    (status) => `${formatNumber(byStatus[status])} ${VEHICLE_STATUS_LABELS[status].toLowerCase()}`,
  ).join(', ')

  return (
    <Card as="section" className="dash-card dash-card--wide" aria-labelledby="fleet-status-title">
      <div className="dash-card__head">
        <div>
          <h2 id="fleet-status-title" className="dash-kicker">
            Estado de la flota
          </h2>
          <p className="dash-figure" data-testid="kpi-vehicles">
            <span className="dash-figure__value">{formatNumber(total)}</span>
            <span className="dash-figure__label">vehículos visibles en Wialon</span>
          </p>
        </div>
        {canSeeVehicles && (
          <LinkButton to="/app/vehicles" variant="soft" size="sm" trailingIcon={<ArrowRightIcon />}>
            Ver vehículos
          </LinkButton>
        )}
      </div>

      {total > 0 && (
        // Visualisation 1: share of each status. The tiles below repeat every value as text.
        <div className="status-bar" role="img" aria-label={`Distribución de ${formatNumber(total)} vehículos por estado: ${barLabel}`}>
          {VEHICLE_STATUSES.filter((status) => byStatus[status] > 0).map((status) => (
            <span
              key={status}
              className={`status-bar__segment status-bar__segment--${status}`}
              style={{ flexGrow: byStatus[status] }}
            />
          ))}
        </div>
      )}

      <ul role="list" className="status-tiles">
        {VEHICLE_STATUSES.map((status) => {
          const Icon = STATUS_ICONS[status]
          const content = (
            <>
              <span className="status-tile__head">
                <span className={`status-tile__icon status-tile__icon--${status}`}>
                  <Icon />
                </span>
                <span className="status-tile__label">{VEHICLE_STATUS_LABELS[status]}</span>
                {canSeeVehicles && <ChevronRightIcon className="status-tile__chevron" />}
              </span>
              <span className="status-tile__figure">
                <span className="status-tile__value">{formatNumber(byStatus[status])}</span>
                <span className="status-tile__share">{formatShare(byStatus[status], total)} de la flota</span>
              </span>
            </>
          )
          return (
            <li key={status} data-testid={`kpi-${status}`}>
              {canSeeVehicles ? (
                <Link to={`/app/vehicles?status=${status}`} className="status-tile">
                  {content}
                </Link>
              ) : (
                <div className="status-tile">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ---------- Asignación de conductores ---------- */

function CoverageRow({
  testId,
  label,
  value,
  total,
  tone,
  to,
}: {
  testId: string
  label: string
  value: number
  total: number
  tone: 'with' | 'without'
  to: string | null
}) {
  const share = formatShare(value, total)
  const width = total > 0 ? `${(value / total) * 100}%` : '0%'
  const body = (
    <>
      <span className="coverage-row__text">
        <span className="coverage-row__label">{label}</span>
        <span className="coverage-row__value">
          <strong>{formatNumber(value)}</strong> <span className="coverage-row__share">· {share}</span>
        </span>
      </span>
      {/* Visualisation 2: the bar repeats the share written next to it. */}
      <span className="coverage-row__track" aria-hidden="true">
        <span className={`coverage-row__bar coverage-row__bar--${tone}`} style={{ width }} data-testid={`coverage-bar-${tone}`} />
      </span>
    </>
  )
  return (
    <li data-testid={testId}>
      {to ? (
        <Link to={to} className="coverage-row">
          {body}
        </Link>
      ) : (
        <div className="coverage-row">{body}</div>
      )}
    </li>
  )
}

function DriverCoverageCard({ summary }: { summary: DashboardSummary }) {
  const { hasPermission } = useAuth()
  const total = summary.vehicles_total
  const canSeeVehicles = hasPermission('vehicles:read')
  const people = [
    { id: 'drivers', label: 'Conductores', value: summary.drivers_total, Icon: SteeringWheelIcon, to: '/app/drivers', permission: 'drivers:read' as const },
    { id: 'passengers', label: 'Pasajeros', value: summary.passengers_total, Icon: UsersIcon, to: '/app/passengers', permission: 'passengers:read' as const },
  ]

  return (
    <Card as="section" className="dash-card dash-card--narrow" aria-labelledby="coverage-title">
      <div>
        <h2 id="coverage-title" className="dash-kicker">
          Asignación de conductores
        </h2>
        <p className="dash-figure">
          <span className="dash-figure__value dash-figure__value--accent">
            {formatShare(summary.vehicles_with_driver, total)}
          </span>
          <span className="dash-figure__label">de los vehículos tiene conductor</span>
        </p>
      </div>
      <ul role="list" className="coverage-list">
        <CoverageRow
          testId="kpi-with_driver"
          label="Con conductor"
          value={summary.vehicles_with_driver}
          total={total}
          tone="with"
          to={canSeeVehicles ? '/app/vehicles?has_driver=true' : null}
        />
        <CoverageRow
          testId="kpi-without_driver"
          label="Sin conductor"
          value={summary.vehicles_without_driver}
          total={total}
          tone="without"
          to={canSeeVehicles ? '/app/vehicles?has_driver=false' : null}
        />
      </ul>
      <ul role="list" className="people-tiles">
        {people.map(({ id, label, value, Icon, to, permission }) => {
          const content = (
            <>
              <span className="people-tile__label">
                <Icon />
                {label}
              </span>
              <span className="people-tile__value">{formatNumber(value)}</span>
            </>
          )
          return (
            <li key={id} data-testid={`kpi-${id}`}>
              {hasPermission(permission) ? (
                <Link to={to} className="people-tile" aria-label={`${label}: ${formatNumber(value)}. Ver ${label.toLowerCase()}`}>
                  {content}
                </Link>
              ) : (
                <div className="people-tile">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ---------- Mapa de la flota ---------- */

function FleetMapCard() {
  const navigate = useNavigate()
  const positions = useVehiclePositions({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const markers = positions.data?.items ?? []

  return (
    <Card as="section" className="dash-card dash-card--wide dash-card--map" aria-labelledby="fleet-map-title">
      <div className="dash-card__head dash-card__head--center">
        <h2 id="fleet-map-title" className="card-title">
          Mapa de la flota
        </h2>
        <LinkButton to="/app/vehicles" variant="secondary" size="sm" icon={<MapIcon />}>
          Abrir mapa
        </LinkButton>
      </div>
      <div className="dash-map">
        <Suspense fallback={<Skeleton height="100%" />}>
          <VehicleMap
            markers={markers}
            selectedId={selectedId}
            focusRequest={0}
            fitKey="dashboard"
            onSelect={setSelectedId}
            onOpenDetail={(id) => navigate(`/app/vehicles/${id}`)}
          >
            {positions.isError && !positions.data && (
              <p className="map-message" role="alert">
                No pudimos cargar las posiciones. {getErrorMessage(positions.error)}
              </p>
            )}
          </VehicleMap>
        </Suspense>
      </div>
      <MapLegend />
    </Card>
  )
}

/* ---------- Requiere atención ---------- */

function AttentionCard({ noSignal }: { noSignal: number }) {
  // Longest silence first: those are the vehicles to check before anything else.
  const list = useVehicles({ status: 'no_signal', page: 1, page_size: ATTENTION_LIMIT, sort: 'last_message_at' })
  const items = list.data?.items ?? []

  return (
    <Card as="section" className="dash-card dash-card--narrow" aria-labelledby="attention-title">
      <div className="attention-head">
        <span className="attention-head__icon" aria-hidden="true">
          <PinOffIcon />
        </span>
        <div>
          <h2 id="attention-title" className="card-title">
            Requiere atención
          </h2>
          <p className="card-subtitle">
            {noSignal === 0
              ? 'Todos los vehículos reportan señal.'
              : `${formatNumber(noSignal)} ${noSignal === 1 ? 'vehículo sin señal' : 'vehículos sin señal'}`}
          </p>
        </div>
      </div>

      {noSignal > 0 && (
        <>
          {list.isPending ? (
            <div className="attention-list" aria-hidden="true">
              {Array.from({ length: Math.min(noSignal, ATTENTION_LIMIT) }, (_, index) => (
                <Skeleton key={index} height="3rem" />
              ))}
            </div>
          ) : list.isError ? (
            <p className="card-subtitle" role="alert">
              No pudimos cargar la lista. {getErrorMessage(list.error)}
            </p>
          ) : (
            <ul role="list" className="attention-list">
              {items.map((vehicle) => (
                <li key={vehicle.id}>
                  <Link to={`/app/vehicles/${vehicle.id}`} className="attention-item">
                    <span className="attention-item__text">
                      <span className="attention-item__name">{vehicle.name}</span>
                      <span className="attention-item__meta">
                        Última posición {formatDateTimeShort(vehicle.last_message_at)}
                        {vehicle.last_message_at && ` · ${formatRelative(vehicle.last_message_at)}`}
                      </span>
                    </span>
                    <ChevronRightIcon className="attention-item__chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <LinkButton
            to="/app/vehicles?status=no_signal"
            variant="soft"
            fullWidth
            className="attention-all"
            trailingIcon={<ArrowRightIcon />}
          >
            {noSignal === 1 ? 'Ver el vehículo sin señal' : `Ver los ${formatNumber(noSignal)} sin señal`}
          </LinkButton>
        </>
      )}
    </Card>
  )
}

/* ---------- Page ---------- */

function DashboardSkeleton() {
  return (
    <>
      <p className="visually-hidden" role="status">
        Cargando indicadores…
      </p>
      <div className="dash-grid" aria-hidden="true">
        {['wide', 'narrow', 'wide', 'narrow'].map((size, index) => (
          <div key={index} className={`card dash-card dash-card--${size}`}>
            <Skeleton width="40%" height="1rem" />
            <Skeleton width="30%" height="2.75rem" />
            <Skeleton height="7rem" />
          </div>
        ))}
      </div>
    </>
  )
}

export default function DashboardPage() {
  useDocumentTitle('Panel')
  const { user, hasPermission } = useAuth()
  const summary = useDashboardSummary()
  const data = summary.data
  const canSeeVehicles = hasPermission('vehicles:read')

  const freshness = data && (
    <>
      <p className="live-indicator">
        Actualizado <time dateTime={data.generated_at}>{formatClock(data.generated_at)}</time>· cada 30 s
      </p>
      <Button
        variant="secondary"
        icon={<RefreshIcon />}
        onClick={() => void summary.refetch()}
        loading={summary.isFetching}
        loadingText="Actualizando…"
      >
        Actualizar
      </Button>
    </>
  )

  let content
  if (!data && summary.isError) {
    content = (
      <ErrorState
        title="No pudimos cargar los indicadores"
        message={getErrorMessage(summary.error)}
        onRetry={() => void summary.refetch()}
        retrying={summary.isFetching}
      />
    )
  } else if (!data) {
    content = <DashboardSkeleton />
  } else if (data.vehicles_total === 0) {
    content = (
      <Card>
        <EmptyState
          icon={<TruckIcon />}
          title="Aún no hay vehículos"
          description="Cuando la cuenta de Wialon tenga unidades visibles, verás aquí su estado, sus conductores y el mapa."
        />
      </Card>
    )
  } else {
    content = (
      <>
        {summary.isError && (
          <Alert
            tone="warning"
            role="status"
            className="dashboard-alert"
            title="No pudimos actualizar los indicadores"
            action={
              <Button variant="secondary" size="sm" onClick={() => void summary.refetch()}>
                Reintentar
              </Button>
            }
          >
            Se muestran los datos de las {formatClock(data.generated_at)}. {getErrorMessage(summary.error)}
          </Alert>
        )}
        <div className="dash-grid">
          <FleetStatusCard summary={data} canSeeVehicles={canSeeVehicles} />
          <DriverCoverageCard summary={data} />
          {canSeeVehicles && <FleetMapCard />}
          {canSeeVehicles && <AttentionCard noSignal={data.vehicles_by_status.no_signal} />}
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Panel"
        description={user ? `Hola, ${user.full_name}. Así está la flota ahora.` : 'Así está la flota ahora.'}
        actions={freshness}
      />
      {content}
    </>
  )
}
