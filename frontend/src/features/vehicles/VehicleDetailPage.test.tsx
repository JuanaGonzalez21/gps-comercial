import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CustomField, CustomFieldInput, CustomFieldUpdateInput, Me, VehicleDetail } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/auth/useAuth'
import { jsonResponse, makeUser, mockFetch, problemResponse, VIEWER_PERMISSIONS, type FetchCall } from '@/test/http'
import { ToastProvider } from '@/ui'
import type { VehiclePositionMapProps } from './VehiclePositionMap'
import VehicleDetailPage from './VehicleDetailPage'

// Leaflet needs a real layout engine: the page is tested against a stand-in with the same props.
vi.mock('./VehiclePositionMap', () => ({
  VehiclePositionMap: ({ vehicle }: VehiclePositionMapProps) => (
    <div data-testid="position-map">
      {vehicle.latitude},{vehicle.longitude}
    </div>
  ),
}))

// jsdom has no <dialog> modal API; the confirmation dialog only needs open/close.
const dialogPrototype = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const nativeShowModal = dialogPrototype.showModal
const nativeClose = dialogPrototype.close
beforeAll(() => {
  dialogPrototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogPrototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})
afterAll(() => {
  dialogPrototype.showModal = nativeShowModal
  dialogPrototype.close = nativeClose
})

const VIEWER = makeUser({ role: { code: 'viewer', name: 'Visualizador' }, permissions: VIEWER_PERMISSIONS })

const FULL_DETAIL: VehicleDetail = {
  id: 1,
  name: 'Camión 01',
  status: 'moving',
  last_message_at: '2026-11-09T19:30:00Z',
  position: {
    latitude: 4.65,
    longitude: -74.1,
    speed_kmh: 42,
    course_deg: 45,
    altitude_m: 2600,
    satellites: 9,
    recorded_at: '2026-11-09T19:30:00Z',
  },
  driver: { resource_id: 10, id: 5, name: 'Luz Gómez', phone: '+57 300 123 4567' },
  passenger_count: 2,
  custom_fields: [],
  passengers: [
    { resource_id: 10, id: 7, name: 'Ana Ruiz', phone: null },
    { resource_id: 10, id: 8, name: 'Pedro Díaz', phone: '3001234567' },
  ],
}

const BARE_DETAIL: VehicleDetail = {
  ...FULL_DETAIL,
  id: 1,
  name: 'Van 02',
  status: 'no_signal',
  last_message_at: null,
  position: null,
  driver: null,
  passenger_count: 0,
  passengers: [],
}

const FIELDS: CustomField[] = [
  { id: 1, name: 'Color', value: 'Rojo' },
  { id: 2, name: 'Placa', value: 'ABC123' },
]

interface ServerState {
  detail: VehicleDetail
  fields: CustomField[]
}

/** Returning a Response short-circuits the fake API; returning undefined lets it answer. */
type Override = (call: FetchCall) => Response | undefined | Promise<Response | undefined>

const FIELD_URL = /^\/api\/v1\/vehicles\/1\/custom-fields\/(\d+)$/

/** In-memory stand-in for the backend contract (docs/api-contract.md, Vehículos). */
function fakeApi(state: ServerState, override?: Override) {
  let nextId = 50
  return mockFetch(async (call) => {
    const custom = await override?.(call)
    if (custom) return custom
    const { url, method } = call
    if (method === 'GET' && url === '/api/v1/vehicles/1') return jsonResponse(state.detail)
    if (url === '/api/v1/vehicles/1/custom-fields') {
      if (method === 'GET') return jsonResponse(state.fields)
      const input = call.body as CustomFieldInput
      const created = { id: nextId++, name: input.name, value: input.value }
      state.fields = [...state.fields, created]
      return jsonResponse(created, 201)
    }
    const match = FIELD_URL.exec(url)
    if (match) {
      const id = Number(match[1])
      const current = state.fields.find((field) => field.id === id)
      if (!current) return problemResponse(404, 'not_found', { detail: 'El campo personalizado no existe en este vehículo.' })
      if (method === 'DELETE') {
        state.fields = state.fields.filter((field) => field.id !== id)
        return new Response(null, { status: 204 })
      }
      const input = call.body as CustomFieldUpdateInput
      if (input.expected_value !== undefined && input.expected_value !== current.value) {
        return problemResponse(409, 'conflict', {
          detail: 'El campo cambió en Wialon mientras lo editabas. Recarga para ver el valor actual y vuelve a intentarlo.',
        })
      }
      const updated = { id, name: input.name, value: input.value }
      state.fields = state.fields.map((field) => (field.id === id ? updated : field))
      return jsonResponse(updated)
    }
    return problemResponse(404, 'not_found', { detail: `Ruta no simulada: ${method} ${url}` })
  })
}

