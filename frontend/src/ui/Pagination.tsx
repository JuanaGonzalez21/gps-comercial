import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import './pagination.css'

type PageItem = number | 'gap-start' | 'gap-end'

/** 1 … 4 5 6 … 10: first, last and neighbours of the current page. */
function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const items: PageItem[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('gap-start')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('gap-end')
  items.push(total)
  return items
}

interface PaginationProps {
  page: number
  pages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** Accessible name of the navigation landmark. */
  label?: string
  /** Plural noun for the summary, for example "vehículos". */
  itemLabel?: string
  disabled?: boolean
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  label = 'Paginación',
  itemLabel = 'resultados',
  disabled = false,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const lastPage = Math.max(1, pages)
  return (
    <nav className="pagination" aria-label={label}>
      <p className="pagination__summary">
        Mostrando {from}–{to} de {total} {itemLabel}
      </p>
      {pages > 1 && (
        <ul className="pagination__list" role="list">
          <li>
            <button
              type="button"
              className="pagination__button"
              onClick={() => onPageChange(page - 1)}
              disabled={disabled || page <= 1}
            >
              <ChevronLeftIcon />
              <span className="pagination__nav-text">Anterior</span>
            </button>
          </li>
          {pageItems(page, lastPage).map((item) =>
            typeof item === 'number' ? (
              <li key={item} className="pagination__page">
                <button
                  type="button"
                  className="pagination__button"
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`Página ${item}`}
                  onClick={() => onPageChange(item)}
                  disabled={disabled}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} className="pagination__page pagination__gap" aria-hidden="true">
                …
              </li>
            ),
          )}
          <li className="pagination__compact" aria-hidden="true">
            {page} / {lastPage}
          </li>
          <li>
            <button
              type="button"
              className="pagination__button"
              onClick={() => onPageChange(page + 1)}
              disabled={disabled || page >= lastPage}
            >
              <span className="pagination__nav-text">Siguiente</span>
              <ChevronRightIcon />
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}
