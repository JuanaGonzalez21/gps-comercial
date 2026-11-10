import { useState } from 'react'
import type { AuditLogOut } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { Skeleton } from '@/ui'
import { auditActionLabel, hasDetails } from './auditActions'
import { ActionCell, ActorCell, AuditDetails, DetailsToggle, EntityCell, OutcomeBadge } from './AuditBits'

/** One entry in the order of the table columns; the date is the heading, as the row header is. */
function AuditCard({ entry }: { entry: AuditLogOut }) {
  const [open, setOpen] = useState(false)
  const titleId = `audit-card-${entry.id}`
  const detailsId = `audit-card-details-${entry.id}`
  const when = formatDateTime(entry.occurred_at)
  const failure = entry.outcome === 'failure'
  const withDetails = hasDetails(entry)
  return (
    <article className="admin-card audit-card" aria-labelledby={titleId}>
      <div className="audit-card__group">
        <h3 id={titleId} className="audit-card__title">
          <time dateTime={entry.occurred_at}>{when}</time>
        </h3>
        <span className="admin-table__secondary">{formatRelative(entry.occurred_at)}</span>
      </div>
      <div className="audit-card__group">
        <ActorCell entry={entry} />
      </div>
      <div className="audit-card__group">
        <ActionCell entry={entry} />
      </div>
      <div className="audit-card__group">
        <EntityCell entry={entry} />
      </div>
      <div className="audit-card__footer">
        <OutcomeBadge outcome={entry.outcome} />
        {withDetails && (
          <DetailsToggle
            label={`${auditActionLabel(entry.action)}, ${when}`}
            expanded={open}
            controls={detailsId}
            onToggle={() => setOpen((value) => !value)}
          />
        )}
      </div>
      {withDetails && <AuditDetails id={detailsId} hidden={!open} details={entry.details} failure={failure} />}
    </article>
  )
}

/** Phones and tablets (UX-01): one stacked entry per event, same data and details as the table. */
export function AuditCardList({ items }: { items: readonly AuditLogOut[] }) {
  return (
    <ul className="admin-cards" role="list">
      {items.map((entry) => (
        <li key={entry.id}>
          <AuditCard entry={entry} />
        </li>
      ))}
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
