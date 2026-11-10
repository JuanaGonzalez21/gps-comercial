import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PassengerCustomField, PassengerOut, ResourceOut } from '@/api/types'
import {
  installDialogPolyfill,
  OPERATOR_PERMISSIONS,
  pageOf,
  renderWithApp,
  vehicleSummary,
  VIEWER_PERMISSIONS,
} from '@/features/drivers/shared/testing'
import { jsonResponse, mockFetch, problemResponse, type FetchCall } from '@/test/http'
import PassengersPage from './PassengersPage'

// Wialon is simulated: fetch answers with the backend contract (docs/api-contract.md). The fake
// server keeps the custom fields of one passenger and merges each change like the backend does.

const ANA: PassengerOut = {
  resource_id: 10,
  id: 1,
  name: 'Ana Rojas',
  code: 'P-01',
  phone: null,
  vehicle: { id: 102, name: 'Van 02' },
  custom_fields: [
    { key: 'Empresa', value: 'Acme' },
    { key: 'Ruta/turno', value: 'Norte' },
  ],
}
const BETO: PassengerOut = {
  resource_id: 10,
  id: 2,
  name: 'Beto Díaz',
  code: null,
  phone: '3001112233',
  vehicle: null,
  custom_fields: [],
}
const VEHICLES = [vehicleSummary(101, 'Camión 01'), vehicleSummary(102, 'Van 02'), vehicleSummary(103, 'Bus 03')]
const ONE_RESOURCE: ResourceOut[] = [{ id: 10, name: 'Flota principal' }]
const FIELDS_PATH = '/api/v1/passengers/10/1/custom-fields'

interface FakeServerOptions {
  passengers?: PassengerOut[]
  fields?: PassengerCustomField[]
  /** Optional failure for a write; return undefined to let the fake server apply it. */
  fail?: (call: FetchCall) => Response | undefined
  write?: (call: FetchCall) => Response
}

function fieldKeyOf(url: URL): string {
  return decodeURIComponent(url.pathname.slice(FIELDS_PATH.length + 1))
}

function mockServer({ passengers = [ANA, BETO], fields = [...ANA.custom_fields], fail, write }: FakeServerOptions = {}) {
  let store = fields.map((field) => ({ ...field }))
  const mock = mockFetch((call) => {
    const url = new URL(call.url, 'http://localhost')
    if (call.method === 'GET' && url.pathname === '/api/v1/resources') return jsonResponse(ONE_RESOURCE)
    if (call.method === 'GET' && url.pathname === '/api/v1/vehicles') return jsonResponse(pageOf(VEHICLES, 3, 1, 100))
    if (call.method === 'GET' && url.pathname === '/api/v1/passengers') return jsonResponse(pageOf(passengers))
    if (call.method === 'GET' && url.pathname === FIELDS_PATH) return jsonResponse(store)
    const failure = fail?.(call)
    if (failure) return failure
    if (url.pathname === FIELDS_PATH && call.method === 'POST') {
      const created = call.body as PassengerCustomField
      store = [...store, created]
      return jsonResponse(created, 201)
    }
    if (url.pathname.startsWith(`${FIELDS_PATH}/`)) {
      const key = fieldKeyOf(url)
      if (call.method === 'DELETE') {
        store = store.filter((field) => field.key !== key)
        return new Response(null, { status: 204 })
      }
      const { value, new_key: newKey } = call.body as { value: string; new_key?: string }
      const saved = { key: newKey ?? key, value }
      store = store.map((field) => (field.key === key ? saved : field))
      return jsonResponse(saved)
    }
    return write ? write(call) : problemResponse(500, 'internal_error')
  })
  return { ...mock, fields: () => store }
}

function writes(calls: FetchCall[]): FetchCall[] {
  return calls.filter((call) => call.method !== 'GET')
}

function renderPassengers(permissions = OPERATOR_PERMISSIONS, url = '/app/passengers') {
  renderWithApp(<PassengersPage />, '/app/passengers', permissions, url)
}

beforeAll(installDialogPolyfill)

