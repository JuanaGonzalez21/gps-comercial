import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Me } from '@/api/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/auth/useAuth'
import PublicLayout from '@/layouts/PublicLayout'
import { jsonResponse, makeUser, mockFetch } from '@/test/http'
import LandingPage from './LandingPage'

function renderLanding(status: AuthStatus, user: Me | null = null) {
  const { calls } = mockFetch(() => jsonResponse({ status: 'ok' }))
  const auth: AuthContextValue = {
    status,
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: () => false,
  }
  const router = createMemoryRouter(
    [
      { element: <PublicLayout />, children: [{ index: true, element: <LandingPage /> }] },
      { path: '/login', element: <h1>Pantalla de login</h1> },
      { path: '/app/dashboard', element: <h1>Panel</h1> },
    ],
    { initialEntries: ['/'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
  return { calls, router }
}

describe('LandingPage', () => {
  it('has every section required by RF-02 with a single h1 and semantic landmarks', () => {
    renderLanding('anonymous')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Tu flota, en tiempo real y bajo control' })).toBeInTheDocument()
    // Hero, value proposition, features, how it works, call to action (+ footer below).
    expect(screen.getByRole('region', { name: 'Tu flota, en tiempo real y bajo control' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Toda la operación de tu flota en un solo lugar' })).toBeInTheDocument()
    const features = screen.getByRole('region', { name: 'Módulos pensados para el día a día' })
    expect(screen.getByRole('region', { name: 'De Wialon a tu pantalla en cuatro pasos' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '¿Listo para ver tu flota?' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()

    for (const module of [
      'Mapa en vivo',
      'Conductores y pasajeros',
      'Historial y reproducción',
      'Panel de indicadores',
      'Exportación CSV',
      'Auditoría y roles',
    ]) {
      expect(within(features).getByRole('heading', { level: 3, name: module })).toBeInTheDocument()
    }
    const steps = within(screen.getByRole('region', { name: 'De Wialon a tu pantalla en cuatro pasos' })).getAllByRole(
      'listitem',
    )
    expect(steps.length).toBeGreaterThanOrEqual(4)
  })

  it('offers login (and no public sign-up) to anonymous visitors and wakes the backend', async () => {
    const { calls, router } = renderLanding('anonymous')
    const user = userEvent.setup()

    const loginLinks = screen.getAllByRole('link', { name: 'Iniciar sesión' })
    expect(loginLinks).toHaveLength(4) // header, hero, closing call to action and footer navigation
    for (const link of loginLinks) expect(link).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'Ir al panel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /registr|crear cuenta/i })).not.toBeInTheDocument()
    expect(calls.some((call) => call.url === '/health')).toBe(true)

    const hero = screen.getByRole('region', { name: 'Tu flota, en tiempo real y bajo control' })
    await user.click(within(hero).getByRole('link', { name: 'Iniciar sesión' }))
    expect(router.state.location.pathname).toBe('/login')
  })

  it('switches every call to action to "Ir al panel" for a signed-in user (RF-03)', () => {
    renderLanding('authenticated', makeUser())

    const panelLinks = screen.getAllByRole('link', { name: 'Ir al panel' })
    expect(panelLinks).toHaveLength(4) // header, hero, closing call to action and footer navigation
    for (const link of panelLinks) expect(link).toHaveAttribute('href', '/app/dashboard')
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Tu panel está listo' })).toBeInTheDocument()
    expect(screen.getByText(/Iniciaste sesión como Ana Pérez/)).toBeInTheDocument()
  })
})
