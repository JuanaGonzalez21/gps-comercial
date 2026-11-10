import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DASHBOARD_REFRESH_MS } from '@/api/dashboard'
import type { DashboardSummary } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { jsonResponse, makeUser, mockFetch, problemResponse } from '@/test/http'
import DashboardPage from './DashboardPage'

const SUMMARY: DashboardSummary = {
  vehicles_total: 62,
  vehicles_by_status: { moving: 12, stopped: 30, no_signal: 20 },
  vehicles_with_driver: 40,
  vehicles_without_driver: 22,
  drivers_total: 16,
  passengers_total: 101,
  generated_at: '2026-11-09T19:33:11Z', // 14:33 in Bogota
}

// Percentages use a non-breaking space ("19\u00a0%"); getByText compares against
// whitespace-normalised text, so text queries use a plain space.
const pct = (value: number) => `${value}\u00a0%`
const pctText = (value: number) => `${value} %`

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

  it('shows every KPI from the backend with its share of the fleet', async () => {
    mockFetch(() => jsonResponse(SUMMARY))
    renderDashboard()

    const vehicles = await screen.findByTestId('kpi-vehicles')
    expect(within(vehicles).getByText('62')).toBeInTheDocument()
    expect(within(vehicles).getByRole('link', { name: 'Ver vehículos' })).toHaveAttribute('href', '/app/vehicles')
    expect(within(screen.getByTestId('kpi-moving')).getByText('12')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-moving')).getByText(`${pctText(19)} de la flota`)).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-stopped')).getByText('30')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-no_signal')).getByText('20')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-with_driver')).getByText('40')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-without_driver')).getByText('22')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-drivers')).getByText('16')).toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-passengers')).getByText('101')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver pasajeros' })).toHaveAttribute('href', '/app/passengers')

    // "Actualizado hh:mm" in Bogota time, from the server timestamp.
    expect(screen.getByText('14:33')).toHaveAttribute('datetime', '2026-11-09T19:33:11Z')
  })

  it('gives both charts a text alternative with visible values', async () => {
    mockFetch(() => jsonResponse(SUMMARY))
    renderDashboard()

    const donut = await screen.findByRole('img', { name: /Distribución de 62 vehículos por estado/ })
    expect(donut).toHaveAccessibleName(
      `Distribución de 62 vehículos por estado: En movimiento 12 (${pct(19)}), Detenido 30 (${pct(48)}), Sin señal 20 (${pct(32)}).`,
    )

    const statusTable = screen.getByRole('table', { name: 'Vehículos por estado' })
    const movingRow = within(statusTable).getByRole('row', { name: /En movimiento/ })
    expect(within(movingRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['12', pct(19)])
    const noSignalRow = within(statusTable).getByRole('row', { name: /Sin señal/ })
    expect(within(noSignalRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['20', pct(32)])

    const driversTable = screen.getByRole('table', { name: 'Vehículos con y sin conductor asignado' })
    const withRow = within(driversTable).getByRole('row', { name: /Con conductor/ })
    expect(within(withRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['40', pct(65)])
    const withoutRow = within(driversTable).getByRole('row', { name: /Sin conductor/ })
    expect(within(withoutRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['22', pct(35)])
    // The bars are proportional to the same numbers.
    expect(Number(screen.getByTestId('coverage-bar-with').getAttribute('width'))).toBeCloseTo(64.52, 1)
    expect(screen.getByText(pctText(65), { selector: '.coverage-chart__headline-value' })).toBeInTheDocument()
  })

  it('shows an error with a retry that recovers', async () => {
    let attempt = 0
    mockFetch(() => {
      attempt += 1
      return attempt === 1 ? problemResponse(503, 'upstream_unavailable') : jsonResponse(SUMMARY)
    })
    renderDashboard()
    const user = userEvent.setup()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No pudimos cargar los indicadores')
    expect(alert).toHaveTextContent('Detalle del servidor.')

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('kpi-vehicles')).toHaveTextContent('62')
  })

  it('explains an empty fleet instead of drawing empty charts', async () => {
    mockFetch(() =>
      jsonResponse({
        ...SUMMARY,
        vehicles_total: 0,
        vehicles_by_status: { moving: 0, stopped: 0, no_signal: 0 },
        vehicles_with_driver: 0,
        vehicles_without_driver: 0,
      }),
    )
    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Aún no hay vehículos' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Distribución/ })).not.toBeInTheDocument()
  })

  it('refetches every 30 s and pauses while the tab is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { calls } = mockFetch(() => jsonResponse(SUMMARY))
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
