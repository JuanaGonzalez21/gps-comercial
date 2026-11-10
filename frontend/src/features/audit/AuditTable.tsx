import { Fragment, useState } from 'react'
import type { AuditLogOut } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { Skeleton } from '@/ui'
import { auditActionLabel, hasDetails } from './auditActions'
import { ActionCell, ActorCell, AuditDetails, DetailsToggle, EntityCell, OutcomeBadge } from './AuditBits'

const COLUMNS = 6

interface AuditTableProps {
  items: readonly AuditLogOut[]
  busy: boolean
}

/** Tablet and desktop: one row per entry; details open in a full-width panel under the row. */
export function AuditTable({ items, busy }: AuditTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const toggle = (id: number) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="admin-table-scroll" role="region" aria-label="Tabla del registro de auditoría" tabIndex={0}>
      <table className="admin-table audit-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">
          Registro de auditoría, del evento más reciente al más antiguo. Horas de Bogotá.
        </caption>
        <thead>
          <tr>
            <th scope="col">Fecha y hora</th>
            <th scope="col">Usuario e IP</th>
            <th scope="col">Acción</th>
            <th scope="col">Entidad</th>
            <th scope="col">Resultado</th>
            <th scope="col" className="audit-table__toggle">
              <span className="visually-hidden">Detalles</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const open = expanded.has(entry.id)
            const detailsId = `audit-details-${entry.id}`
            const failure = entry.outcome === 'failure'
            const when = formatDateTime(entry.occurred_at)
            const withDetails = hasDetails(entry)
            return (
              <Fragment key={entry.id}>
                <tr
                  className={
                    [failure && 'audit-table__row--failure', open && 'audit-table__row--open'].filter(Boolean).join(' ') ||
                    undefined
                  }
                >
                  <th scope="row">
                    <time dateTime={entry.occurred_at} className="audit-when">
                      {when}
                    </time>
                    <span className="admin-table__secondary">{formatRelative(entry.occurred_at)}</span>
                  </th>
                  <td>
                    <ActorCell entry={entry} />
                  </td>
                  <td>
                    <ActionCell entry={entry} />
                  </td>
                  <td>
                    <EntityCell entry={entry} />
                  </td>
                  <td>
                    <OutcomeBadge outcome={entry.outcome} />
                  </td>
                  <td className="audit-table__toggle">
                    {withDetails ? (
                      <DetailsToggle
                        label={`${auditActionLabel(entry.action)}, ${when}`}
                        expanded={open}
                        controls={detailsId}
                        onToggle={() => toggle(entry.id)}
                      />
                    ) : (
                      <span className="visually-hidden">Sin detalles</span>
                    )}
                  </td>
                </tr>
                {withDetails && (
                  <tr
                    id={detailsId}
                    className={['admin-table__details-row', failure && 'audit-table__row--failure']
                      .filter(Boolean)
                      .join(' ')}
                    hidden={!open}
                  >
                    <td colSpan={COLUMNS}>
                      <AuditDetails details={entry.details} failure={failure} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function AuditTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="admin-table-scroll" aria-hidden="true">
      <table className="admin-table">
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index}>
              <td>
                <Skeleton width="9rem" />
              </td>
              <td>
                <Skeleton width="11rem" />
              </td>
              <td>
                <Skeleton width="10rem" />
              </td>
              <td>
                <Skeleton width="6rem" />
              </td>
              <td>
                <Skeleton width="4.5rem" height="1.5rem" pill />
              </td>
              <td>
                <Skeleton width="2.5rem" height="2.5rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