describe('PassengersPage — list', () => {
  it('filters by vehicle (also from the URL) and shows vehicle and custom field count', async () => {
    const { calls } = mockServer()
    renderPassengers(OPERATOR_PERMISSIONS, '/app/passengers?vehicle_id=102')
    const user = userEvent.setup()

    const table = await screen.findByRole('table')
    const anaRow = within(table).getByRole('row', { name: /Ana Rojas/ })
    expect(within(anaRow).getByRole('link', { name: 'Van 02' })).toBeInTheDocument()
    expect(within(anaRow).getByRole('button', { name: '2 campos personalizados de Ana Rojas' })).toBeInTheDocument()
    expect(within(anaRow).getByRole('button', { name: '2 campos personalizados de Ana Rojas' })).toHaveTextContent(
      '2 campos',
    )
    const betoRow = within(table).getByRole('row', { name: /Beto Díaz/ })
    expect(within(betoRow).getByRole('button', { name: 'Asignar vehículo a Beto Díaz' })).toBeInTheDocument()
    expect(within(betoRow).getByRole('button', { name: '0 campos personalizados de Beto Díaz' })).toBeInTheDocument()
    expect(calls.some((call) => call.url.startsWith('/api/v1/passengers?') && call.url.includes('vehicle_id=102'))).toBe(
      true,
    )
    const vehicleFilter = screen.getByRole('combobox', { name: 'Vehículo' })
    await waitFor(() => expect(vehicleFilter).toHaveValue('102'))

    await user.selectOptions(vehicleFilter, '')
    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.url.startsWith('/api/v1/passengers?') && !call.url.includes('vehicle_id') && call.url.includes('page=1'),
        ),
      ).toBe(true),
    )
  })
})

describe('PassengersPage — create and edit', () => {
  it('creates a passenger with initial custom fields, checking repeated keys and server errors', async () => {
    const answers = [
      () =>
        problemResponse(422, 'validation_error', {
          errors: [{ field: 'custom_fields.1.value', message: 'El servidor rechazó este valor.' }],
        }),
      () => jsonResponse({ ...BETO, id: 7, name: 'Carla Mejía' }, 201),
    ]
    const { calls } = mockServer({ write: () => answers.shift()!() })
    renderPassengers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo pasajero' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo pasajero' })
    await user.type(within(dialog).getByRole('textbox', { name: /Nombre/ }), 'Carla Mejía')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar campo' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Clave del campo 1/ }), 'Empresa')
    await user.type(within(dialog).getByRole('textbox', { name: /Valor del campo 1/ }), 'Acme')
    await user.click(within(dialog).getByRole('button', { name: 'Agregar campo' }))
    await user.type(within(dialog).getByRole('textbox', { name: /Clave del campo 2/ }), 'empresa')
    await user.click(within(dialog).getByRole('button', { name: 'Crear pasajero' }))

    expect(within(dialog).getByRole('textbox', { name: /Clave del campo 2/ })).toHaveAccessibleDescription(
      'Esta clave está repetida.',
    )
    expect(writes(calls)).toHaveLength(0)

    const secondKey = within(dialog).getByRole('textbox', { name: /Clave del campo 2/ })
    await user.clear(secondKey)
    await user.type(secondKey, 'Turno')
    await user.type(within(dialog).getByRole('textbox', { name: /Valor del campo 2/ }), 'Mañana')
    await user.click(within(dialog).getByRole('button', { name: 'Crear pasajero' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: /Valor del campo 2/ })).toHaveAccessibleDescription(
        'El servidor rechazó este valor.',
      ),
    )
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/v1/passengers',
      body: {
        name: 'Carla Mejía',
        code: null,
        phone: null,
        custom_fields: [
          { key: 'Empresa', value: 'Acme' },
          { key: 'Turno', value: 'Mañana' },
        ],
      },
    })

    await user.click(within(dialog).getByRole('button', { name: 'Crear pasajero' }))
    expect(await screen.findByText('Pasajero creado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits only the basic data: the custom fields are not sent (the backend keeps them)', async () => {
    const { calls } = mockServer({ write: (call) => jsonResponse({ ...ANA, ...(call.body as object) }) })
    renderPassengers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Editar a Ana Rojas' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar a «Ana Rojas»' })
    const phone = within(dialog).getByRole('textbox', { name: /Teléfono/ })
    await user.type(phone, '+57 (1) 555-0101')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
    expect(writes(calls)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        url: '/api/v1/passengers/10/1',
        body: { name: 'Ana Rojas', code: 'P-01', phone: '+57 (1) 555-0101' },
      }),
    ])
  })
})

