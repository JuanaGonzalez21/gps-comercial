import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { useDashboardSummary } from '@/api/dashboard'
import { getErrorMessage } from '@/api/errors'
import type { DashboardSummary, Permission } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { LOCALE, TIME_ZONE, formatNumber } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { VEHICLE_STATUS_LABELS } from '@/lib/vehicleStatus'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  type IconProps,
  LinkButton,
  MapIcon,
  MovingIcon,
  NoSignalIcon,
  PageHeader,
  RefreshIcon,
  Skeleton,
  SteeringWheelIcon,
  StoppedIcon,
  TruckIcon,
  UnlinkIcon,
  UsersIcon,
} from '@/ui'
import { formatShare } from './chartMath'
import { DriverCoverageChart } from './DriverCoverageChart'
import { StatusDonut } from './StatusDonut'
import './dashboard.css'

// Fleet dashboard (RF-23): KPIs computed by the backend and two own-SVG charts, each with a
// table alternative. Refreshes every 30 s while the tab is visible (see api/dashboard.ts).

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

type KpiTone = 'brand' | 'moving' | 'stopped' | 'no_signal' | 'with' | 'without' | 'people'

interface KpiItem {
  id: string
  label: string
  value: number
  hint?: string
  tone: KpiTone
  Icon: ComponentType<IconProps>
  link?: { to: string; label: string; permission: Permission }
}

function kpiItems(summary: DashboardSummary): KpiItem[] {
  const total = summary.vehicles_total
  const status = summary.vehicles_by_status
  const ofFleet = (count: number) => `${formatShare(count, total)} de la flota`
  return [
    {
      id: 'vehicles',
      label: 'Vehículos',
      value: total,
      hint: 'Unidades visibles en Wialon',
      tone: 'brand',
      Icon: TruckIcon,
      link: { to: '/app/vehicles', label: 'Ver vehículos', permission: 'vehicles:read' },
    },
    {
      id: 'moving',
      label: VEHICLE_STATUS_LABELS.moving,
      value: status.moving,
      hint: ofFleet(status.moving),
      tone: 'moving',
      Icon: MovingIcon,
      link: { to: '/app/vehicles?status=moving', label: 'Ver en movimiento', permission: 'vehicles:read' },
    },
    {
      id: 'stopped',
      label: VEHICLE_STATUS_LABELS.stopped,
      value: status.stopped,
      hint: ofFleet(status.stopped),
      tone: 'stopped',
      Icon: StoppedIcon,
      link: { to: '/app/vehicles?status=stopped', label: 'Ver detenidos', permission: 'vehicles:read' },
    },
    {
      id: 'no_signal',
      label: VEHICLE_STATUS_LABELS.no_signal,
      value: status.no_signal,
      hint: ofFleet(status.no_signal),
      tone: 'no_signal',
      Icon: NoSignalIcon,
      link: { to: '/app/vehicles?status=no_signal', label: 'Ver sin señal', permission: 'vehicles:read' },
    },
    {
      id: 'with_driver',
      label: 'Con conductor',
      value: summary.vehicles_with_driver,
      hint: ofFleet(summary.vehicles_with_driver),
      tone: 'with',
      Icon: SteeringWheelIcon,
      link: { to: '/app/vehicles?has_driver=true', label: 'Ver con conductor', permission: 'vehicles:read' },
    },
    {
      id: 'without_driver',
      label: 'Sin conductor',
      value: summary.vehicles_without_driver,
      hint: ofFleet(summary.vehicles_without_driver),
      tone: 'without',
      Icon: UnlinkIcon,
      link: { to: '/app/vehicles?has_driver=false', label: 'Ver sin conductor', permission: 'vehicles:read' },
    },
    {
      id: 'drivers',
      label: 'Conductores',
      value: summary.drivers_total,
      hint: 'Registrados en los recursos',
      tone: 'people',
      Icon: SteeringWheelIcon,
      link: { to: '/app/drivers', label: 'Ver conductores', permission: 'drivers:read' },
    },
    {
      id: 'passengers',
      label: 'Pasajeros',
      value: summary.passengers_total,
      hint: 'Registrados en los recursos',
      tone: 'people',
      Icon: UsersIcon,
      link: { to: '/app/passengers', label: 'Ver pasajeros', permission: 'passengers:read' },
    },
  ]
}

