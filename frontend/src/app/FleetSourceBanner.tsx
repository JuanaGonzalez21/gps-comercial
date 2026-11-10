import { useSystemInfo } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { Alert } from '@/ui'

/** Simulated fleet data is always labelled as such: it must never pass for Wialon data. */
export function FleetSourceBanner() {
  const { status, hasPermission } = useAuth()
  const info = useSystemInfo(status === 'authenticated' && hasPermission('dashboard:read'))
  if (info.data?.fleet_source !== 'fake') return null
  return (
    <Alert tone="warning" title="Datos simulados: no provienen de Wialon" className="fleet-source-banner">
      Este entorno usa una flota de prueba. Ningún vehículo, conductor ni pasajero mostrado es real.
    </Alert>
  )
}
