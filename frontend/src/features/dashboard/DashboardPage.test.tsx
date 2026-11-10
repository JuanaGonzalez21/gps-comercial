import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DASHBOARD_REFRESH_MS } from '@/api/dashboard'
import type { DashboardSummary, Page, VehicleSummary } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import type { VehicleMapProps } from '@/map/VehicleMap'
import { jsonResponse, makeUser, mockFetch, problemResponse, type FetchCall } from '@/test/http'
import DashboardPage from './DashboardPage'

// Leaflet needs a real layout engine; the map card is tested against a stand-in with the same props.
vi.mock('@/map/VehicleMap', () => ({
  VehicleMap: ({ markers }: VehicleMapProps) => (
    <div data-testid="vehicle-map">{markers.length} marcadores</div>
  ),
}))

const SUMMARY: DashboardSummary = {
  vehicles_total: 62,
  vehicles_by_status: { moving: 12, stopped: 30, no_signal: 20 },
  vehicles_with_driver: 40,
  vehicles_without_driver: 22,
  drivers_total: 16,
  passengers_total: 101,
  generated_at: '2026-11-09T19:33:11Z', // 14:33 in Bogota
}

const NO_SIGNAL: Page<VehicleSummary> = {
  items: [
    {
      id: 7,
      name: 'Bus 07',
      status: 'no_signal',
      last_message_at: '2026-11-09T04:07:00Z',
      position: null,
      driver: null,
      passenger_count: 0,
    },
  ],
  total: 20,
  page: 1,
  page_size: 4,
  pages: 5,
}

// Percentages use a non-breaking space before "%"; getByText compares against
// whitespace-normalised text, so text queries use a plain space.
const pctText = (value: number) => `${value} %`

/** Routes the dashboard's three reads: KPIs, the no-signal list and the map positions. */
function api(summary: () => Response) {
  return (call: FetchCall) => {
    if (call.url.startsWith('/api/v1/dashboard/summary')) return summary()
    if (call.url.startsWith('/api/v1/vehicles/positions')) return jsonResponse({ items: [], total: 0 })
    if (call.url.startsWith('/api/v1/vehicles')) return jsonResponse(NO_SIGNAL)
    return problemResponse(404, 'not_found')
  }
}

function renderDashboard() {
  const user = makeUser()
  const auth: AuthContextValue = {
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => user.permissions.includes(permission),
  }
  const router = createMemoryRouter([{ path: '/app/dashboard', element: <DashboardPage /> }], {
    initialEntries: ['/app/dashboard'],
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

function summaryCalls(calls: { url: string }[]) {
  return calls.filter((call) => call.url === '/api/v1/dashboard/summary').length
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.useRealTimers()
    focusManager.setFocused(undefined)
  })

  it('shows every KPI from the backend with a link to its filtered list', async () => {
    mockFetch(api(() => jsonResponse(SUMMARY)))
    renderDashboard()

    expect(await screen.findByTestId('kpi-vehicles')).toHaveTextContent('62')
    expect(screen.getByRole('link', { name: 'Ver vehículos' })).toHaveAttribute('href', '/app/vehicles')

    const moving = screen.getByTestId('kpi-moving')
    expect(moving).toHaveTextContent('12')
    expect(within(moving).getByText(`${pctText(19)} de la flota`)).toBeInTheDocument()
    expect(within(moving).getByRole('link')).toHaveAttribute('href', '/app/vehicles?status=moving')
    expect(screen.getByTestId('kpi-stopped')).toHaveTextContent('30')
    expect(screen.getByTestId('kpi-no_signal')).toHaveTextContent('20')

    const withDriver = screen.getByTestId('kpi-with_driver')
    expect(withDriver).toHaveTextContent('40')
    expect(within(withDriver).getByRole('link')).toHaveAttribute('href', '/app/vehicles?has_driver=true')
    expect(screen.getByTestId('kpi-without_driver')).toHaveTextContent('22')
    expect(screen.getByTestId('kpi-drivers')).toHaveTextContent('16')
    expect(screen.getByRole('link', { name: /^Pasajeros: 101/ })).toHaveAttribute('href', '/app/passengers')

    expect(screen.getByText('14:33')).toHaveAttribute('datetime', '2026-11-09T19:33:11Z')
  })

  it('gives both visualisations a text alternative with the same values', async () => {
    mockFetch(api(() => jsonResponse(SUMMARY)))
    renderDashboard()

    const statusBar = await screen.findByRole('img', { name: /Distribución de 62 vehículos por estado/ })
    expect(statusBar).toHaveAccessibleName(
      'Distribución de 62 vehículos por estado: 12 en movimiento, 30 detenido, 20 sin señal',
    )
    expect(within(screen.getByTestId('kpi-with_driver')).getByText(`· ${pctText(65)}`)).toBeInTheDocument()
    expect(screen.getByTestId('coverage-bar-with').style.width).toMatch(/^64\.5/)
    expect(screen.getByText(pctText(65), { selector: '.dash-figure__value' })).toBeInTheDocument()
  })

  it('lists the vehicles that need attention, longest silence first', async () => {
    const { calls } = mockFetch(api(() => jsonResponse(SUMMARY)))
    renderDashboard()

    const heading = await screen.findByRole('heading', { name: 'Requiere atención' })
    const card = heading.closest('section') as HTMLElement
    expect(within(card).getByText('20 vehículos sin señal')).toBeInTheDocument()
    expect(await within(card).findByRole('link', { name: /Bus 07/ })).toHaveAttribute('href', '/app/vehicles/7')
    expect(within(card).getByRole('link', { name: /Ver los 20 sin señal/ })).toHaveAttribute(
      'href',
      '/app/vehicles?status=no_signal',
    )
    const listCall = calls.find((call) => call.url.startsWith('/api/v1/vehicles?'))
    expect(listCall?.url).toContain('status=no_signal')
    expect(listCall?.url).toContain('sort=last_message_at')
    expect(listCall?.url).toContain('page_size=4')
  })

  it('shows an error with a retry that recovers', async () => {
    let attempt = 0
    mockFetch(
      api(() => {
        attempt += 1
        return attempt === 1 ? problemResponse(503, 'upstream_unavailable') : jsonResponse(SUMMARY)
      }),
    )
    renderDashboard()
    const user = userEvent.setup()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar los indicadores')
    expect(alert).toHaveTextContent('Detalle del servidor.')

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('kpi-vehicles')).toHaveTextContent('62')
  })

  it('explains an empty fleet instead of drawing empty charts', async () => {
    mockFetch(
      api(() =>
        jsonResponse({
          ...SUMMARY,
          vehicles_total: 0,
          vehicles_by_status: { moving: 0, stopped: 0, no_signal: 0 },
          vehicles_with_driver: 0,
          vehicles_without_driver: 0,
        }),
      ),
    )
    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Aún no hay vehículos' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Distribución/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('vehicle-map')).not.toBeInTheDocument()
  })

  it('refetches every 30 s and pauses while the tab is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { calls } = mockFetch(api(() => jsonResponse(SUMMARY)))
    renderDashboard()
    await screen.findByTestId('kpi-vehicles')
    expect(summaryCalls(calls)).toBe(1)

    await act(() => vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS))
    expect(summaryCalls(calls)).toBe(2)

    act(() => focusManager.setFocused(false))
    await act(() => vi.advanceTimersByTimeAsync(DASHBOARD_REFRESH_MS * 2))
    expect(summaryCalls(calls)).toBe(2)
  })
})
