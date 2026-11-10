import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { Me } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { jsonResponse, mockFetch } from '@/test/http'
import LoginPage from './LoginPage'

function renderLogin(login: AuthContextValue['login'], path = '/login') {
  const auth: AuthContextValue = {
    status: 'anonymous',
    user: null,
    login,
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: () => false,
  }
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Inicio</p> },
    ],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    // The page pings /health to wake the backend.
    mockFetch(() => jsonResponse({ status: 'ok' }))
  })

  it('validates required fields accessibly without calling the API', async () => {
    const login = vi.fn<AuthContextValue['login']>()
    renderLogin(login)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const email = screen.getByLabelText(/Correo electrónico/)
    const password = screen.getByLabelText(/^Contraseña/)
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Ingresa tu correo electrónico.')
    expect(password).toHaveAccessibleDescription('Ingresa tu contraseña.')
    expect(email).toHaveFocus()
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects a malformed e-mail', async () => {
    const login = vi.fn<AuthContextValue['login']>()
    renderLogin(login)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Correo electrónico/), 'ana@')
    await user.type(screen.getByLabelText(/^Contraseña/), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText(/Ingresa un correo electrónico válido/)).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('submits trimmed credentials', async () => {
    const login = vi.fn<AuthContextValue['login']>().mockResolvedValue({} as Me)
    renderLogin(login)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Correo electrónico/), '  ana@example.com ')
    await user.type(screen.getByLabelText(/^Contraseña/), 'Clave-Segura-2026')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(login).toHaveBeenCalledWith('ana@example.com', 'Clave-Segura-2026')
  })

  it('shows the generic server message and focuses it when credentials fail', async () => {
    const generic = 'Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente.'
    const login = vi
      .fn<AuthContextValue['login']>()
      .mockRejectedValue(new ApiError({ status: 401, code: 'invalid_credentials', detail: generic }))
    renderLogin(login)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Correo electrónico/), 'ana@example.com')
    await user.type(screen.getByLabelText(/^Contraseña/), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(generic)
    expect(alert).toHaveFocus()
    // The typed e-mail is kept so the user can correct the password only.
    expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('ana@example.com')
  })

  it('tells the user how long to wait when rate limited', async () => {
    const login = vi
      .fn<AuthContextValue['login']>()
      .mockRejectedValue(
        new ApiError({ status: 429, code: 'rate_limited', detail: 'Demasiados intentos.', retryAfterSeconds: 42 }),
      )
    renderLogin(login)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/Correo electrónico/), 'ana@example.com')
    await user.type(screen.getByLabelText(/^Contraseña/), 'otra')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Espera 42 segundos')
  })

  it('explains why the user is back at the login page after an expired session', async () => {
    renderLogin(vi.fn<AuthContextValue['login']>(), '/login?reason=expired')

    expect(await screen.findByText('Tu sesión expiró')).toBeInTheDocument()
  })
})