describe('PassengersPage — custom fields editor', () => {
  it('adds, renames, changes and deletes fields one at a time, with confirmation to delete', async () => {
    const server = mockServer({ fields: [...ANA.custom_fields, { key: '..', value: 'importado' }] })
    renderPassengers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: '2 campos personalizados de Ana Rojas' }))
    const dialog = screen.getByRole('dialog', { name: 'Campos personalizados de «Ana Rojas»' })
    // Fresh data is read from the server (it has a third field the list did not show yet).
    expect(await within(dialog).findByText('importado')).toBeInTheDocument()
    expect(within(dialog).getByText('Esta clave no se puede editar desde la aplicación; usa Wialon.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Editar el campo ..' })).not.toBeInTheDocument()

    // Add (a repeated key is refused before calling the API).
    const addForm = within(dialog).getByRole('form', { name: 'Agregar campo' })
    await user.type(within(addForm).getByRole('textbox', { name: /Clave del nuevo campo/ }), 'EMPRESA')
    await user.click(within(addForm).getByRole('button', { name: 'Agregar campo' }))
    expect(within(addForm).getByRole('textbox', { name: /Clave del nuevo campo/ })).toHaveAccessibleDescription(
      'Ya existe un campo con esa clave en este pasajero.',
    )
    expect(writes(server.calls)).toHaveLength(0)
    await user.clear(within(addForm).getByRole('textbox', { name: /Clave del nuevo campo/ }))
    await user.type(within(addForm).getByRole('textbox', { name: /Clave del nuevo campo/ }), 'Silla')
    await user.type(within(addForm).getByRole('textbox', { name: /Valor del nuevo campo/ }), 'Sí')
    await user.click(within(addForm).getByRole('button', { name: 'Agregar campo' }))
    expect(await within(dialog).findByText('Campo «Silla» agregado en Wialon.')).toBeInTheDocument()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Campo «Silla» agregado en Wialon.')

    // Rename a key that contains "/" and change its value.
    await user.click(within(dialog).getByRole('button', { name: 'Editar el campo Ruta/turno' }))
    let editForm = within(dialog).getByRole('form', { name: 'Editar el campo Ruta/turno' })
    await user.clear(within(editForm).getByRole('textbox', { name: /Clave/ }))
    await user.type(within(editForm).getByRole('textbox', { name: /Clave/ }), 'Turno')
    await user.clear(within(editForm).getByRole('textbox', { name: /Valor/ }))
    await user.type(within(editForm).getByRole('textbox', { name: /Valor/ }), 'Sur')
    await user.click(within(editForm).getByRole('button', { name: 'Guardar campo' }))
    expect(
      await within(dialog).findByText('El campo «Ruta/turno» ahora se llama «Turno». Cambio guardado en Wialon.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Editar el campo Turno' })).toHaveFocus())

    // Change only the value: no new_key is sent.
    await user.click(within(dialog).getByRole('button', { name: 'Editar el campo Empresa' }))
    editForm = within(dialog).getByRole('form', { name: 'Editar el campo Empresa' })
    await user.clear(within(editForm).getByRole('textbox', { name: /Valor/ }))
    await user.type(within(editForm).getByRole('textbox', { name: /Valor/ }), 'Acme SAS')
    await user.click(within(editForm).getByRole('button', { name: 'Guardar campo' }))
    expect(await within(dialog).findByText('Campo «Empresa» guardado en Wialon.')).toBeInTheDocument()

    // Delete asks first; cancelling sends nothing.
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar el campo Silla' }))
    expect(within(dialog).getByText(/¿Eliminar el campo «Silla»\?/)).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    const writesBeforeDelete = writes(server.calls).length
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar el campo Silla' }))
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar campo' }))
    expect(
      await within(dialog).findByText('Campo «Silla» eliminado de Wialon. Los demás se conservaron.'),
    ).toBeInTheDocument()
    expect(writesBeforeDelete).toBe(3)

    expect(writes(server.calls).map((call) => [call.method, call.url, call.body])).toEqual([
      ['POST', FIELDS_PATH, { key: 'Silla', value: 'Sí' }],
      ['PUT', `${FIELDS_PATH}/Ruta%2Fturno`, { value: 'Sur', new_key: 'Turno' }],
      ['PUT', `${FIELDS_PATH}/Empresa`, { value: 'Acme SAS' }],
      ['DELETE', `${FIELDS_PATH}/Silla`, undefined],
    ])
    // Every other field survived each change.
    expect(server.fields()).toEqual([
      { key: 'Empresa', value: 'Acme SAS' },
      { key: 'Turno', value: 'Sur' },
      { key: '..', value: 'importado' },
    ])
    expect(within(dialog).getByRole('heading', { name: 'Campos actuales (3)' })).toHaveFocus()
  })

  it('keeps the edit open on failure and offers a retry only when it can help', async () => {
    let attempts = 0
    const server = mockServer({
      fail: (call) => {
        if (call.method !== 'PUT') return undefined
        attempts += 1
        if (attempts === 1) return problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no respondió.' })
        if (attempts === 2) return undefined // the retry goes through
        return problemResponse(409, 'conflict', {
          detail: 'Ya existe un campo personalizado con esa clave en este pasajero.',
        })
      },
    })
    renderPassengers()
    const user = userEvent.setup()
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: '2 campos personalizados de Ana Rojas' }))
    const dialog = screen.getByRole('dialog', { name: 'Campos personalizados de «Ana Rojas»' })

    await user.click(within(dialog).getByRole('button', { name: 'Editar el campo Empresa' }))
    const editForm = within(dialog).getByRole('form', { name: 'Editar el campo Empresa' })
    await user.clear(within(editForm).getByRole('textbox', { name: /Valor/ }))
    await user.type(within(editForm).getByRole('textbox', { name: /Valor/ }), 'Acme SAS')
    await user.click(within(editForm).getByRole('button', { name: 'Guardar campo' }))

    const alert = await within(editForm).findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo guardar el campo')
    expect(alert).toHaveTextContent('Wialon no respondió.')
    // The typed value is still there.
    expect(within(editForm).getByRole('textbox', { name: /Valor/ })).toHaveValue('Acme SAS')
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await within(dialog).findByText('Campo «Empresa» guardado en Wialon.')).toBeInTheDocument()
    expect(server.fields()[0]).toEqual({ key: 'Empresa', value: 'Acme SAS' })

    // A conflict would repeat: no retry button, the message explains it.
    await user.click(within(dialog).getByRole('button', { name: 'Editar el campo Empresa' }))
    const again = within(dialog).getByRole('form', { name: 'Editar el campo Empresa' })
    await user.clear(within(again).getByRole('textbox', { name: /Valor/ }))
    await user.type(within(again).getByRole('textbox', { name: /Valor/ }), 'Otra')
    await user.click(within(again).getByRole('button', { name: 'Guardar campo' }))
    const conflict = await within(again).findByRole('alert')
    expect(conflict).toHaveTextContent('Ya existe un campo personalizado con esa clave en este pasajero.')
    expect(within(conflict).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})

