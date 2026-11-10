import type { ReactNode } from 'react'
import { getErrorMessage } from '@/api/errors'
import type { Page } from '@/api/types'
import { Button, EmptyState, ErrorState } from '@/ui'
import { RosterCardsSkeleton, RosterTableSkeleton } from './RosterTable'

interface RosterListContentProps<T> {
  data: Page<T> | undefined
  isError: boolean
  error: unknown
  isFetching: boolean
  onRetry: () => void
  /** Cards on small screens, table otherwise (also for the skeleton). */
  compact: boolean
  columns: number
  loadingText: string
  errorTitle: string
  /** Shown when the account has none yet (with guidance for the next step). */
  emptyState: ReactNode
  /** Shown when the filters leave no rows. */
  noMatchesState: ReactNode
  hasFilters: boolean
  onFirstPage: () => void
  children: (page: Page<T>) => ReactNode
}

/** Loading, error, empty and "page no longer exists" states of a list: never a blank area (ARQ-12). */
export function RosterListContent<T>({
  data,
  isError,
  error,
  isFetching,
  onRetry,
  compact,
  columns,
  loadingText,
  errorTitle,
  emptyState,
  noMatchesState,
  hasFilters,
  onFirstPage,
  children,
}: RosterListContentProps<T>) {
  if (!data && isError) {
    return <ErrorState title={errorTitle} message={getErrorMessage(error)} onRetry={onRetry} retrying={isFetching} />
  }
  if (!data) {
    return (
      <>
        <p className="visually-hidden" role="status">
          {loadingText}
        </p>
        {compact ? <RosterCardsSkeleton /> : <RosterTableSkeleton columns={columns} />}
      </>
    )
  }
  if (data.total === 0) return <>{hasFilters ? noMatchesState : emptyState}</>
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Esta página ya no tiene resultados"
        description="La lista cambió mientras la consultabas."
        action={
          <Button variant="secondary" onClick={onFirstPage}>
            Ir a la primera página
          </Button>
        }
      />
    )
  }
  return <>{children(data)}</>
}
