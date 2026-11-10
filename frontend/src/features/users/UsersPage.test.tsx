import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Me, Page, RoleOut, UserOut } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { jsonResponse, makeUser, mockFetch, problemResponse, type FetchCall } from '@/test/http'
import { ToastProvider } from '@/ui'
import UsersPage from './UsersPage'

// jsdom has no modal dialogs: a minimal stand-in so the native <dialog> opens and closes.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false
  }
})

const ME = makeUser() // Ana Pérez, admin, id ...0001

const ADMIN_ROW: UserOut = {
  id: ME.id,
  email: ME.email,
  full_name: ME.full_name,
  role: { code: 'admin', name: 'Administrador' },
  is_active: true,
  must_change_password: false,
  last_login_at: '2026-11-09T19:30:00Z',
  created_at: '2026-11-01T12:00:00Z',
}

const OPERATOR_ROW: UserOut = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'luis.gomez@example.com',
  full_name: 'Luis Gómez',
  role: { code: 'operator', name: 'Operador' },
  is_active: true,
  must_change_password: true,
  last_login_at: null,
  created_at: '2026-11-08T15:00:00Z',
}

const VIEWER_ROW: UserOut = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'marta.ruiz@example.com',
  full_name: 'Marta Ruiz',
  role: { code: 'viewer', name: 'Visualizador' },
  is_active: false,
  must_change_password: false,
  last_login_at: '2026-11-05T13:00:00Z',
  created_at: '2026-11-02T15:00:00Z',
}

const ROLES: RoleOut[] = [
  { code: 'admin', name: 'Administrador', permissions: ['users:manage'] },
  { code: 'operator', name: 'Operador', permissions: ['drivers:write'] },
  { code: 'viewer', name: 'Visualizador', permissions: ['vehicles:read'] },
]

// Fake value for tests only: never a real credential.
const TEMP_PASSWORD = 'Tmp#Prueba-2026xY'

function page(items: UserOut[]): Page<UserOut> {
  return { items, total: items.length, page: 1, page_size: 20, pages: 1 }
}

type Route = (call: FetchCall) => Response | undefined

function mockApi(extra: Route = () => undefined) {
  return mockFetch((call) => {
    const answer = extra(call)
    if (answer) return answer
    if (call.url.startsWith('/api/v1/roles')) return jsonResponse(ROLES)
    if (call.method === 'GET' && call.url.startsWith('/api/v1/users')) {
      return jsonResponse(page([ADMIN_ROW, OPERATOR_ROW, VIEWER_ROW]))
    }
    return problemResponse(404, 'not_found')
  })
}

