import { useState } from 'react'
import { useDebouncedValue } from '@/lib/hooks'

// UI state of a drivers/passengers list (search, assignment filter, sort, page) turned into the
// query params of the server-side list (RF-18, RF-28, UX-06).

export type AssignedFilter = '' | 'yes' | 'no'
/** Name order, or "-created": recently added first (same values as the API). */
export type RosterSort = 'name' | '-name' | '-created'

export const ROSTER_PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350

export function toAssigned(filter: AssignedFilter): boolean | undefined {
  return filter === '' ? undefined : filter === 'yes'
}

export function toRosterSort(value: string): RosterSort {
  return value === '-name' || value === '-created' ? value : 'name'
}

const SORT_CAPTIONS: Record<RosterSort, string> = {
  name: 'ordenados por nombre, de la A a la Z',
  '-name': 'ordenados por nombre, de la Z a la A',
  '-created': 'ordenados por fecha de alta, los más recientes primero',
}

/** Table caption fragment, for example "Conductores ordenados por nombre, de la A a la Z". */
export function sortCaption(sort: RosterSort): string {
  return SORT_CAPTIONS[sort]
}

/**
 * `extraFilterKey` identifies filters owned by the page (for example the vehicle of the
 * passengers list): any filter change goes back to page 1 without an extra render.
 */
export function useRosterListState(extraFilterKey = '') {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS)
  const [assigned, setAssigned] = useState<AssignedFilter>('')
  const [sort, setSort] = useState<RosterSort>('name')

  const filterKey = `${search}|${assigned}|${sort}|${extraFilterKey}`
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1
  const goToPage = (next: number) => setPaging({ key: filterKey, page: next })

  return {
    searchInput,
    setSearchInput,
    assigned,
    setAssigned,
    sort,
    setSort,
    page,
    goToPage,
    /** Filters shared by the list and its CSV export (same rows as on screen). */
    filters: { search: search || undefined, assigned: toAssigned(assigned), sort },
    hasFilters: searchInput.trim() !== '' || assigned !== '' || extraFilterKey !== '',
    clearFilters: () => {
      setSearchInput('')
      setAssigned('')
    },
  }
}
