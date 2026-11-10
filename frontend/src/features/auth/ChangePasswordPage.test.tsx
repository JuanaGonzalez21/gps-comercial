import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Me } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { makeUser } from '@/test/http'
import { ToastProvider } from '@/ui'
import ChangePasswordPage from './ChangePasswordPage'

// Fake values for tests only: never real credentials.
const NEW_PASSWORD = 'Nueva#Clave-2026x'

function renderPage(me: Me) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user: me,
    login: vi.fn(),
    logout: vi.fn<AuthContextValue['logout']>().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => me.permissions.includes(permission),
  }
  const router = createMemoryRouter(
    [
      { path: '/change-password', element: <ChangePasswordPage /> },
      { path: '/app/dashboard', element: <h1>Panel</h1> },
    ],
    { initialEntries: ['/change-password'] },
  )
  render(
    <ToastProvider>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </ToastProvider>,
  )
  return { auth, router }
}

describe('ChangePasswordPage', () => {
  it('lets a voluntary change go back to the panel', async () => {
    const { auth, router } = renderPage(makeUser({ must_change_password: false }))
    const user = userEvent.setup()

    expect(screen.queryByRole('button', { name: 'Cancelar y cerrar sesión' })).not.toBeInTheDocument()
    const back = screen.getByRole('link', { name: 'Cancelar y volver al panel' })
    expect(back).toHaveAttribute('href', '/app/dashboard')

    await user.click(back)
    expect(router.state.location.pathname).toBe('/app/dashboard')
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('only offers signing out while a temporary password is pending', async () => {
    const { auth } = renderPage(makeUser({ must_change_password: true }))
    const user = userEvent.setup()

    expect(screen.getByText('Debes crear una contraseña propia')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /volver al panel/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar y cerrar sesión' }))
    expect(auth.logout).toHaveBeenCalledTimes(1)
  })

  it('says live whether the confirmation matches, without marking the field invalid', async () => {
    const { auth } = renderPage(makeUser())
    const user = userEvent.setup()

    const status = screen.getAllByRole('status').find((node) => node.id === 'confirm-password-match')!
    expect(status).toBeEmptyDOMElement()

    await user.type(screen.getByLabelText(/^Nueva contraseña/), NEW_PASSWORD)
    const confirm = screen.getByLabelText(/^Confirmar nueva contraseña/)
    await user.type(confirm, 'Nueva#')
    expect(status).toHaveTextContent('Las contraseñas no coinciden.')
    expect(confirm).toHaveAccessibleDescription('Las contraseñas no coinciden.')
    expect(confirm).not.toHaveAttribute('aria-invalid')

    await user.clear(confirm)
    await user.type(confirm, NEW_PASSWORD)
    expect(status).toHaveTextContent('Las contraseñas coinciden.')

    await user.clear(confirm)
    expect(status).toBeEmptyDOMElement()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })
})
