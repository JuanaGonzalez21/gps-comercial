import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Me, Permission } from '@/api/types'
import { getPostLoginPath } from '@/auth/redirect'
import { SessionEndContext, type SessionEndReason } from '@/auth/sessionEnd'
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/auth/useAuth'
import { makeUser, VIEWER_PERMISSIONS } from '@/test/http'
import { RequireAuth, RequirePasswordChanged, RequirePermission } from './guards'

function LoginProbe() {
  const location = useLocation()
  return (
    <div>
      <h1>Pantalla de login</h1>
      <p data-testid="search">{location.search}</p>
      <p data-testid="next">{getPostLoginPath(location.state)}</p>
    </div>
  )
}

const routes = [
  { path: '/login', element: <LoginProbe /> },
  { path: '/change-password', element: <h1>Cambiar contraseña</h1> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <RequirePasswordChanged>
          <Outlet />
        </RequirePasswordChanged>
      </RequireAuth>
    ),
    children: [
      {
        path: 'vehicles',
        element: (
          <RequirePermission permission="vehicles:read">
            <h1>Vehículos</h1>
          </RequirePermission>
        ),
      },
      {
        path: 'users',
        element: (
          <RequirePermission permission="users:manage">
            <h1>Usuarios</h1>
          </RequirePermission>
        ),
      },
    ],
  },
]

function renderAt(
  path: string,
  { status, user = null, endReason = null }: { status: AuthStatus; user?: Me | null; endReason?: SessionEndReason },
) {
  const auth: AuthContextValue = {
    status,
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission: Permission) => user?.permissions.includes(permission) ?? false,
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AuthContext value={auth}>
      <SessionEndContext value={endReason}>
        <RouterProvider router={router} />
      </SessionEndContext>
    </AuthContext>,
  )
  return router
}

describe('route guards', () => {
  it('sends anonymous users to /login and remembers where they were going', async () => {
    const router = renderAt('/app/vehicles?status=moving', { status: 'anonymous' })

    expect(await screen.findByRole('heading', { name: 'Pantalla de login' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByTestId('next')).toHaveTextContent('/app/vehicles?status=moving')
    expect(screen.getByTestId('search')).toBeEmptyDOMElement()
  })

  it('explains an expired session with ?reason=expired', async () => {
    renderAt('/app/vehicles', { status: 'anonymous', endReason: 'expired' })

    expect(await screen.findByTestId('search')).toHaveTextContent('?reason=expired')
  })

  it('shows a loader, not the page, while the session is being checked', () => {
    renderAt('/app/vehicles', { status: 'loading' })

    expect(screen.getByText('Verificando tu sesión…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vehículos' })).not.toBeInTheDocument()
  })

  it('renders the view when the role has the permission', async () => {
    renderAt('/app/vehicles', {
      status: 'authenticated',
      user: makeUser({ role: { code: 'viewer', name: 'Visualizador' }, permissions: VIEWER_PERMISSIONS }),
    })

    expect(await screen.findByRole('heading', { name: 'Vehículos' })).toBeInTheDocument()
  })

  it('shows "Acceso denegado" when the role lacks the permission', async () => {
    renderAt('/app/users', {
      status: 'authenticated',
      user: makeUser({ role: { code: 'viewer', name: 'Visualizador' }, permissions: VIEWER_PERMISSIONS }),
    })

    expect(await screen.findByRole('heading', { name: 'Acceso denegado' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('forces the change of a temporary password before any app view', async () => {
    const router = renderAt('/app/vehicles', {
      status: 'authenticated',
      user: makeUser({ must_change_password: true }),
    })

    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/change-password')
  })

  it('only honours in-app return paths after login', () => {
    expect(getPostLoginPath({ from: { pathname: '/app/drivers', search: '?page=2' } })).toBe('/app/drivers?page=2')
    expect(getPostLoginPath({ from: { pathname: 'https://evil.example/' } })).toBe('/app/dashboard')
    expect(getPostLoginPath(null)).toBe('/app/dashboard')
  })
})
