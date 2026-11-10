import type { AuditLogOut } from '@/api/types'
import { ToneBadge } from '@/features/users/ToneBadge'
import { AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@/ui'
import { auditActionLabel, entityLabel, shortId } from './auditActions'

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

/** Who acted, and from which IP when the server recorded one. */
export function ActorCell({ entry }: { entry: AuditLogOut }) {
  return (
    <>
      {entry.actor_email ? (
        <span className="audit-actor">{entry.actor_email}</span>
      ) : (
        <span className="admin-muted">Sin usuario</span>
      )}
      {entry.ip_address && <span className="audit-code mono">IP {entry.ip_address}</span>}
    </>
  )
}

/** Spanish action name plus the stable code (`auth.login_succeeded`). */
export function ActionCell({ entry }: { entry: AuditLogOut }) {
  return (
    <>
      <span className="audit-action">{auditActionLabel(entry.action)}</span>
      <span className="audit-code mono">{entry.action}</span>
    </>
  )
}

/** Shortened id with the full value in the tooltip and for screen readers. */
function EntityId({ id }: { id: string }) {
  const short = shortId(id)
  if (short === id) return <span className="audit-code mono">{id}</span>
  return (
    <span className="audit-code mono" title={id}>
      <span aria-hidden="true">{short}</span>
      <span className="visually-hidden">{id}</span>
    </span>
  )
}

/** Entity type in Spanish plus its identifier; nothing to show is said in words. */
export function EntityCell({ entry }: { entry: AuditLogOut }) {
  const label = entityLabel(entry.entity_type)
  if (!label && !entry.entity_id) return <span className="admin-muted">Sin entidad</span>
  return (
    <>
      {label && <span className="audit-entity">{label}</span>}
      {entry.entity_id && <EntityId id={entry.entity_id} />}
    </>
  )
}

interface DetailsToggleProps {
  /** What the details belong to, for example "Inicio de sesión, 10 de nov de 2026, 09:45". */
  label: string
  expanded: boolean
  controls: string
  onToggle: () => void
}

/** 40 px icon button; the state is in aria-expanded, the name stays the same. */
export function DetailsToggle({ label, expanded, controls, onToggle }: DetailsToggleProps) {
  return (
    <button
      type="button"
      className="icon-button audit-toggle"
      aria-label={`Ver detalles de ${label}`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
    </button>
  )
}

function detailText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return 'sin valor'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

interface AuditDetailsProps {
  details: AuditLogOut['details']
  failure: boolean
  id?: string
  hidden?: boolean
}

/**
 * Details as key/value text. React escapes every value: stored data is never interpreted as
 * HTML (no innerHTML), so a malicious name in a record is displayed, not executed (SEG-03).
 */
export function AuditDetails({ details, failure, id, hidden }: AuditDetailsProps) {
  return (
    <dl id={id} hidden={hidden} className={['audit-details', failure && 'audit-details--failure'].filter(Boolean).join(' ')}>
      {Object.entries(details ?? {}).map(([key, value]) => (
        <div key={key} className="audit-details__item">
          <dt className="mono">{key}</dt>
          <dd>{detailText(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
