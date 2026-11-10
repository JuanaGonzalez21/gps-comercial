import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Page, VehicleMarker, VehiclePositions, VehicleSummary } from '@/api/types'
import type { VehicleMapProps } from '@/map/VehicleMap'
import { jsonResponse, mockFetch, problemResponse } from '@/test/http'
import VehiclesPage from './VehiclesPage'

// Leaflet needs a real layout engine; the page is tested against a stand-in with the same props.
vi.mock('@/map/VehicleMap', () => ({
  VehicleMap: ({ markers, selectedId, onSelect, children }: VehicleMapProps) => (
    <div data-testid="vehicle-map" data-selected={selectedId ?? ''}>
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
  return { items, total, page: 1, page_size: 20, pages: Math.ceil(total / 20) }
}

function positions(items = MARKERS): VehiclePositions {
  return { items, generated_at: '2026-11-09T19:33:11Z' }
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/app/vehicles', element: <VehiclesPage /> },
      { path: '/app/vehicles/:id', element: <p>Detalle</p> },
    ],
    { initialEntries: ['/app/vehicles'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('VehiclesPage', () => {
  it('lists the server page and maps every position, independent of paging', async () => {
    mockFetch(({ url }) =>
      url.startsWith('/api/v1/vehicles/positions') ? jsonResponse(positions()) : jsonResponse(page(VEHICLES)),
    )
    renderPage()

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('button', { name: 'Camión 01' })).toBeInTheDocument()
    expect(within(table).getByText('En movimiento')).toBeInTheDocument()
    expect(within(table).getByText('Sin señal')).toBeInTheDocument()
    expect(within(table).getByText('Sin conductor asignado')).toBeInTheDocument()
    expect(within(table).getByText('42 km/h')).toBeInTheDocument()
    expect(screen.getByText('41 vehículos')).toBeInTheDocument()
    // 2 rows on this page, 3 markers on the map.
    expect(await screen.findByText('3 marcadores')).toBeInTheDocument()
    expect(screen.getByText('Última actualización 14:33:11')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Paginación de vehículos' })).toHaveTextContent(
      'Mostrando 1–20 de 41 vehículos',
    )
  })

  it('sends search and filters to the server (debounced) and resets to page 1', async () => {
    const { calls } = mockFetch(({ url }) =>
      url.startsWith('/api/v1/vehicles/positions') ? jsonResponse(positions()) : jsonResponse(page(VEHICLES)),
    )
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Página 2' }))
    await waitFor(() => expect(calls.some((call) => call.url.includes('page=2'))).toBe(true))

    await user.type(screen.getByRole('searchbox', { name: 'Buscar vehículo' }), 'camion')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'moving')

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
    mockFetch(({ url }) =>
      url.startsWith('/api/v1/vehicles/positions') ? jsonResponse(positions()) : jsonResponse(page(VEHICLES)),
    )
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
    const { calls } = mockFetch(({ url }) =>
      url.startsWith('/api/v1/vehicles/positions') ? jsonResponse(positions()) : jsonResponse(page(VEHICLES)),
    )
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
      if (url.startsWith('/api/v1/vehicles/positions')) return jsonResponse(positions())
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
    mockFetch(({ url }) =>
      url.startsWith('/api/v1/vehicles/positions')
        ? jsonResponse(positions([]))
        : jsonResponse(page([], 0)),
    )
    renderPage()
    const user = userEvent.setup()
    await screen.findByText('Aún no hay vehículos')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'stopped')

    expect(await screen.findByText('Ningún vehículo coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('No hay vehículos con posición válida para estos filtros.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(await screen.findByText('Aún no hay vehículos')).toBeInTheDocument()
  })
})
