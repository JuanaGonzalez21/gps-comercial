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
    const title = 'Tu flota, clara. Tu operación, bajo control.'
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: title })).toBeInTheDocument()
    const features = screen.getByRole('region', { name: 'Lo que resuelve en el día a día' })
    for (const capability of ['Ubicación y estado de la flota', 'Conductores y pasajeros', 'Historial de recorridos']) {
      expect(within(features).getByRole('heading', { level: 3, name: capability })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'De la lista al mapa en un clic' })).toBeInTheDocument()
    const trust = screen.getByRole('region', { name: 'Cada acceso, con su rol y su registro' })
    expect(within(trust).getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Entra a tu panel de flota' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    // Every product image declares its size (no layout shift) and says the data is simulated.
    for (const image of screen.getAllByRole('img')) {
      if (image.tagName !== 'IMG') continue
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
    }
    expect(screen.getAllByText(/datos simulados/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Explorar funcionalidades' })).toHaveAttribute('href', '#funcionalidades')
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

    const hero = screen.getByRole('region', { name: 'Tu flota, clara. Tu operación, bajo control.' })
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
