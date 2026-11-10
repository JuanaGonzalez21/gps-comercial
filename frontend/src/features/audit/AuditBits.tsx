import type { AuditLogOut } from '@/api/types'
import { ToneBadge } from '@/features/users/ToneBadge'
import { AlertCircleIcon, CheckCircleIcon } from '@/ui'
import { entityLabel } from './auditActions'

export function OutcomeBadge({ outcome }: { outcome: AuditLogOut['outcome'] }) {
  return outcome === 'success' ? (
    <ToneBadge tone="success" icon={<CheckCircleIcon />}>
      Éxito
    </ToneBadge>
  ) : (
    <ToneBadge tone="danger" icon={<AlertCircleIcon />}>
      Fallo
    </ToneBadge>
  )
}

/** Entity type in Spanish plus its identifier; nothing to show is said in words. */
export function EntityCell({ entry }: { entry: AuditLogOut }) {
  const label = entityLabel(entry.entity_type)
  if (!label && !entry.entity_id) return <span className="admin-muted">Sin entidad</span>
  return (
    <>
      {label && <span className="admin-table__primary">{label}</span>}
      {entry.entity_id && <span className="admin-table__mono">{entry.entity_id}</span>}
    </>
  )
}

/**
 * Details as pretty-printed JSON text. React escapes it: stored values are never interpreted as
 * HTML (no innerHTML), so a malicious name in a record is displayed, not executed (SEG-03).
 */
export function DetailsJson({ details }: { details: AuditLogOut['details'] }) {
  return <pre className="audit-details">{JSON.stringify(details ?? {}, null, 2)}</pre>
}
