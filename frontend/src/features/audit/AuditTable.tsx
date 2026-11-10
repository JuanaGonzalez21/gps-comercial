import { Fragment, useState } from 'react'
import type { AuditLogOut } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { ChevronRightIcon, Skeleton } from '@/ui'
import { auditActionLabel, hasDetails } from './auditActions'
import { DetailsJson, EntityCell, OutcomeBadge } from './AuditBits'

const COLUMNS = 6

interface AuditTableProps {
  items: readonly AuditLogOut[]
  busy: boolean
}

/** Tablet and desktop: one row per entry, details expand in a row below it. */
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
            <th scope="col">Detalles</th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => {
            const open = expanded.has(entry.id)
            const detailsId = `audit-details-${entry.id}`
            const label = auditActionLabel(entry.action)
            return (
              <Fragment key={entry.id}>
                <tr className={entry.outcome === 'failure' ? 'audit-table__row--failure' : undefined}>
                  <th scope="row">
                    <time dateTime={entry.occurred_at} className="admin-table__primary">
                      {formatDateTime(entry.occurred_at)}
                    </time>
                    <span className="admin-table__secondary">{formatRelative(entry.occurred_at)}</span>
                  </th>
                  <td className="audit-table__who">
                    {entry.actor_email ? (
                      <span className="audit-table__actor">{entry.actor_email}</span>
                    ) : (
                      <span className="admin-muted">Sin usuario</span>
                    )}
                    <span className="admin-table__secondary">
                      IP <span className="admin-table__mono">{entry.ip_address ?? 'sin dato'}</span>
                    </span>
                  </td>
                  <td>
                    <span className="admin-table__primary">{label}</span>
                    <span className="admin-table__mono">{entry.action}</span>
                  </td>
                  <td>
                    <EntityCell entry={entry} />
                  </td>
                  <td>
                    <OutcomeBadge outcome={entry.outcome} />
                  </td>
                  <td>
                    {hasDetails(entry) ? (
                      <button
                        type="button"
                        className="audit-toggle"
                        aria-label={`Detalles de ${label}`}
                        aria-expanded={open}
                        aria-controls={detailsId}
                        onClick={() => toggle(entry.id)}
                      >
                        <ChevronRightIcon className="audit-toggle__icon" />
                        Detalles
                      </button>
                    ) : (
                      <span className="admin-muted">Sin detalles</span>
                    )}
                  </td>
                </tr>
                {hasDetails(entry) && (
                  <tr id={detailsId} className="admin-table__details-row" hidden={!open}>
                    <td colSpan={COLUMNS}>
                      <DetailsJson details={entry.details} />
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
                <Skeleton width="5rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