function KpiGrid({ summary }: { summary: DashboardSummary }) {
  const { hasPermission } = useAuth()
  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="visually-hidden">
        Indicadores de la flota
      </h2>
      <dl className="kpi-grid">
        {kpiItems(summary).map(({ id, label, value, hint, tone, Icon, link }) => (
          <div key={id} className={`kpi kpi--${tone}`} data-testid={`kpi-${id}`}>
            <dt className="kpi__label">
              <Icon className="kpi__icon" />
              {label}
            </dt>
            <dd className="kpi__value">{formatNumber(value)}</dd>
            {hint && <dd className="kpi__hint">{hint}</dd>}
            {link && hasPermission(link.permission) && (
              <dd className="kpi__link">
                <Link to={link.to}>{link.label}</Link>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

function ChartCard({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card as="section" className="chart-card" aria-labelledby={id}>
      <header className="chart-card__header">
        <h2 id={id} className="chart-card__title">
          {title}
        </h2>
        <p className="chart-card__description">{description}</p>
      </header>
      {children}
      {footer && <div className="chart-card__footer">{footer}</div>}
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <p className="visually-hidden" role="status">
        Cargando indicadores…
      </p>
      <div className="kpi-grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="kpi">
            <Skeleton width="60%" height="0.875rem" />
            <Skeleton width="40%" height="2rem" />
            <Skeleton width="70%" height="0.75rem" />
          </div>
        ))}
      </div>
      <div className="dashboard-charts" aria-hidden="true">
        {[0, 1].map((index) => (
          <div key={index} className="chart-card card card--padded">
            <Skeleton width="50%" height="1.25rem" />
            <Skeleton height="12rem" />
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

  const freshness = data && (
    <div className="dashboard-freshness">
      <p className="dashboard-freshness__text">
        Actualizado <time dateTime={data.generated_at}>{formatClock(data.generated_at)}</time>
      </p>
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshIcon />}
        onClick={() => void summary.refetch()}
        loading={summary.isFetching}
        loadingText="Actualizando…"
      >
        Actualizar
      </Button>
    </div>
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
  } else {
    const empty = data.vehicles_total === 0
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
        <KpiGrid summary={data} />
        <div className="dashboard-charts">
          <ChartCard
            id="chart-status-title"
            title="Distribución por estado"
            description="Estado derivado por el servidor: en movimiento, detenido o sin señal."
            footer={
              hasPermission('vehicles:read') && (
                <LinkButton to="/app/vehicles" variant="secondary" size="sm" icon={<MapIcon />}>
                  Ver vehículos en el mapa
                </LinkButton>
              )
            }
          >
            {empty ? (
              <EmptyState
                headingLevel="h3"
                icon={<TruckIcon />}
                title="Aún no hay vehículos"
                description="Cuando la cuenta de Wialon tenga unidades visibles, verás aquí su estado."
              />
            ) : (
              <StatusDonut byStatus={data.vehicles_by_status} total={data.vehicles_total} />
            )}
          </ChartCard>
          <ChartCard
            id="chart-drivers-title"
            title="Vehículos con conductor"
            description="Conductores vinculados a cada unidad en Wialon."
          >
            {empty ? (
              <EmptyState
                headingLevel="h3"
                icon={<SteeringWheelIcon />}
                title="Sin datos de asignación"
                description="No hay vehículos a los que vincular conductores todavía."
              />
            ) : (
              <DriverCoverageChart
                withDriver={data.vehicles_with_driver}
                withoutDriver={data.vehicles_without_driver}
              />
            )}
          </ChartCard>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Panel"
        description={
          user
            ? `Hola, ${user.full_name}. Así está la flota ahora; los datos se renuevan cada 30 segundos.`
            : 'Así está la flota ahora; los datos se renuevan cada 30 segundos.'
        }
        actions={freshness}
      />
      {content}
    </>
  )
}
