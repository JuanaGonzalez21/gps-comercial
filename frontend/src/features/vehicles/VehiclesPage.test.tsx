import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardSummary,
  Me,
  Page,
  VehicleMarker,
  VehiclePositions,
  VehicleSummary,
} from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import type { VehicleMapProps } from '@/map/VehicleMap'
import { jsonResponse, makeUser, mockFetch, problemResponse, VIEWER_PERMISSIONS } from '@/test/http'
import VehiclesPage from './VehiclesPage'

// Leaflet needs a real layout engine; the page is tested against a stand-in with the same props.
vi.mock('@/map/VehicleMap', () => ({
  VehicleMap: ({ markers, selectedId, focusRequest, onSelect, children }: VehicleMapProps) => (
    <div data-testid="vehicle-map" data-selected={selectedId ?? ''} data-focus-request={focusRequest}>
      <p>{markers.length} marcadores</p>
      {markers.map((marker) => (
        <button key={marker.id} type="button" onClick={() => onSelect(marker.id)}>
          Marcador {marker.name}
        </button>
      ))}
      {children}
    </div>
  ),
}))

const position = {
  latitude: 4.65,
  longitude: -74.1,
  speed_kmh: 42,
  course_deg: 90,
  altitude_m: 2600,
  satellites: 9,
  recorded_at: '2026-11-09T19:30:00Z',
}

const VEHICLES: VehicleSummary[] = [
  {
    id: 1,
    name: 'Camión 01',
    status: 'moving',
    last_message_at: '2026-11-09T19:30:00Z',
    position,
    driver: { resource_id: 10, id: 5, name: 'Luz Gómez', phone: null },
    passenger_count: 2,
  },
  {
    id: 2,
    name: 'Van 02',
    status: 'no_signal',
    last_message_at: null,
    position: null,
    driver: null,
    passenger_count: 0,
  },
]

const MARKERS: VehicleMarker[] = [
  { id: 1, name: 'Camión 01', status: 'moving', latitude: 4.65, longitude: -74.1, speed_kmh: 42, course_deg: 90, last_message_at: '2026-11-09T19:30:00Z', driver_name: 'Luz Gómez' },
  { id: 3, name: 'Bus 03', status: 'stopped', latitude: 4.7, longitude: -74.05, speed_kmh: 0, course_deg: null, last_message_at: '2026-11-09T19:00:00Z', driver_name: null },
  { id: 4, name: 'Moto 04', status: 'stopped', latitude: 4.6, longitude: -74.08, speed_kmh: 0, course_deg: 10, last_message_at: '2026-11-09T19:10:00Z', driver_name: null },
]

function page(items: VehicleSummary[], total = 41): Page<VehicleSummary> {
  return { items, total, page: 1, page_size: 8, pages: Math.ceil(total / 8) }
}

function positions(items = MARKERS): VehiclePositions {
  return { items, generated_at: '2026-11-09T19:33:11Z' }
}

const SUMMARY: DashboardSummary = {
  vehicles_total: 41,
  vehicles_by_status: { moving: 20, stopped: 15, no_signal: 6 },
  vehicles_with_driver: 30,
  vehicles_without_driver: 11,
  drivers_total: 10,
  passengers_total: 15,
  generated_at: '2026-11-09T19:33:11Z',
}

/** Default API: one list page, every position and the fleet summary behind the status chips. */
function respond(url: string, list = page(VEHICLES), markers = positions()): Response {
  if (url.startsWith('/api/v1/vehicles/positions')) return jsonResponse(markers)
  if (url.startsWith('/api/v1/dashboard/summary')) return jsonResponse(SUMMARY)
  return jsonResponse(list)
}

function useCompactScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

function authFor(user: Me): AuthContextValue {
  return {
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => user.permissions.includes(permission),
  }
}

