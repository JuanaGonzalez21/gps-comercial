import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import type { VehicleListParams, VehicleSort, VehicleStatus } from '@/api/types'
import { useVehiclePositions, useVehicles } from '@/api/vehicles'
import { formatNumber, formatTime } from '@/lib/format'
import { useDebouncedValue, useDocumentTitle, useMediaQuery, usePrefersReducedMotion } from '@/lib/hooks'
import { VehicleMap } from '@/map/VehicleMap'
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  ListIcon,
  MapIcon,
  PageHeader,
  Pagination,
  RefreshIcon,
  SearchIcon,
  Spinner,
  TruckIcon,
} from '@/ui'
import { VehicleCardList, VehicleCardListSkeleton } from './VehicleCardList'
import { VehicleFilters, type DriverFilter } from './VehicleFilters'
import { VehicleTable, VehicleTableSkeleton } from './VehicleTable'
import './vehicles.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350
/** Below 48rem: cards plus a List/Map toggle. From 80rem: list and map side by side. */
const COMPACT_QUERY = '(max-width: 47.99rem)'
const SPLIT_QUERY = '(min-width: 80rem)'

type View = 'list' | 'map'
interface Selection {
  id: number
  source: 'list' | 'map'
}

/** Vehicle monitoring: server-paged list + map of every position, kept in sync (RF-10/11/14/15). */
export default function VehiclesPage() {
  useDocumentTitle('Vehículos')
  const navigate = useNavigate()
  const isCompact = useMediaQuery(COMPACT_QUERY)
  const isSplit = useMediaQuery(SPLIT_QUERY)
  const reducedMotion = usePrefersReducedMotion()
  const [view, setView] = useState<View>('list')

  // ---- Filters (UI state) -> query params (server state) ----
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS)
  const [status, setStatus] = useState<VehicleStatus | ''>('')
  const [driver, setDriver] = useState<DriverFilter>('')
  const [sort, setSort] = useState<VehicleSort>('name')

  // Any filter change starts again at page 1, without an extra effect/render.
  const filterKey = `${search}|${status}|${driver}|${sort}`
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1
  const goToPage = (next: number) => setPaging({ key: filterKey, page: next })

  const listParams: VehicleListParams = {
    search: search || undefined,
    status: status || undefined,
    has_driver: driver === '' ? undefined : driver === 'with',
    sort,
    page,
    page_size: PAGE_SIZE,
  }
  const list = useVehicles(listParams)
  const positions = useVehiclePositions({ search: search || undefined, status: status || undefined })

  // /vehicles/positions has no driver filter: apply it here so map and list show the same set.
  const markers = useMemo(() => {
    const items = positions.data?.items ?? []
    if (driver === '') return items
    return items.filter((marker) => (marker.driver_name !== null) === (driver === 'with'))
  }, [positions.data, driver])

  // ---- Selection shared by list and map (RF-15) ----
  const [selection, setSelection] = useState<Selection | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const rowsRef = useRef(new Map<number, HTMLElement>())
  const mapPanelRef = useRef<HTMLElement>(null)
  const pendingScrollRef = useRef<number | null>(null)

  const registerRow = useCallback((id: number, element: HTMLElement | null) => {
    if (element) rowsRef.current.set(id, element)
    else rowsRef.current.delete(id)
  }, [])

  // The map panel may still be hidden (mobile toggle) when the user asks for it: scroll after render.
  const scrollToMapRef = useRef(false)
  const showOnMap = (id: number) => {
    setSelection({ id, source: 'list' })
    setFocusRequest((count) => count + 1)
    if (isCompact) setView('map')
    // Not side by side: the map is below the list or behind the toggle, bring it into view.
    if (!isSplit) scrollToMapRef.current = true
  }

  useEffect(() => {
    if (!scrollToMapRef.current || mapPanelRef.current?.hidden) return
    scrollToMapRef.current = false
    mapPanelRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  })

  const toggleFromList = (id: number) => {
    if (selection?.id === id) setSelection(null)
    else showOnMap(id)
  }

  const selectFromMap = useCallback((id: number) => {
    pendingScrollRef.current = id
    setSelection({ id, source: 'map' })
  }, [])

  // A marker picked on the map scrolls its row into view once the row exists and is visible.
  useEffect(() => {
    const id = pendingScrollRef.current
    if (id === null || (isCompact && view !== 'list')) return
    const element = rowsRef.current.get(id)
    if (!element) return
    pendingScrollRef.current = null
    element.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  })

  const selectedId = selection?.id ?? null
  const selectedMarker = selectedId === null ? null : (markers.find((m) => m.id === selectedId) ?? null)
  const selectedOutsidePage =
    selection?.source === 'map' &&
    selectedMarker !== null &&
    list.data !== undefined &&
    !list.data.items.some((vehicle) => vehicle.id === selectedId)

  const showSelectedInList = () => {
    if (!selectedMarker) return
    pendingScrollRef.current = selectedMarker.id
    setSearchInput(selectedMarker.name)
    if (isCompact) setView('list')
  }

  const hasFilters = searchInput.trim() !== '' || status !== '' || driver !== ''
  const clearFilters = () => {
    setSearchInput('')
    setStatus('')
    setDriver('')
  }

  // ---- List content ----
  const listData = list.data
  let listContent
  if (!listData && list.isError) {
    listContent = (
      <ErrorState
        title="No pudimos cargar los vehículos"
        message={getErrorMessage(list.error)}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!listData) {
    listContent = (
      <>
        <p className="visually-hidden" role="status">
          Cargando vehículos…
        </p>
        {isCompact ? <VehicleCardListSkeleton /> : <VehicleTableSkeleton />}
      </>
    )
  } else if (listData.total === 0) {
    listContent = hasFilters ? (
      <EmptyState
        icon={<SearchIcon />}
        title="Ningún vehículo coincide con los filtros"
        description="Prueba con otro nombre o quita alguno de los filtros."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<TruckIcon />}
        title="Aún no hay vehículos"
        description="Cuando la cuenta de Wialon tenga unidades visibles, aparecerán aquí."
      />
    )
  } else if (listData.items.length === 0) {
    listContent = (
      <EmptyState
        title="Esta página ya no tiene vehículos"
        description="La lista cambió mientras la consultabas."
        action={
          <Button variant="secondary" onClick={() => goToPage(1)}>
            Ir a la primera página
          </Button>
        }
      />
    )
  } else {
    listContent = isCompact ? (
      <VehicleCardList
        items={listData.items}
        selectedId={selectedId}
        onShowOnMap={showOnMap}
        registerRow={registerRow}
      />
    ) : (
      <VehicleTable
        items={listData.items}
        selectedId={selectedId}
        onToggleSelect={toggleFromList}
        sort={sort}
        onSortChange={setSort}
        registerRow={registerRow}
        busy={list.isPlaceholderData}
      />
    )
  }

  // ---- Map overlay (loading / error / empty) ----
  let mapOverlay = null
  if (positions.isPending) {
    mapOverlay = (
      <div className="map-message" role="status">
        <Spinner size="sm" />
        <span>Cargando posiciones…</span>
      </div>
    )
  } else if (positions.isError && !positions.data) {
    mapOverlay = (
      <ErrorState
        headingLevel="h3"
        title="No pudimos cargar el mapa"
        message={getErrorMessage(positions.error)}
        onRetry={() => void positions.refetch()}
        retrying={positions.isFetching}
      />
    )
  } else if (markers.length === 0) {
    mapOverlay = (
      <p className="map-message" role="status">
        No hay vehículos con posición válida para estos filtros.
      </p>
    )
  }

  const generatedAt = positions.data?.generated_at ?? null
  const total = list.data?.total

  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Posición y estado de la flota. Se actualiza cada 15 segundos mientras ves esta página."
        actions={
          <p className="freshness">
            {positions.isFetching ? <Spinner size="sm" /> : <RefreshIcon className="freshness__icon" />}
            <span>
              {generatedAt ? `Última actualización ${formatTime(generatedAt)}` : 'Esperando datos…'}
            </span>
          </p>
        }
      />

      <VehicleFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={setStatus}
        driver={driver}
        onDriverChange={setDriver}
        sort={sort}
        onSortChange={setSort}
        compact={isCompact}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      {positions.isError && positions.data && (
        <Alert
          tone="warning"
          role="status"
          className="vehicles-alert"
          title="No se pudo actualizar la información"
          action={
            <Button size="sm" variant="secondary" onClick={() => void positions.refetch()}>
              Reintentar
            </Button>
          }
        >
          {`Se muestran las posiciones de las ${formatTime(generatedAt)}. ${getErrorMessage(positions.error)}`}
        </Alert>
      )}

      {isCompact && (
        <div className="view-toggle" role="group" aria-label="Vista">
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <ListIcon />
            Lista
          </button>
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
          >
            <MapIcon />
            Mapa
          </button>
        </div>
      )}

      <div className={isSplit ? 'vehicles-layout vehicles-layout--split' : 'vehicles-layout'}>
        <section
          className="vehicles-panel"
          aria-labelledby="vehicles-list-title"
          hidden={isCompact && view !== 'list'}
        >
          <div className="vehicles-panel__header">
            <h2 id="vehicles-list-title" className="vehicles-panel__title">
              Lista de vehículos
            </h2>
            <p className="vehicles-panel__meta" role="status">
              {total === undefined ? '' : total === 1 ? '1 vehículo' : `${formatNumber(total)} vehículos`}
            </p>
          </div>

          {selectedOutsidePage && selectedMarker && (
            <Alert
              tone="info"
              className="vehicles-alert"
              title={`«${selectedMarker.name}» no está en esta página de la lista`}
              action={
                <Button size="sm" variant="secondary" onClick={showSelectedInList}>
                  Mostrar en la lista
                </Button>
              }
            />
          )}

          {listContent}

          {list.data && list.data.total > 0 && (
            <Pagination
              page={page}
              pages={list.data.pages}
              total={list.data.total}
              pageSize={PAGE_SIZE}
              onPageChange={goToPage}
              label="Paginación de vehículos"
              itemLabel="vehículos"
              disabled={list.isPlaceholderData}
            />
          )}
        </section>

        <section
          ref={mapPanelRef}
          className="vehicles-panel vehicles-panel--map"
          aria-labelledby="vehicles-map-title"
          hidden={isCompact && view !== 'map'}
        >
          <div className="vehicles-panel__header">
            <h2 id="vehicles-map-title" className="vehicles-panel__title">
              Mapa
            </h2>
            <p className="vehicles-panel__meta">
              {positions.data
                ? `${formatNumber(markers.length)} con posición · agrupados cuando están cerca`
                : ''}
            </p>
          </div>
          <div className="vehicles-map-frame">
            <VehicleMap
              markers={markers}
              selectedId={selectedId}
              focusRequest={focusRequest}
              fitKey={`${search}|${status}|${driver}`}
              onSelect={selectFromMap}
              onOpenDetail={(id) => navigate(`/app/vehicles/${id}`)}
            >
              {mapOverlay}
            </VehicleMap>
          </div>
          <ul className="map-legend" role="list" aria-label="Leyenda del mapa">
            <li>
              <span className="map-legend__swatch map-legend__swatch--moving" aria-hidden="true" />
              En movimiento (círculo con flecha de rumbo)
            </li>
            <li>
              <span className="map-legend__swatch map-legend__swatch--stopped" aria-hidden="true" />
              Detenido (cuadrado)
            </li>
            <li>
              <span className="map-legend__swatch map-legend__swatch--no_signal" aria-hidden="true" />
              Sin señal (rombo con exclamación)
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
