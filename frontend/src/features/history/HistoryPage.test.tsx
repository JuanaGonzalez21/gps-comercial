import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Page, Track, TrackPoint, VehicleDetail, VehicleSummary } from '@/api/types'
import { jsonResponse, mockFetch, type FetchCall } from '@/test/http'
import HistoryPage from './HistoryPage'
import type { TrackMapProps } from './TrackMap'

// Leaflet needs a real layout engine: the page is tested against a stand-in with the same props.
vi.mock('./TrackMap', () => ({
  TrackMap: ({ points, currentIndex }: TrackMapProps) => (
    <div data-testid="track-map" data-index={currentIndex}>
      {points.length} puntos en el mapa
    </div>
  ),
}))

const VEHICLES: VehicleSummary[] = [
  { id: 1, name: 'Camión 01', status: 'moving', last_message_at: null, position: null, driver: null, passenger_count: 0 },
  { id: 2, name: 'Van 02', status: 'stopped', last_message_at: null, position: null, driver: null, passenger_count: 0 },
]

const DETAIL: VehicleDetail = { ...VEHICLES[0], custom_fields: [], passengers: [] }

// Ten points, one every 15 minutes from 08:00 Bogota (13:00 UTC); one without speed.
const POINTS: TrackPoint[] = Array.from({ length: 10 }, (_, index) => ({
  recorded_at: new Date(Date.UTC(2026, 10, 9, 13, index * 15)).toISOString().replace('.000Z', 'Z'),
  latitude: 4.6 + index * 0.01,
  longitude: -74.1 + index * 0.01,
  speed_kmh: index === 4 ? null : index * 8,
  course_deg: 90,
}))

function makeTrack(points: TrackPoint[] = POINTS, overrides: Partial<Track['stats']> = {}): Track {
  return {
    vehicle_id: 1,
    from: '2026-11-09T13:00:00Z',
    to: '2026-11-09T15:30:00Z',
    points,
    stats: {
      total_points: 4_200,
      returned_points: points.length,
      simplified: true,
      truncated: false,
      distance_km: 12.44,
      max_speed_kmh: 72,
      avg_speed_kmh: 31.4,
      duration_s: 8_100,
      ...overrides,
    },
  }
}

function page(items: VehicleSummary[]): Page<VehicleSummary> {
  return { items, total: items.length, page: 1, page_size: 100, pages: 1 }
}

function mockApi(track: Track = makeTrack()) {
  return mockFetch(({ url }) => {
    if (url.startsWith('/api/v1/vehicles/1/track')) return jsonResponse(track)
    if (url === '/api/v1/vehicles/1') return jsonResponse(DETAIL)
    if (url.startsWith('/api/v1/vehicles?')) {
      const search = new URL(url, 'http://test').searchParams.get('search')
      return jsonResponse(page(search ? VEHICLES.filter((v) => v.name.toLowerCase().includes(search)) : VEHICLES))
    }
    return jsonResponse({ detail: 'unexpected' }, 404)
  })
}

function trackCalls(calls: FetchCall[]) {
  return calls.filter((call) => call.url.includes('/track'))
}

function renderPage(path = '/app/history') {
  const router = createMemoryRouter(
    [
      { path: '/app/history', element: <HistoryPage /> },
      { path: '/app/vehicles/:id', element: <p>Detalle</p> },
    ],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function setRange(from: string, to: string) {
  fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: from } })
  fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: to } })
}

