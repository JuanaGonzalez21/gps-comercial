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
  it('has every section of the Claude Design landing with a single h1 and semantic landmarks', () => {
    renderLanding('anonymous')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const title = 'Tu flota conectada. Tu equipo informado.'
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    const hero = screen.getByRole('region', { name: title })
    expect(within(hero).getByText('Información de tus unidades integrada con Wialon.')).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: 'Conocer la plataforma' })).toHaveAttribute('href', '#funcionalidades')

    const features = screen.getByRole('region', { name: 'Lo que necesitas saber, en el momento en que lo necesitas.' })
    for (const feature of ['Saber dónde está cada vehículo.', 'Conductores y pasajeros, en orden.', 'Recorridos con contexto.']) {
      expect(within(features).getByRole('heading', { level: 3, name: feature })).toBeInTheDocument()
    }
    const work = screen.getByRole('region', { name: 'Una consulta, de principio a fin.' })
    expect(within(work).getAllByRole('heading', { level: 3 })).toHaveLength(3)
    const control = screen.getByRole('region', { name: 'Cada vehículo, con su información a la vista.' })
    for (const item of ['Encuentra la unidad', 'Consulta su situación', 'Abre su detalle']) {
      expect(within(control).getByRole('heading', { level: 3, name: item })).toBeInTheDocument()
    }
    // Marketing copy only: the role descriptions left this section, permissions are unchanged.
    expect(within(control).queryByRole('heading', { name: 'Administrador' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Todo listo para consultar tu flota.' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()

    // Every image declares its size (no layout shift); photos below the hero load lazily, the hero does not.
    for (const image of screen.getAllByRole('img')) {
      if (image.tagName !== 'IMG') continue
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
    }
    for (const photo of screen.getAllByRole('img', { name: /Fotografía ilustrativa/ })) {
      expect(photo).toHaveAttribute('loading', 'lazy')
    }
    expect(screen.getByRole('img', { name: /furgoneta y un camión/ })).not.toHaveAttribute('loading')

    const sections = within(screen.getByRole('navigation', { name: 'Secciones' }))
    expect(sections.getByRole('link', { name: 'Funcionalidades' })).toHaveAttribute('href', '/#funcionalidades')
    expect(sections.getByRole('link', { name: 'Cómo trabajamos' })).toHaveAttribute('href', '/#como-trabajamos')
    expect(sections.getByRole('link', { name: 'Control de tu flota' })).toHaveAttribute('href', '/#control-de-tu-flota')
    for (const id of ['funcionalidades', 'como-trabajamos', 'control-de-tu-flota']) {
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('opens and closes the mobile section menu (button state, Escape)', async () => {
    renderLanding('anonymous')
    const user = userEvent.setup()

    const toggle = screen.getByRole('button', { name: 'Abrir menú de secciones' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Cerrar menú de secciones' })).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Abrir menú de secciones' })).toHaveAttribute('aria-expanded', 'false')
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

    const hero = screen.getByRole('region', { name: 'Tu flota conectada. Tu equipo informado.' })
    await user.click(within(hero).getByRole('link', { name: 'Iniciar sesión' }))
    expect(router.state.location.pathname).toBe('/login')
  })

  it('switches every call to action to "Ir al panel" for a signed-in user (RF-03)', () => {
    renderLanding('authenticated', makeUser())

    const panelLinks = screen.getAllByRole('link', { name: 'Ir al panel' })
    expect(panelLinks).toHaveLength(4) // header, hero, closing call to action and footer navigation
    for (const link of panelLinks) expect(link).toHaveAttribute('href', '/app/dashboard')
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })
})