function renderUsers(me: Me = ME) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user: me,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => me.permissions.includes(permission),
  }
  const router = createMemoryRouter(
    [
      { path: '/app/users', element: <UsersPage /> },
      { path: '/change-password', element: <h1>Cambiar contraseña</h1> },
    ],
    { initialEntries: ['/app/users'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthContext value={auth}>
          <RouterProvider router={router} />
        </AuthContext>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { router }
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole('rowheader', { name: new RegExp(name) }).closest('tr')
  if (!row) throw new Error(`row for ${name} not found`)
  return row
}

describe('UsersPage', () => {
  it('lists users with role, state and Bogota last login, and protects the admin’s own row', async () => {
    mockApi()
    renderUsers()

    await screen.findByRole('table')
    expect(screen.getByText('3 usuarios')).toBeInTheDocument()

    const own = rowOf('Ana Pérez')
    expect(within(own).getByText('Tu cuenta')).toBeInTheDocument()
    expect(within(own).getByText('Administrador')).toBeInTheDocument()
    // 19:30 UTC is 14:30 in Bogota; the compact table date keeps the full one in its title.
    expect(within(own).getByText('9 de nov, 14:30')).toHaveAttribute('title', '9 de nov de 2026, 14:30')
    // Own account: change-password link and Editar; no deactivate/reset/menu (the backend refuses them).
    expect(within(own).getByText('No puedes desactivar tu propia cuenta ni cambiar tu rol.')).toBeInTheDocument()
    expect(within(own).getByRole('link', { name: 'Contraseña: cambiar la tuya' })).toHaveAttribute(
      'href',
      '/change-password',
    )
    expect(within(own).getByRole('button', { name: 'Editar a Ana Pérez' })).toHaveAccessibleDescription(
      'No puedes desactivar tu propia cuenta ni cambiar tu rol.',
    )
    expect(within(own).queryByRole('button', { name: /Desactivar|Restablecer|Más acciones/ })).not.toBeInTheDocument()

    const operator = rowOf('Luis Gómez')
    expect(within(operator).getByText('Debe cambiar la contraseña')).toBeInTheDocument()
    expect(within(operator).getByText('Nunca ha ingresado')).toBeInTheDocument()
    expect(within(operator).getByRole('button', { name: 'Editar a Luis Gómez' })).toBeEnabled()
    expect(within(operator).queryByRole('link', { name: /Contraseña/ })).not.toBeInTheDocument()

    // Other people: reset and activate/deactivate live in the "⋮" menu, destructive last.
    const viewer = rowOf('Marta Ruiz')
    expect(within(viewer).getByText('Inactivo')).toBeInTheDocument()
    await userEvent.setup().click(within(viewer).getByRole('button', { name: 'Más acciones para Marta Ruiz' }))
    const menu = screen.getByRole('menu', { name: 'Más acciones para Marta Ruiz' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Restablecer contraseña',
      'Activar',
    ])
  })

  it('creates a user and shows the temporary password only once', async () => {
    const { calls } = mockApi((call) =>
      call.method === 'POST' && call.url === '/api/v1/users'
        ? jsonResponse(
            {
              user: { ...OPERATOR_ROW, id: '00000000-0000-0000-0000-000000000009', email: 'nora@example.com', full_name: 'Nora Díaz' },
              temporary_password: TEMP_PASSWORD,
            },
            201,
          )
        : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const form = screen.getByRole('dialog', { name: 'Crear usuario' })
    const email = within(form).getByRole('textbox', { name: /Correo electrónico/ })
    expect(email).toHaveAttribute('placeholder', 'nombre@empresa.com')
    expect(email).toHaveAccessibleDescription('Será su usuario para iniciar sesión.')
    await user.type(email, 'nora@example.com')
    await user.type(within(form).getByRole('textbox', { name: /Nombre completo/ }), 'Nora Díaz')

    // Role cards are a real radio group: Visualizador by default, each role described.
    const roles = within(form).getByRole('group', { name: /Rol/ })
    expect(within(roles).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'viewer',
      'operator',
      'admin',
    ])
    const viewer = within(roles).getByRole('radio', { name: 'Visualizador' })
    expect(viewer).toBeChecked()
    expect(viewer).toHaveAccessibleDescription(/Solo lectura/)
    expect(within(roles).getByRole('radio', { name: 'Administrador' })).toHaveAccessibleDescription(
      /más usuarios y auditoría/,
    )
    await user.click(within(roles).getByRole('radio', { name: 'Operador' }))
    expect(within(roles).getByRole('radio', { name: 'Operador' })).toBeChecked()
    // Arrow keys move the selection inside the group, as in any native radio group.
    await user.keyboard('{ArrowDown}')
    expect(within(roles).getByRole('radio', { name: 'Administrador' })).toBeChecked()
    await user.keyboard('{ArrowUp}')
    expect(within(roles).getByRole('radio', { name: 'Operador' })).toHaveFocus()
    expect(within(roles).getByRole('radio', { name: 'Operador' })).toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Crear usuario' }))

    const shown = await screen.findByRole('dialog', { name: 'Usuario creado' })
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      email: 'nora@example.com',
      full_name: 'Nora Díaz',
      role: 'operator',
    })
    expect(within(shown).getByText(TEMP_PASSWORD)).toBeInTheDocument()
    expect(within(shown).getByText('Se muestra una sola vez')).toBeInTheDocument()
    expect(within(shown).getByText(/canal privado/)).toBeInTheDocument()

    await user.click(within(shown).getByRole('button', { name: 'Copiar contraseña' }))
    expect(await within(shown).findByText('Contraseña copiada al portapapeles.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(TEMP_PASSWORD)

    await user.click(within(shown).getByRole('button', { name: 'Entendido, cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(TEMP_PASSWORD)).not.toBeInTheDocument()
    // Keyboard users continue where they started the flow.
    expect(screen.getByRole('button', { name: 'Crear usuario' })).toHaveFocus()
    // The list is read again after the change (two GETs of /users: initial + invalidation).
    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/v1/users?'))).toHaveLength(2),
    )
  })

  it('validates the form and maps a duplicated e-mail (409) to its field', async () => {
    const { calls } = mockApi((call) =>
      call.method === 'POST'
        ? problemResponse(409, 'conflict', { detail: 'Ya existe un usuario con ese correo.' })
        : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const form = screen.getByRole('dialog', { name: 'Crear usuario' })
    await user.click(within(form).getByRole('button', { name: 'Crear usuario' }))
    const email = within(form).getByRole('textbox', { name: /Correo electrónico/ })
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(/Ingresa el correo electrónico/)
    expect(calls.some((call) => call.method === 'POST')).toBe(false)

    await user.type(email, 'luis.gomez@example.com')
    await user.type(within(form).getByRole('textbox', { name: /Nombre completo/ }), 'Luis Gómez')
    await user.click(within(form).getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(email).toHaveAccessibleDescription(/Ya existe un usuario con ese correo/))
    expect(screen.getByRole('dialog', { name: 'Crear usuario' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Usuario creado' })).not.toBeInTheDocument()
  })

  it('asks for confirmation before deactivating and sends only is_active', async () => {
    const { calls } = mockApi((call) =>
      call.method === 'PATCH' ? jsonResponse({ ...OPERATOR_ROW, is_active: false }) : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    const more = screen.getByRole('button', { name: 'Más acciones para Luis Gómez' })
    await user.click(more)
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    let confirm = screen.getByRole('dialog', { name: '¿Desactivar a Luis Gómez?' })
    expect(confirm).toHaveTextContent('sus sesiones abiertas se cerrarán de inmediato')
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
    // Focus returns to the menu button that started the flow.
    expect(more).toHaveFocus()

    await user.click(more)
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    confirm = screen.getByRole('dialog', { name: '¿Desactivar a Luis Gómez?' })
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar usuario' }))

    expect(await screen.findByText('Luis Gómez fue desactivado')).toBeInTheDocument()
    const patch = calls.find((call) => call.method === 'PATCH')
    expect(patch?.url).toBe(`/api/v1/users/${OPERATOR_ROW.id}`)
    expect(patch?.body).toEqual({ is_active: false })
  })

  it('keeps the confirmation open with the server message when deactivation fails', async () => {
    mockApi((call) =>
      call.method === 'PATCH'
        ? problemResponse(409, 'conflict', { detail: 'No puedes desactivar tu propia cuenta.' })
        : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Más acciones para Luis Gómez' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }))
    const confirm = screen.getByRole('dialog', { name: '¿Desactivar a Luis Gómez?' })
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar usuario' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('No puedes desactivar tu propia cuenta.')
  })

  it('resets a password after confirmation and shows the new temporary password', async () => {
    const { calls } = mockApi((call) =>
      call.method === 'POST' && call.url.endsWith('/reset-password')
        ? jsonResponse({ temporary_password: TEMP_PASSWORD })
        : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Más acciones para Luis Gómez' }))
    await user.click(screen.getByRole('menuitem', { name: 'Restablecer contraseña' }))
    const confirm = screen.getByRole('dialog', { name: '¿Restablecer la contraseña de Luis Gómez?' })
    expect(calls.some((call) => call.url.endsWith('/reset-password'))).toBe(false)
    await user.click(within(confirm).getByRole('button', { name: 'Restablecer contraseña' }))

    const shown = await screen.findByRole('dialog', { name: 'Contraseña restablecida' })
    expect(within(shown).getByText(TEMP_PASSWORD)).toBeInTheDocument()
    expect(within(shown).getByText(/luis\.gomez@example\.com/)).toBeInTheDocument()
    expect(calls.find((call) => call.url.endsWith('/reset-password'))?.url).toBe(
      `/api/v1/users/${OPERATOR_ROW.id}/reset-password`,
    )
  })

  it('locks the own role when the admin edits their account and sends only the changed name', async () => {
    const { calls } = mockApi((call) =>
      call.method === 'PATCH' ? jsonResponse({ ...ADMIN_ROW, full_name: 'Ana María Pérez' }) : undefined,
    )
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Editar a Ana Pérez' }))
    const form = screen.getByRole('dialog', { name: 'Editar a Ana Pérez' })
    const roles = within(form).getByRole('group', { name: /Rol/ })
    expect(roles).toBeDisabled()
    expect(roles).toHaveAccessibleDescription(/No puedes cambiar el rol de tu propia cuenta/)
    expect(within(roles).getByRole('radio', { name: 'Administrador' })).toBeChecked()
    expect(within(roles).getByRole('radio', { name: 'Visualizador' })).toBeDisabled()

    const name = within(form).getByRole('textbox', { name: /Nombre completo/ })
    await user.clear(name)
    await user.type(name, 'Ana María Pérez')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ full_name: 'Ana María Pérez' })
  })

  it('sends role and state filters to the server and starts again at page 1', async () => {
    const { calls } = mockApi()
    renderUsers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    const filters = screen.getByRole('search', { name: 'Filtrar usuarios' })
    await user.selectOptions(within(filters).getByRole('combobox', { name: 'Rol' }), 'operator')
    await user.selectOptions(within(filters).getByRole('combobox', { name: 'Estado' }), 'inactive')

    await waitFor(() => {
      const last = new URL(calls.filter((call) => call.url.startsWith('/api/v1/users?')).at(-1)!.url, 'http://test')
      expect(last.searchParams.get('role')).toBe('operator')
      expect(last.searchParams.get('is_active')).toBe('false')
      expect(last.searchParams.get('page')).toBe('1')
    })
  })

  it('shows an error with retry when the list cannot load', async () => {
    let failing = true
    mockApi((call) =>
      call.method === 'GET' && call.url.startsWith('/api/v1/users') && failing
        ? problemResponse(500, 'internal_error', { detail: 'Ocurrió un error inesperado.' })
        : undefined,
    )
    renderUsers()
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los usuarios' })).toBeInTheDocument()
    failing = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