describe('HistoryPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('validates the vehicle and the range accessibly without calling the API', async () => {
    const { calls } = mockApi()
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'Camión 01' })

    setRange('2026-11-09T10:00', '2026-11-09T08:00')
    await user.click(screen.getByRole('button', { name: 'Ver recorrido' }))

    const select = screen.getByRole('combobox', { name: /^Vehículo/ })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription(/Selecciona un vehículo\./)
    expect(select).toHaveFocus()
    const to = screen.getByLabelText(/^Hasta/)
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(to).toHaveAccessibleDescription(/La fecha y hora de fin debe ser posterior a la de inicio\./)

    await user.selectOptions(select, '1')
    setRange('2026-11-01T08:00', '2026-11-09T08:00')
    await user.click(screen.getByRole('button', { name: 'Ver recorrido' }))
    expect(to).toHaveAccessibleDescription(/El rango no puede superar 7 días/)
    expect(to).toHaveFocus()
    expect(trackCalls(calls)).toHaveLength(0)
  })

  it('searches vehicles on the server and keeps the choice', async () => {
    const { calls } = mockApi()
    renderPage()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'Camión 01' })
    await user.selectOptions(screen.getByRole('combobox', { name: /^Vehículo/ }), '1')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar vehículo' }), 'van')
    await waitFor(() => expect(calls.some((call) => call.url.includes('search=van'))).toBe(true))
    expect(await screen.findByText('1 vehículo coincide con la búsqueda.')).toBeInTheDocument()
    // The selected vehicle stays available although the new search does not include it.
    const select = screen.getByRole('combobox', { name: /^Vehículo/ })
    expect(select).toHaveValue('1')
    expect(within(select).getByRole('option', { name: 'Van 02' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Camión 01' })).toBeInTheDocument()
  })

  it('sends the Bogota range as UTC ISO and shows statistics and the simplification notice', async () => {
    const { calls } = mockApi()
    const router = renderPage()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'Camión 01' })

    await user.selectOptions(screen.getByRole('combobox', { name: /^Vehículo/ }), '1')
    setRange('2026-11-09T08:00', '2026-11-09T10:30')
    await user.click(screen.getByRole('button', { name: 'Ver recorrido' }))

    const stats = await screen.findByRole('region', { name: 'Resumen del recorrido' })
    const [call] = trackCalls(calls)
    const query = new URL(call.url, 'http://test').searchParams
    expect(query.get('from')).toBe('2026-11-09T13:00:00Z')
    expect(query.get('to')).toBe('2026-11-09T15:30:00Z')
    expect(query.get('max_points')).toBe('2000')
    expect(router.state.location.search).toBe('?vehicle=1&from=2026-11-09T13%3A00%3A00Z&to=2026-11-09T15%3A30%3A00Z')

    expect(await screen.findByRole('heading', { name: 'Recorrido de Camión 01' })).toBeInTheDocument()
    expect(within(stats).getByText('12,4 km')).toBeInTheDocument()
    expect(within(stats).getByText('2 h 15 min')).toBeInTheDocument()
    expect(within(stats).getByText('72 km/h')).toBeInTheDocument()
    expect(within(stats).getByText('31 km/h')).toBeInTheDocument()
    expect(within(stats).getByText('10 de 4.200')).toBeInTheDocument()
    expect(screen.getByText('Se simplificó el recorrido para mostrarlo con fluidez')).toBeInTheDocument()
    expect(screen.getByTestId('track-map')).toHaveTextContent('10 puntos en el mapa')
    expect(screen.getByRole('img', { name: /máxima 72 km\/h/ })).toBeInTheDocument()
    expect(screen.getByText('Recorrido cargado: 10 puntos.')).toBeInTheDocument()
  })

  it('shows an empty state when the vehicle reported no positions', async () => {
    mockApi(makeTrack([], { total_points: 0, returned_points: 0, simplified: false, distance_km: 0 }))
    renderPage('/app/history?vehicle=1&from=2026-11-09T13:00:00Z&to=2026-11-09T15:30:00Z')

    expect(await screen.findByRole('heading', { name: 'No hay recorrido en este rango' })).toBeInTheDocument()
    expect(screen.queryByTestId('track-map')).not.toBeInTheDocument()
  })

  it('opens ?vehicle=ID directly and plays the route with speed and scrubbing', async () => {
    const { calls } = mockApi()
    renderPage('/app/history?vehicle=1&from=2026-11-09T13:00:00Z&to=2026-11-09T15:30:00Z')

    const play = await screen.findByRole('button', { name: 'Reproducir' })
    expect(screen.getByRole('combobox', { name: /^Vehículo/ })).toHaveValue('1')
    expect(new URL(trackCalls(calls)[0].url, 'http://test').searchParams.get('from')).toBe('2026-11-09T13:00:00Z')

    const slider = screen.getByRole('slider', { name: 'Posición en el recorrido' })
    const map = screen.getByTestId('track-map')
    const cursor = screen.getByTestId('speed-chart-cursor')
    expect(slider).toHaveValue('0')
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('08:00:00'))
    const cursorStart = cursor.getAttribute('x1')

    vi.useFakeTimers()
    fireEvent.click(play)
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(slider).toHaveValue('3')
    expect(map).toHaveAttribute('data-index', '3')
    expect(cursor.getAttribute('x1')).not.toBe(cursorStart)
    expect(screen.getByText('4 de 10')).toBeInTheDocument()

    // x8 jumps to the end, where playback stops by itself.
    fireEvent.click(screen.getByRole('button', { name: 'x8' }))
    expect(screen.getByRole('button', { name: 'x8' })).toHaveAttribute('aria-pressed', 'true')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(slider).toHaveValue('9')
    expect(screen.getByRole('button', { name: 'Repetir' })).toBeInTheDocument()
    expect(screen.getByText('Reproducción finalizada.')).toBeInTheDocument()

    // The slider moves the position by keyboard or pointer: point 3 is 08:30 and 16 km/h.
    fireEvent.change(slider, { target: { value: '2' } })
    expect(map).toHaveAttribute('data-index', '2')
    const current = screen.getByText('Velocidad', { selector: 'dt' }).closest('dl')
    expect(current).not.toBeNull()
    expect(within(current as HTMLElement).getByText('16 km/h')).toBeInTheDocument()
    expect(within(current as HTMLElement).getByText(/08:30:00/)).toBeInTheDocument()

    // Paused: time passing does not move the position.
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(slider).toHaveValue('2')
  })
})
