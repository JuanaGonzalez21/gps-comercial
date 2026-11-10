import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { Card, LinkButton, PageHeader, TruckIcon } from '@/ui'

// Minimal entry page. The KPI dashboard (RF-23) is a separate task and is not built yet.
export default function DashboardPage() {
  useDocumentTitle('Panel')
  const { user } = useAuth()
  return (
    <>
      <PageHeader title="Panel" description={user ? `Hola, ${user.full_name}.` : undefined} />
      <Card as="section" className="stack" aria-labelledby="dashboard-monitoring-title">
        <h2 id="dashboard-monitoring-title">Monitoreo de vehículos</h2>
        <p>
          Consulta en el mapa la posición actual de la flota, filtra por estado y revisa qué
          conductor tiene asignado cada vehículo.
        </p>
        <LinkButton to="/app/vehicles" icon={<TruckIcon />}>
          Ver vehículos
        </LinkButton>
      </Card>
    </>
  )
}