describe('PassengersPage — assignment and permissions', () => {
  it('explains an assignment conflict and unassigns after confirmation', async () => {
    const answers = [
      () => problemResponse(409, 'conflict', { detail: 'El pasajero ya está asignado a este vehículo.' }),
      () => jsonResponse({ ...ANA, vehicle: null }),
    ]
    const { calls } = mockServer({ write: () => answers.shift()!() })
    renderPassengers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Asignar vehículo a Beto Díaz' }))
    let dialog = screen.getByRole('dialog', { name: 'Asignar vehículo a «Beto Díaz»' })
    await within(dialog).findByRole('option', { name: 'Bus 03' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Vehículo/ }), '103')
    await user.click(within(dialog).getByRole('button', { name: 'Asignar vehículo' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El pasajero ya está asignado a este vehículo.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await user.click(screen.getByRole('button', { name: 'Más acciones para Ana Rojas' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Cambiar vehículo',
      'Desasignar',
      'Campos personalizados',
      'Eliminar',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Desasignar' }))
    dialog = screen.getByRole('dialog', { name: '¿Desasignar a «Ana Rojas»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Desasignar' }))
    expect(await screen.findByText('Pasajero desasignado')).toBeInTheDocument()

    expect(writes(calls).map((call) => [call.method, call.url, call.body])).toEqual([
      ['PUT', '/api/v1/passengers/10/2/assignment', { unit_id: 103 }],
      ['DELETE', '/api/v1/passengers/10/1/assignment', undefined],
    ])
  })

  it('gives a viewer read-only lists and custom fields', async () => {
    mockServer()
    renderPassengers(VIEWER_PERMISSIONS)
    const user = userEvent.setup()

    const table = await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Nuevo pasajero' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^(Editar|Eliminar|Asignar|Cambiar|Desasignar|Más acciones)/ }),
    ).not.toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Beto Díaz/ })).toHaveTextContent('Sin vehículo')
    expect(within(table).queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2 campos personalizados de Ana Rojas' }))
    const dialog = screen.getByRole('dialog', { name: 'Campos personalizados de «Ana Rojas»' })
    expect(within(dialog).getByText('Solo lectura: tu rol no permite editar campos.')).toBeInTheDocument()
    expect(within(dialog).getByText('Acme')).toBeInTheDocument()
    expect(within(dialog).queryByRole('form', { name: 'Agregar campo' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Editar el campo|Eliminar el campo/ })).not.toBeInTheDocument()
  })
})
