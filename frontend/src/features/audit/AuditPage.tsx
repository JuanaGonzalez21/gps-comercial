import { useMemo, useState } from 'react'
import { useAuditLogs } from '@/api/audit'
import { getErrorMessage } from '@/api/errors'
import { formatNumber } from '@/lib/format'
import { useDebouncedValue, useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import { Alert, AuditIcon, Button, EmptyState, ErrorState, PageHeader, Pagination, SearchIcon } from '@/ui'
import { AuditCardList, AuditCardListSkeleton } from './AuditCardList'
import { AuditFilters } from './AuditFilters'
import { bogotaToday, buildAuditQuery, EMPTY_AUDIT_FILTERS, type AuditFilterValues } from './auditQuery'
import { AuditTable, AuditTableSkeleton } from './AuditTable'
import '@/features/users/admin-table.css'
import './audit.css'

const PAGE_SIZE = 20
const ACTOR_DEBOUNCE_MS = 350
/** Below 80rem the log is cards; the six-column table needs the width. */
const COMPACT_QUERY = '(max-width: 79.99rem)'

/** Audit log for `audit:read` (RF-26): who did what and when, newest first. Read-only. */
export default function AuditPage() {
  useDocumentTitle('Auditoría')
  const isCompact = useMediaQuery(COMPACT_QUERY)
  const maxDay = useMemo(() => bogotaToday(), [])

  const [values, setValues] = useState<AuditFilterValues>(EMPTY_AUDIT_FILTERS)
  const actor = useDebouncedValue(values.actor.trim(), ACTOR_DEBOUNCE_MS)
  const applied: AuditFilterValues = { ...values, actor }

  // Any filter change starts again at page 1.
  const filterKey = JSON.stringify(applied)
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1
  const goToPage = (next: number) => setPaging({ key: filterKey, page: next })

  const query = buildAuditQuery(applied, page, PAGE_SIZE)
  // An inverted date range is not sent: the server would refuse it and the list would not match.
  const logs = useAuditLogs(query.valid ? query.params : { page, page_size: PAGE_SIZE }, query.valid)
  const dateError = query.valid ? null : query.message

  const hasFilters = Object.values(values).some((value) => value.trim() !== '')
  const clearFilters = () => setValues(EMPTY_AUDIT_FILTERS)

  const data = query.valid ? logs.data : undefined
  let content
  if (!query.valid) {
    content = (
      <EmptyState
        icon={<SearchIcon />}
        title="Revisa el rango de fechas"
        description={`${query.message} Corrige «Hasta» para ver resultados.`}
      />
    )
  } else if (!data && logs.isError) {
    content = (
      <ErrorState
        title="No pudimos cargar el registro de auditoría"
        message={getErrorMessage(logs.error)}
        onRetry={() => void logs.refetch()}
        retrying={logs.isFetching}
      />
    )
  } else if (!data) {
    content = (
      <>
        <p className="visually-hidden" role="status">
          Cargando registro de auditoría…
        </p>
        {isCompact ? <AuditCardListSkeleton /> : <AuditTableSkeleton />}
      </>
    )
  } else if (data.total === 0) {
    content = hasFilters ? (
      <EmptyState
        icon={<SearchIcon />}
        title="Ningún evento coincide con los filtros"
        description="Amplía el rango de fechas, elige otra acción o quita alguno de los filtros."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<AuditIcon />}
        title="Aún no hay eventos registrados"
        description="Aquí aparecerán los inicios de sesión, la gestión de usuarios y los cambios en conductores, pasajeros y campos personalizados."
      />
    )
  } else if (data.items.length === 0) {
    content = (
      <EmptyState
        title="Esta página ya no tiene eventos"
        description="El registro cambió mientras lo consultabas."
        action={
          <Button variant="secondary" onClick={() => goToPage(1)}>
            Ir a la primera página
          </Button>
        }
      />
    )
  } else {
    content = isCompact ? (
      <AuditCardList items={data.items} />
    ) : (
      <AuditTable items={data.items} busy={logs.isPlaceholderData} />
    )
  }

  const total = data?.total

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué y cuándo: inicios de sesión, gestión de usuarios, cambios en conductores, pasajeros y campos, exportaciones y accesos denegados."
      />

      <AuditFilters
        values={values}
        onChange={setValues}
        maxDay={maxDay}
        dateError={dateError}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      {query.valid && logs.isError && data && (
        <Alert
          tone="warning"
          role="status"
          className="admin-alert"
          title="No se pudo actualizar el registro"
          action={
            <Button size="sm" variant="secondary" onClick={() => void logs.refetch()}>
              Reintentar
            </Button>
          }
        >
          {getErrorMessage(logs.error)}
        </Alert>
      )}

      <section className="admin-panel" aria-labelledby="audit-list-title">
        <div className="admin-panel__header">
          <h2 id="audit-list-title" className="admin-panel__title">
            Eventos
          </h2>
          <p className="admin-panel__meta" role="status">
            {total === undefined ? '' : total === 1 ? '1 evento' : `${formatNumber(total)} eventos`}
          </p>
        </div>

        {content}

        {data && data.total > 0 && (
          <Pagination
            page={page}
            pages={data.pages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={goToPage}
            label="Paginación del registro de auditoría"
            itemLabel="eventos"
            disabled={logs.isPlaceholderData}
          />
        )}
      </section>
    </>
  )
}
