import { useSyncExternalStore } from 'react'
import { isServerWaking, subscribeServerStatus } from '@/api/serverStatus'
import { Spinner } from '@/ui'
import './app.css'

/**
 * Global cold-start notice (DEP-04). The live region is always mounted so its message is
 * announced when it appears; it is fixed-position, so it never shifts the layout.
 */
export function ServerStatusBanner() {
  const waking = useSyncExternalStore(subscribeServerStatus, isServerWaking, () => false)
  return (
    <div className={waking ? 'server-banner server-banner--visible' : 'server-banner'} role="status">
      {waking && (
        <>
          <Spinner size="sm" />
          <span>Iniciando el servidor, esto puede tardar hasta un minuto…</span>
        </>
      )}
    </div>
  )
}
