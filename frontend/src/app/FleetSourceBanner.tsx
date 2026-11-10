import { useState } from 'react'
import { useSystemInfo } from '@/api/system'
import { useAuth } from '@/auth/useAuth'
import { Alert, CloseIcon } from '@/ui'

/**
 * Simulated fleet data is always labelled as such: it must never pass for Wialon data.
 * The notice can be hidden for the current visit only; it comes back on the next page load.
 */
export function FleetSourceBanner() {
  const { status, hasPermission } = useAuth()
  const info = useSystemInfo(status === 'authenticated' && hasPermission('dashboard:read'))
  const [hidden, setHidden] = useState(false)
  if (hidden || info.data?.fleet_source !== 'fake') return null
  return (
    <Alert
      tone="warning"
      title="Datos simulados."
      className="fleet-source-banner alert--inline"
      action={
        <button type="button" className="icon-button" onClick={() => setHidden(true)}>
          <CloseIcon />
          <span className="visually-hidden">Ocultar aviso de datos simulados</span>
        </button>
      }
    >
      No provienen de Wialon: este entorno usa una flota de prueba y ningún vehículo, conductor ni
      pasajero es real.
    </Alert>
  )
}