/** A request that waits until the test releases it, to observe the optimistic state. */
function gate() {
  let release!: () => void
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { opened, release }
}

function authFor(user: Me): AuthContextValue {
  return {
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshUser: vi.fn(),
    hasPermission: (permission) => user.permissions.includes(permission),
  }
}

function renderDetail(user: Me = makeUser(), path = '/app/vehicles/1') {
  const router = createMemoryRouter(
    [
      { path: '/app/vehicles', element: <p>Lista de vehículos</p> },
      { path: '/app/vehicles/:id', element: <VehicleDetailPage /> },
    ],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={authFor(user)}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthContext>
    </QueryClientProvider>,
  )
}

function fieldsSection() {
  return screen.getByRole('region', { name: 'Campos personalizados' })
}

async function fieldsList() {
  const section = await screen.findByRole('region', { name: 'Campos personalizados' })
  return within(section).findByRole('list')
}

describe('VehicleDetailPage', () => {
  it('shows the transformed data, position, driver and passengers', async () => {
    fakeApi({ detail: FULL_DETAIL, fields: FIELDS })
    renderDetail()

    expect(await screen.findByRole('heading', { level: 1, name: 'Camión 01' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toContainElement(
      screen.getByRole('link', { name: 'Vehículos' }),
    )
    expect(screen.getByText('En movimiento')).toBeInTheDocument()
    expect(screen.getByText(/Última actualización/)).toHaveTextContent('9 de nov de 2026, 14:30')

    const position = screen.getByRole('region', { name: 'Posición actual' })
    expect(within(position).getByTestId('position-map')).toHaveTextContent('4.65,-74.1')
    expect(within(position).getByText('42 km/h')).toBeInTheDocument()
    expect(within(position).getByText('Noreste (NE)')).toBeInTheDocument()
    expect(within(position).getByText('2.600 m')).toBeInTheDocument()
    expect(within(position).getByText('4,65000')).toBeInTheDocument()
    expect(within(position).getByText('-74,10000')).toBeInTheDocument()

    const driver = screen.getByRole('region', { name: 'Conductor asignado' })
    expect(within(driver).getByText('Luz Gómez')).toBeInTheDocument()
    expect(within(driver).getByRole('link', { name: /300 123 4567/ })).toHaveAttribute('href', 'tel:+573001234567')

    const passengers = screen.getByRole('region', { name: 'Pasajeros asignados' })
    expect(within(passengers).getByText('2 pasajeros vinculados en Wialon.')).toBeInTheDocument()
    expect(within(passengers).getByText('Ana Ruiz')).toBeInTheDocument()
    expect(within(passengers).getByText('Pedro Díaz')).toBeInTheDocument()

    const list = await fieldsList()
    expect(within(list).getByText('Color')).toBeInTheDocument()
    expect(within(list).getByText('Rojo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver historial' })).toHaveAttribute('href', '/app/history?vehicle=1')
  })

  it('says clearly when there is no driver, no passengers and no position (RF-13)', async () => {
    fakeApi({ detail: BARE_DETAIL, fields: [] })
    renderDetail()

    expect(await screen.findByRole('heading', { level: 1, name: 'Van 02' })).toBeInTheDocument()
    expect(screen.getByText('Sin señal')).toBeInTheDocument()
    expect(screen.getByText(/Última actualización/)).toHaveTextContent('sin reportes')

    const driver = screen.getByRole('region', { name: 'Conductor asignado' })
    expect(within(driver).getByText('Sin conductor asignado')).toBeInTheDocument()
    expect(within(driver).getByRole('link', { name: 'Asignar un conductor desde Conductores' })).toHaveAttribute(
      'href',
      '/app/drivers',
    )
    const passengers = screen.getByRole('region', { name: 'Pasajeros asignados' })
    expect(within(passengers).getByText('Sin pasajeros asignados')).toBeInTheDocument()

    const position = screen.getByRole('region', { name: 'Posición actual' })
    expect(within(position).getByText('Sin posición')).toBeInTheDocument()
    expect(screen.queryByTestId('position-map')).not.toBeInTheDocument()
    expect(
      await within(fieldsSection()).findByText('Este vehículo no tiene campos personalizados'),
    ).toBeInTheDocument()
  })

  it('shows "vehículo no encontrado" for an unknown or invalid id', async () => {
    const { calls } = fakeApi({ detail: FULL_DETAIL, fields: [] }, ({ url }) =>
      url === '/api/v1/vehicles/1' ? problemResponse(404, 'not_found', { detail: 'El vehículo no existe.' }) : undefined,
    )
    renderDetail()
    expect(await screen.findByRole('heading', { level: 1, name: 'Vehículo no encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a vehículos' })).toHaveAttribute('href', '/app/vehicles')
    expect(calls.some((call) => call.url.endsWith('/custom-fields'))).toBe(false)
  })

  it('does not even ask the API for a malformed id', async () => {
    const { calls } = fakeApi({ detail: FULL_DETAIL, fields: [] })
    renderDetail(makeUser(), '/app/vehicles/abc')
    expect(await screen.findByRole('heading', { level: 1, name: 'Vehículo no encontrado' })).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('offers a retry when the detail cannot be loaded', async () => {
    let fail = true
    fakeApi({ detail: FULL_DETAIL, fields: FIELDS }, ({ url }) =>
      fail && url === '/api/v1/vehicles/1'
        ? problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no está disponible.' })
        : undefined,
    )
    renderDetail()
    const user = userEvent.setup()

    expect(await screen.findByText('No pudimos cargar el vehículo')).toBeInTheDocument()
    expect(screen.getByText('Wialon no está disponible.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Camión 01' })).toBeInTheDocument()
  })

  it('gives the Visualizador role no write actions', async () => {
    fakeApi({ detail: BARE_DETAIL, fields: FIELDS })
    renderDetail(VIEWER)

    const list = await fieldsList()
    expect(within(list).getByText('Rojo')).toBeInTheDocument()
    const section = fieldsSection()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
    expect(within(section).getByText(/Solo los roles Administrador y Operador pueden editarlos/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Asignar/ })).not.toBeInTheDocument()
  })

  describe('custom fields (RF-19..RF-22)', () => {
    it('validates, adds optimistically and confirms with a toast', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      const post = gate()
      const { calls } = fakeApi(state, async ({ method }) => {
        if (method === 'POST') await post.opened
        return undefined
      })
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(screen.getByRole('button', { name: 'Agregar campo' }))
      const form = screen.getByRole('form', { name: 'Agregar campo personalizado' })
      const name = within(form).getByRole('textbox', { name: /Nombre/ })
      const value = within(form).getByRole('textbox', { name: /Valor/ })
      expect(name).toHaveFocus()

      await user.click(within(form).getByRole('button', { name: 'Agregar campo' }))
      expect(name).toHaveAttribute('aria-invalid', 'true')
      expect(name).toHaveAccessibleDescription(expect.stringContaining('Escribe el nombre del campo.'))

      await user.type(name, '  color ')
      await user.click(within(form).getByRole('button', { name: 'Agregar campo' }))
      expect(await within(form).findByText('Ya existe un campo con ese nombre en este vehículo.')).toBeInTheDocument()

      await user.clear(name)
      await user.type(name, 'x'.repeat(51))
      await user.click(within(form).getByRole('button', { name: 'Agregar campo' }))
      expect(await within(form).findByText('El nombre admite máximo 50 caracteres.')).toBeInTheDocument()
      expect(calls.some((call) => call.method === 'POST')).toBe(false)

      await user.clear(name)
      await user.type(name, ' Seguro ')
      await user.type(value, 'Vigente')
      await user.click(within(form).getByRole('button', { name: 'Agregar campo' }))

      // Optimistic: visible in the list, marked as saving, before Wialon answers.
      const pendingRow = (await within(list).findByText('Seguro')).closest('li') as HTMLElement
      expect(within(pendingRow).getByText('Vigente')).toBeInTheDocument()
      expect(within(pendingRow).getByText('Guardando…')).toBeInTheDocument()

      post.release()
      expect(await screen.findByText('Campo agregado')).toBeInTheDocument()
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Seguro', value: 'Vigente' })
      await waitFor(() =>
        expect(screen.queryByRole('form', { name: 'Agregar campo personalizado' })).not.toBeInTheDocument(),
      )
      const savedRow = within(list).getByText('Seguro').closest('li') as HTMLElement
      expect(within(savedRow).queryByText('Guardando…')).not.toBeInTheDocument()
      expect(within(savedRow).getByRole('button', { name: 'Editar el campo Seguro' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Agregar campo' })).toHaveFocus()
    })

    it('rolls back a failed addition and lets the user retry', async () => {
      let fail = true
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      fakeApi(state, ({ method }) =>
        method === 'POST' && fail
          ? problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no está disponible.' })
          : undefined,
      )
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(screen.getByRole('button', { name: 'Agregar campo' }))
      const form = screen.getByRole('form', { name: 'Agregar campo personalizado' })
      await user.type(within(form).getByRole('textbox', { name: /Nombre/ }), 'Seguro')
      await user.click(within(form).getByRole('button', { name: 'Agregar campo' }))

      const alert = await within(form).findByRole('alert')
      expect(alert).toHaveTextContent('No se agregó el campo')
      expect(alert).toHaveTextContent('Wialon no está disponible.')
      expect(alert).toHaveFocus()
      expect(within(list).queryByText('Seguro')).not.toBeInTheDocument() // rolled back
      expect(within(form).getByRole('textbox', { name: /Nombre/ })).toHaveValue('Seguro') // form kept

      fail = false
      await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
      expect(await screen.findByText('Campo agregado')).toBeInTheDocument()
      expect(await within(list).findByText('Seguro')).toBeInTheDocument()
      expect(state.fields.map((field) => field.name)).toEqual(['Color', 'Placa', 'Seguro'])
    })

    it('edits optimistically and sends the value the user started from', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      const put = gate()
      const { calls } = fakeApi(state, async ({ method }) => {
        if (method === 'PUT') await put.opened
        return undefined
      })
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      const form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      const value = within(form).getByRole('textbox', { name: /Valor/ })
      expect(within(form).getByRole('textbox', { name: /Nombre/ })).toHaveFocus()
      await user.clear(value)
      await user.type(value, 'Azul')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

      const row = (await within(list).findByText('Azul')).closest('li') as HTMLElement
      expect(within(row).getByText('Guardando…')).toBeInTheDocument()
      expect(within(list).queryByText('Rojo')).not.toBeInTheDocument()

      put.release()
      expect(await screen.findByText('Campo actualizado')).toBeInTheDocument()
      expect(calls.find((call) => call.method === 'PUT')).toMatchObject({
        url: '/api/v1/vehicles/1/custom-fields/1',
        body: { name: 'Color', value: 'Azul', expected_value: 'Rojo' },
      })
      await waitFor(() => expect(within(row).queryByText('Guardando…')).not.toBeInTheDocument())
      expect(within(row).getByRole('button', { name: 'Editar el campo Color' })).toHaveFocus()
    })

    it('restores the previous value when Wialon rejects an edit, keeping the draft to retry', async () => {
      let fail = true
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      fakeApi(state, ({ method }) =>
        method === 'PUT' && fail
          ? problemResponse(502, 'upstream_error', { detail: 'Wialon devolvió un error.' })
          : undefined,
      )
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      let form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      await user.clear(within(form).getByRole('textbox', { name: /Valor/ }))
      await user.type(within(form).getByRole('textbox', { name: /Valor/ }), 'Azul')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

      const alert = await within(list).findByRole('alert')
      expect(alert).toHaveTextContent('No se guardó el cambio')
      expect(alert).toHaveTextContent('Wialon devolvió un error.')
      form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      expect(within(form).getByRole('textbox', { name: /Valor/ })).toHaveValue('Azul')

      // Cancel: the list shows the value Wialon still has (rollback), not the failed draft.
      await user.click(within(form).getByRole('button', { name: 'Cancelar' }))
      expect(within(list).getByText('Rojo')).toBeInTheDocument()
      expect(within(list).queryByText('Azul')).not.toBeInTheDocument()

      // Edit again and retry from the error message once Wialon is back.
      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      await user.clear(within(form).getByRole('textbox', { name: /Valor/ }))
      await user.type(within(form).getByRole('textbox', { name: /Valor/ }), 'Azul')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
      const retry = within(await within(list).findByRole('alert')).getByRole('button', { name: 'Reintentar' })
      fail = false
      await user.click(retry)
      expect(await screen.findByText('Campo actualizado')).toBeInTheDocument()
      expect(await within(list).findByText('Azul')).toBeInTheDocument()
      expect(state.fields[0]).toEqual({ id: 1, name: 'Color', value: 'Azul' })
    })

    it('warns about a change made in Wialon meanwhile and lets the user overwrite it (409)', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      const { calls } = fakeApi(state)
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      // Someone changes the field directly in Wialon while the form is open.
      state.fields = state.fields.map((field) => (field.id === 1 ? { ...field, value: 'Verde' } : field))
      const form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      await user.clear(within(form).getByRole('textbox', { name: /Valor/ }))
      await user.type(within(form).getByRole('textbox', { name: /Valor/ }), 'Azul')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

      const alert = await within(list).findByRole('alert')
      expect(alert).toHaveTextContent('Este campo cambió en Wialon mientras lo editabas')
      expect(alert).toHaveTextContent('Tu cambio no se guardó.')
      expect(alert).toHaveTextContent('Valor actual en Wialon: «Verde»')
      expect(alert).toHaveFocus()
      expect(state.fields[0].value).toBe('Verde')

      await user.click(within(alert).getByRole('button', { name: 'Sobrescribir con mi valor' }))
      expect(await screen.findByText('Campo actualizado')).toBeInTheDocument()
      const puts = calls.filter((call) => call.method === 'PUT')
      expect(puts.map((call) => call.body)).toEqual([
        { name: 'Color', value: 'Azul', expected_value: 'Rojo' },
        { name: 'Color', value: 'Azul', expected_value: 'Verde' },
      ])
      expect(await within(list).findByText('Azul')).toBeInTheDocument()
    })

    it('can load the current Wialon value into the form after a conflict', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      fakeApi(state)
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      state.fields = state.fields.map((field) => (field.id === 1 ? { ...field, value: 'Verde' } : field))
      const form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      await user.type(within(form).getByRole('textbox', { name: /Valor/ }), ' oscuro')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

      const alert = await within(list).findByRole('alert')
      await user.click(within(alert).getByRole('button', { name: 'Usar el valor actual' }))
      const reloaded = within(list).getByRole('form', { name: 'Editar el campo Color' })
      expect(within(reloaded).getByRole('textbox', { name: /Valor/ })).toHaveValue('Verde')
      expect(within(list).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('reports a duplicate name returned by the API on the name field', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      fakeApi(state, ({ method }) =>
        method === 'PUT'
          ? problemResponse(409, 'conflict', { detail: 'Ya existe un campo con ese nombre en este vehículo.' })
          : undefined,
      )
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Editar el campo Color' }))
      const form = within(list).getByRole('form', { name: 'Editar el campo Color' })
      const name = within(form).getByRole('textbox', { name: /Nombre/ })
      await user.clear(name)
      await user.type(name, 'Tono')
      await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

      const reopened = await within(list).findByRole('form', { name: 'Editar el campo Color' })
      const nameAgain = within(reopened).getByRole('textbox', { name: /Nombre/ })
      await waitFor(() => expect(nameAgain).toHaveAttribute('aria-invalid', 'true'))
      expect(nameAgain).toHaveAccessibleDescription(
        expect.stringContaining('Ya existe un campo con ese nombre en este vehículo.'),
      )
      expect(nameAgain).toHaveValue('Tono')
    })

    it('deletes after confirmation, optimistically, and restores the row if Wialon fails', async () => {
      let fail = true
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      const { calls } = fakeApi(state, ({ method }) =>
        method === 'DELETE' && fail
          ? problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no está disponible.' })
          : undefined,
      )
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Eliminar el campo Placa' }))
      const dialog = screen.getByRole('dialog', { name: '¿Eliminar este campo?' })
      expect(dialog).toHaveTextContent('Se eliminará «Placa» de este vehículo en Wialon.')
      await user.click(within(dialog).getByRole('button', { name: 'Eliminar campo' }))

      const alert = await within(fieldsSection()).findByRole('alert')
      expect(alert).toHaveTextContent('No se eliminó «Placa»')
      expect(alert).toHaveTextContent('Wialon no está disponible.')
      expect(within(list).getByText('Placa')).toBeInTheDocument() // rolled back
      expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)

      fail = false
      await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
      expect(await screen.findByText('Campo eliminado')).toBeInTheDocument()
      await waitFor(() => expect(within(list).queryByText('Placa')).not.toBeInTheDocument())
      expect(state.fields.map((field) => field.name)).toEqual(['Color'])
      expect(within(fieldsSection()).queryByRole('alert')).not.toBeInTheDocument()
    })

    it('removes the row at once while the deletion is in flight', async () => {
      const state = { detail: FULL_DETAIL, fields: [...FIELDS] }
      const del = gate()
      fakeApi(state, async ({ method }) => {
        if (method === 'DELETE') await del.opened
        return undefined
      })
      renderDetail()
      const user = userEvent.setup()
      const list = await fieldsList()

      await user.click(within(list).getByRole('button', { name: 'Eliminar el campo Placa' }))
      await user.click(
        within(screen.getByRole('dialog', { name: '¿Eliminar este campo?' })).getByRole('button', {
          name: 'Eliminar campo',
        }),
      )
      await waitFor(() => expect(within(list).queryByText('Placa')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Campos personalizados' })).toHaveFocus()

      del.release()
      expect(await screen.findByText('Campo eliminado')).toBeInTheDocument()
    })
  })
})