function renderPage(user: Me = makeUser(), entry = '/app/vehicles') {
  const router = createMemoryRouter(
    [
      { path: '/app/vehicles', element: <VehiclesPage /> },
      { path: '/app/vehicles/:id', element: <p>Detalle</p> },
    ],
    { initialEntries: [entry] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={authFor(user)}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

describe('VehiclesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the server page and maps every position, independent of paging', async () => {
    const { calls } = mockFetch(({ url }) => respond(url))
    renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('button', { name: 'Camión 01' })).toBeInTheDocument()
    expect(within(table).getByText('En movimiento')).toBeInTheDocument()
    expect(within(table).getByText('Sin señal')).toBeInTheDocument()
    expect(within(table).getByText('Sin conductor')).toBeInTheDocument()
    expect(within(table).getByText('42 km/h')).toBeInTheDocument()
    expect(screen.getByText('41 vehículos')).toBeInTheDocument()
    // 2 rows on this page, 3 markers on the map.
    expect(await screen.findByText('3 marcadores')).toBeInTheDocument()
    expect(screen.getByText('14:33:11').closest('p')).toHaveTextContent('Última actualización 14:33:11')
    // Design: 8 rows per server page.
    expect(calls.some((call) => call.url.startsWith('/api/v1/vehicles?') && call.url.includes('page_size=8'))).toBe(true)
    expect(screen.getByRole('navigation', { name: 'Paginación de vehículos' })).toHaveTextContent(
      'Mostrando 1–8 de 41 vehículos',
    )
  })

  it('sends search and filters to the server (debounced) and resets to page 1', async () => {
    const { calls } = mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Página 2' }))
    await waitFor(() => expect(calls.some((call) => call.url.includes('page=2'))).toBe(true))

    await user.type(screen.getByRole('searchbox', { name: 'Buscar vehículo' }), 'camion')
    await user.click(screen.getByRole('button', { name: /^En movimiento/ }))
    expect(screen.getByRole('button', { name: /^En movimiento/ })).toHaveAttribute('aria-pressed', 'true')

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.url.startsWith('/api/v1/vehicles?') &&
            call.url.includes('search=camion') &&
            call.url.includes('status=moving') &&
            call.url.includes('page=1'),
        ),
      ).toBe(true),
    )
    expect(
      calls.some(
        (call) =>
          call.url.startsWith('/api/v1/vehicles/positions?') &&
          call.url.includes('search=camion') &&
          call.url.includes('status=moving'),
      ),
    ).toBe(true)
    // Debounced: no request for each partial word.
    expect(calls.some((call) => call.url.includes('search=cam&') || call.url.endsWith('search=cam'))).toBe(false)
  })

  it('keeps the list and the map selection in sync', async () => {
    mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()
    const rowButton = await screen.findByRole('button', { name: 'Camión 01' })

    await user.click(rowButton)
    expect(rowButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-selected', '1')

    // Selecting on the map a vehicle that is not on this page offers to find it in the list.
    await user.click(await screen.findByRole('button', { name: 'Marcador Bus 03' }))
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-selected', '3')
    expect(rowButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('«Bus 03» no está en esta página de la lista')).toBeInTheDocument()
  })

  it('filters map markers by driver locally, matching the list filter', async () => {
    const { calls } = mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('3 marcadores')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Conductor' }), 'with')

    expect(await screen.findByText('1 marcadores')).toBeInTheDocument()
    await waitFor(() => expect(calls.some((call) => call.url.includes('has_driver=true'))).toBe(true))
  })

  it('shows an error with retry when the list cannot be loaded', async () => {
    let fail = true
    mockFetch(({ url }) => {
      if (!url.startsWith('/api/v1/vehicles?')) return respond(url)
      return fail
        ? problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no está disponible.' })
        : jsonResponse(page(VEHICLES))
    })
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('No pudimos cargar los vehículos')).toBeInTheDocument()
    expect(screen.getByText('Wialon no está disponible.')).toBeInTheDocument()

    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Camión 01' })).toBeInTheDocument()
  })

  it('guides the user when filters return no vehicles', async () => {
    mockFetch(({ url }) => respond(url, page([], 0), positions([])))
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('Aún no hay vehículos')

    await user.click(screen.getByRole('button', { name: /^Detenido/ }))

    expect(await screen.findByText('Ningún vehículo coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('No hay vehículos con posición válida para estos filtros.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(await screen.findByText('Aún no hay vehículos')).toBeInTheDocument()
  })
  it('keeps vehicles without coordinates in the list, badged, and never asks the map for them', async () => {
    mockFetch(({ url }) => respond(url))
    renderPage()

    const table = await screen.findByRole('table')
    const row = within(table).getByRole('rowheader', { name: /Van 02/ })
    // Icon + text badge, and no "select on map" button for a vehicle the map cannot show.
    expect(within(row).getByText('Sin posición')).toBeInTheDocument()
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle de Van 02' })).toHaveAttribute(
      'href',
      '/app/vehicles/2',
    )
    // Clicking its row does not select anything either.
    await userEvent.setup().click(within(table).getByText('Sin conductor'))
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-selected', '')
    // The positioned vehicle has no badge and keeps its map button.
    const located = within(table).getByRole('rowheader', { name: /Camión 01/ })
    expect(within(located).queryByText('Sin posición')).not.toBeInTheDocument()
    expect(within(located).getByRole('button', { name: 'Camión 01' })).toBeInTheDocument()
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-focus-request', '0')
  })

  it('offers the CSV export with the current filters to roles that may export', async () => {
    const { calls } = mockFetch(({ url }) => {
      if (url.startsWith('/api/v1/exports/vehicles.csv')) {
        return new Response('nombre,estado', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="vehiculos.csv"',
          },
        })
      }
      return respond(url)
    })
    const createObjectURL = vi.fn(() => 'blob:vehiculos')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: /^En movimiento/ }))
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    const exportCall = calls.find((call) => call.url.startsWith('/api/v1/exports/vehicles.csv'))
    expect(exportCall?.url).toContain('status=moving')
    expect(exportCall?.url).toContain('sort=name')
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('hides the CSV export from the Visualizador role', async () => {
    mockFetch(({ url }) => respond(url))
    renderPage(makeUser({ role: { code: 'viewer', name: 'Visualizador' }, permissions: VIEWER_PERMISSIONS }))

    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('shows fleet counts on the status chips only while nothing else filters the list', async () => {
    mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()

    // jsdom joins the label and the count spans without a space, hence \s*.
    const chips = screen.getByRole('group', { name: 'Estado' })
    expect(await within(chips).findByRole('button', { name: /^Todos\s*41$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(chips).getByRole('button', { name: /^En movimiento\s*20$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(chips).getByRole('button', { name: /^Sin señal\s*6$/ })).toBeInTheDocument()

    // The summary cannot be crossed with a search or the driver filter: no numbers then.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Conductor' }), 'without')
    expect(within(chips).getByRole('button', { name: 'Todos' })).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: 'En movimiento' })).toBeInTheDocument()
  })

  it('starts with the status chip from the URL (dashboard links)', async () => {
    const { calls } = mockFetch(({ url }) => respond(url))
    renderPage(makeUser(), '/app/vehicles?status=no_signal')

    expect(await screen.findByRole('button', { name: /^Sin señal/ })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(
        calls.some((call) => call.url.startsWith('/api/v1/vehicles?') && call.url.includes('status=no_signal')),
      ).toBe(true),
    )
  })

  it('selects on the map when the row is clicked and opens the detail from the chevron', async () => {
    mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()
    const table = await screen.findByRole('table')

    await user.click(within(table).getByText('Luz Gómez'))
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-selected', '1')
    expect(within(table).getByRole('button', { name: 'Camión 01' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(table).getByRole('columnheader', { name: /Vehículo/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await user.click(screen.getByRole('link', { name: 'Ver detalle de Camión 01' }))
    expect(await screen.findByText('Detalle')).toBeInTheDocument()
  })

  it('uses cards with a map button and the sort select on small screens', async () => {
    useCompactScreen()
    const { calls } = mockFetch(({ url }) => respond(url))
    renderPage()
    const user = userEvent.setup()

    const card = await screen.findByRole('article', { name: 'Camión 01' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(card).getByText('Luz Gómez')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Ver detalle de Camión 01' })).toHaveAttribute(
      'href',
      '/app/vehicles/1',
    )
    // No map button for the vehicle without coordinates.
    expect(within(screen.getByRole('article', { name: 'Van 02' })).queryByRole('button')).not.toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Ver en el mapa Camión 01' }))
    expect(screen.getByTestId('vehicle-map')).toHaveAttribute('data-selected', '1')
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), '-last_message_at')
    await waitFor(() => expect(calls.some((call) => call.url.includes('sort=-last_message_at'))).toBe(true))
  })
})
