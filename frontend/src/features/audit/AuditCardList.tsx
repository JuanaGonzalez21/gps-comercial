import type { AuditLogOut } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { Skeleton } from '@/ui'
import { auditActionLabel, hasDetails } from './auditActions'
import { DetailsJson, EntityCell, OutcomeBadge } from './AuditBits'

/** Phones (UX-01): one card per entry; details fold with the native <details> element. */
export function AuditCardList({ items }: { items: readonly AuditLogOut[] }) {
  return (
    <ul className="admin-cards" role="list">
      {items.map((entry) => {
        const titleId = `audit-card-${entry.id}`
        return (
          <li key={entry.id}>
            <article className="admin-card" aria-labelledby={titleId}>
              <div className="admin-card__header">
                <h3 id={titleId} className="admin-card__title">
                  {auditActionLabel(entry.action)}
                </h3>
                <p className="admin-card__subtitle">
                  <time dateTime={entry.occurred_at}>{formatDateTime(entry.occurred_at)}</time> ·{' '}
                  {formatRelative(entry.occurred_at)}
                </p>
              </div>
              <dl className="admin-card__details">
                <div>
                  <dt>Resultado</dt>
                  <dd>
                    <OutcomeBadge outcome={entry.outcome} />
                  </dd>
                </div>
                <div>
                  <dt>Usuario</dt>
                  <dd>{entry.actor_email ?? <span className="admin-muted">Sin usuario</span>}</dd>
                </div>
                <div>
                  <dt>Entidad</dt>
                  <dd>
                    <EntityCell entry={entry} />
                  </dd>
                </div>
                <div>
                  <dt>IP</dt>
                  <dd className="admin-table__mono">{entry.ip_address ?? 'Sin dato'}</dd>
                </div>
                <div>
                  <dt>Código</dt>
                  <dd className="admin-table__mono">{entry.action}</dd>
                </div>
              </dl>
              {hasDetails(entry) ? (
                <details className="audit-disclosure">
                  <summary>Ver detalles</summary>
                  <DetailsJson details={entry.details} />
                </details>
              ) : (
                <p className="admin-note">Sin detalles adicionales.</p>
              )}
            </article>
          </li>
        )
      })}
    </ul>
  )
}

export function AuditCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="admin-cards" role="list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="admin-card">
          <Skeleton width="11rem" height="1.25rem" />
          <Skeleton width="60%" />
          <Skeleton width="80%" />
          <Skeleton width="40%" />
        </li>
      ))}
    </ul>
  )
}
