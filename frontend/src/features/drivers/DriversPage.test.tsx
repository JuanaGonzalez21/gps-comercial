import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DriverOut, ResourceOut } from '@/api/types'
import { jsonResponse, mockFetch, problemResponse, type FetchCall } from '@/test/http'
import DriversPage from './DriversPage'
import {
  installDialogPolyfill,
  OPERATOR_PERMISSIONS,
  pageOf,
  renderWithApp,
  vehicleSummary,
  VIEWER_PERMISSIONS,
} from './shared/testing'

// Wialon is simulated: fetch answers with the backend contract (docs/api-contract.md).

const LUZ: DriverOut = {
  resource_id: 10,
  id: 1,
  name: 'Luz Gómez',
  code: 'C-01',
  phone: '+57 300 111 2233',
  description: 'Turno mañana',
  vehicle: { id: 101, name: 'Camión 01' },
}
const PEDRO: DriverOut = {
  resource_id: 10,
  id: 2,
  name: 'Pedro Ruiz',
  code: null,
  phone: null,
  description: null,
  vehicle: null,
}
const ZOE: DriverOut = { ...PEDRO, id: 3, name: 'Zoe Pardo' }
const VEHICLES = [
  vehicleSummary(101, 'Camión 01', 'Luz Gómez'),
  vehicleSummary(102, 'Van 02'),
  vehicleSummary(103, 'Bus 03'),
]
const ONE_RESOURCE: ResourceOut[] = [{ id: 10, name: 'Flota principal' }]

interface ApiOptions {
  drivers?: DriverOut[]
  total?: number
  resources?: ResourceOut[]
  /** Answers POST/PUT/DELETE; GETs are routed automatically. */
  write?: (call: FetchCall) => Response
}

function path(call: FetchCall): URL {
  return new URL(call.url, 'http://localhost')
}

function mockApi({ drivers = [LUZ, PEDRO], total, resources = ONE_RESOURCE, write }: ApiOptions = {}) {
  return mockFetch((call) => {
    const url = path(call)
    if (call.method === 'GET' && url.pathname === '/api/v1/resources') return jsonResponse(resources)
    if (call.method === 'GET' && url.pathname === '/api/v1/vehicles') {
      const search = url.searchParams.get('search')?.toLowerCase()
      const items = VEHICLES.filter((vehicle) => !search || vehicle.name.toLowerCase().includes(search))
      return jsonResponse(pageOf(items, items.length, 1, 100))
    }
    if (call.method === 'GET' && url.pathname === '/api/v1/drivers') {
      const page = Number(url.searchParams.get('page') ?? '1')
      return jsonResponse(page === 2 ? pageOf([ZOE], total ?? 21, 2) : pageOf(drivers, total ?? drivers.length))
    }
    return write ? write(call) : problemResponse(500, 'internal_error')
  })
}

function writes(calls: FetchCall[]): FetchCall[] {
  return calls.filter((call) => call.method !== 'GET')
}

function renderDrivers(permissions = OPERATOR_PERMISSIONS) {
  renderWithApp(<DriversPage />, '/app/drivers', permissions)
}

beforeAll(installDialogPolyfill)
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DriversPage — list', () => {
  it('lists drivers with their vehicle, states missing data and paginates on the server', async () => {
    const { calls } = mockApi({ total: 21 })
    renderDrivers()
    const user = userEvent.setup()

    const table = await screen.findByRole('table')
    const luzRow = within(table).getByRole('row', { name: /Luz Gómez/ })
    expect(within(luzRow).getByRole('link', { name: 'Camión 01' })).toHaveAttribute('href', '/app/vehicles/101')
    expect(within(luzRow).getByText('Turno mañana')).toBeInTheDocument()
    // Resource name, avatar initials and monospaced code, as in the design.
    expect(within(luzRow).getByText('Recurso: Flota principal')).toBeInTheDocument()
    const pedroRow = within(table).getByRole('row', { name: /Pedro Ruiz/ })
    // Without a vehicle, an operator gets the dashed "Asignar vehículo" button in the cell.
    expect(within(pedroRow).getByRole('button', { name: 'Asignar vehículo a Pedro Ruiz' })).toBeInTheDocument()
    expect(within(pedroRow).getAllByText('Sin dato')).toHaveLength(2)
    expect(screen.getByText('21 conductores')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Paginación de conductores' })).toHaveTextContent(
      'Mostrando 1–20 de 21 conductores',
    )

    await user.click(screen.getByRole('button', { name: 'Página 2' }))

    expect(await screen.findByRole('row', { name: /Zoe Pardo/ })).toBeInTheDocument()
    expect(calls.some((call) => call.url.startsWith('/api/v1/drivers?') && call.url.includes('page=2'))).toBe(true)
  })

  it('sends search, assignment filter and sort to the server and starts again at page 1', async () => {
    const { calls } = mockApi()
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar conductor' }), 'luz')
    const assignment = screen.getByRole('group', { name: 'Asignación' })
    await user.click(within(assignment).getByRole('button', { name: 'Con vehículo' }))
    expect(within(assignment).getByRole('button', { name: 'Con vehículo' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Nombre' }))

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.url.startsWith('/api/v1/drivers?') &&
            call.url.includes('search=luz') &&
            call.url.includes('assigned=true') &&
            call.url.includes('sort=-name') &&
            call.url.includes('page=1'),
        ),
      ).toBe(true),
    )
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'descending')
  })

  it('sorts by recently added from the "Ordenar por" select, also next to the table', async () => {
    const { calls } = mockApi()
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'Recién agregados')

    await waitFor(() =>
      expect(
        calls.some((call) => call.url.startsWith('/api/v1/drivers?') && call.url.includes('sort=-created')),
      ).toBe(true),
    )
    // The name column is no longer the sort key; clicking it goes back to A–Z.
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'none')
    await user.click(screen.getByRole('button', { name: 'Nombre' }))
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('name')
  })

  it('shows an error with retry when the list cannot be loaded', async () => {
    let fail = true
    mockFetch((call) => {
      const url = path(call)
      if (url.pathname === '/api/v1/resources') return jsonResponse(ONE_RESOURCE)
      return fail
        ? problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no está disponible.' })
        : jsonResponse(pageOf([LUZ]))
    })
    renderDrivers()
    const user = userEvent.setup()

    expect(await screen.findByText('No pudimos cargar los conductores')).toBeInTheDocument()
    expect(screen.getByText('Wialon no está disponible.')).toBeInTheDocument()

    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('row', { name: /Luz Gómez/ })).toBeInTheDocument()
  })

  it('guides the first creation when the account has no drivers', async () => {
    mockApi({ drivers: [], total: 0 })
    renderDrivers()
    const user = userEvent.setup()

    expect(await screen.findByText('Aún no hay conductores')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear el primer conductor' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo conductor' })).toBeInTheDocument()
  })

  it('uses cards instead of the table on small screens', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }))
    mockApi()
    renderDrivers()

    const card = await screen.findByRole('article', { name: 'Luz Gómez' })
    expect(within(card).getByText('Camión 01')).toBeInTheDocument()
    expect(
      within(screen.getByRole('article', { name: 'Pedro Ruiz' })).getByRole('button', {
        name: 'Asignar vehículo a Pedro Ruiz',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    // Cards have no sortable headers: the select carries every order.
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toBeInTheDocument()
  })
})

describe('DriversPage — create and edit', () => {
  it('validates on the client before calling the API', async () => {
    const { calls } = mockApi()
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    const name = within(dialog).getByRole('textbox', { name: /Nombre/ })
    expect(name).toHaveFocus()

    await user.type(within(dialog).getByRole('textbox', { name: /Teléfono/ }), 'abc')
    await user.type(within(dialog).getByRole('textbox', { name: /Código/ }), 'X'.repeat(31))
    await user.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription(/Ingresa el nombre\./)
    expect(within(dialog).getByRole('textbox', { name: /Teléfono/ })).toHaveAccessibleDescription(
      /Ingresa un teléfono válido/,
    )
    expect(within(dialog).getByRole('textbox', { name: /Código/ })).toHaveAccessibleDescription(
      /máximo 30 caracteres/,
    )
    expect(writes(calls)).toHaveLength(0)
  })

  it('maps server 422 errors and the 409 duplicate code onto the fields, then creates', async () => {
    const answers = [
      () =>
        problemResponse(422, 'validation_error', {
          detail: 'Revisa los campos marcados.',
          errors: [{ field: 'phone', message: 'El servidor rechazó este teléfono.' }],
        }),
      () =>
        problemResponse(409, 'conflict', {
          detail: 'Ya existe un conductor con el código «C-01» en este recurso.',
        }),
      () =>
        jsonResponse(
          { resource_id: 10, id: 9, name: 'Ana Torres', code: 'C-02', phone: '3001234567', description: null, vehicle: null },
          201,
        ),
    ]
    const { calls } = mockApi({ write: () => answers.shift()!() })
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    await user.type(within(dialog).getByRole('textbox', { name: /Nombre/ }), '  Ana Torres ')
    await user.type(within(dialog).getByRole('textbox', { name: /Código/ }), 'C-01')
    await user.type(within(dialog).getByRole('textbox', { name: /Teléfono/ }), '3001234567')
    await user.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    const phone = within(dialog).getByRole('textbox', { name: /Teléfono/ })
    await waitFor(() => expect(phone).toHaveAccessibleDescription(/El servidor rechazó este teléfono\./))
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Revisa los campos marcados.')
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/v1/drivers',
      body: { name: 'Ana Torres', code: 'C-01', phone: '3001234567', description: null },
    })
    expect(writes(calls)[0].body).not.toHaveProperty('resource_id')

    await user.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))
    const code = within(dialog).getByRole('textbox', { name: /Código/ })
    await waitFor(() => expect(code).toHaveAccessibleDescription(/Ya existe un conductor con el código «C-01»/))

    await user.clear(code)
    await user.type(code, 'C-02')
    await user.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    expect(await screen.findByText('Conductor creado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(writes(calls)).toHaveLength(3)
    // The list is read again from the server after the write.
    const listReads = calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/v1/drivers?'))
    expect(listReads.length).toBeGreaterThanOrEqual(2)
  })

  it('edits a driver sending every editable attribute (blank ones as null)', async () => {
    const { calls } = mockApi({
      write: (call) => jsonResponse({ ...LUZ, ...(call.body as object) }),
    })
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Editar a Luz Gómez' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar a «Luz Gómez»' })
    expect(within(dialog).getByRole('textbox', { name: /Código/ })).toHaveValue('C-01')
    await user.clear(within(dialog).getByRole('textbox', { name: /Descripción/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
    expect(writes(calls)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        url: '/api/v1/drivers/10/1',
        body: { name: 'Luz Gómez', code: 'C-01', phone: '+57 300 111 2233', description: null },
      }),
    ])
  })

  it('offers the resource when the account has several and sends the choice', async () => {
    const { calls } = mockApi({
      resources: [
        { id: 10, name: 'Flota principal' },
        { id: 20, name: 'Flota norte' },
      ],
      write: () => jsonResponse({ ...PEDRO, id: 50, resource_id: 20, name: 'Ana' }, 201),
    })
    renderDrivers()
    const user = userEvent.setup()
    // With several resources the list says where each driver lives.
    expect((await screen.findAllByText('Recurso: Flota principal')).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Nuevo conductor' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo conductor' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Recurso de Wialon/ }), '20')
    await user.type(within(dialog).getByRole('textbox', { name: /Nombre/ }), 'Ana')
    await user.click(within(dialog).getByRole('button', { name: 'Crear conductor' }))

    await screen.findByText('Conductor creado')
    expect(writes(calls)[0].body).toMatchObject({ resource_id: 20, name: 'Ana' })
  })
})

describe('DriversPage — delete and assignment', () => {
  it('asks for confirmation before deleting and keeps the dialog open on failure', async () => {
    const answers = [
      () => problemResponse(503, 'upstream_unavailable', { detail: 'Wialon no respondió.' }),
      () => new Response(null, { status: 204 }),
    ]
    const { calls } = mockApi({ write: () => answers.shift()!() })
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    // Without a vehicle the "⋮" menu only offers deleting.
    await user.click(screen.getByRole('button', { name: 'Más acciones para Pedro Ruiz' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Eliminar'])
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    let dialog = screen.getByRole('dialog', { name: '¿Eliminar a «Pedro Ruiz»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(writes(calls)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Más acciones para Pedro Ruiz' }))
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    dialog = screen.getByRole('dialog', { name: '¿Eliminar a «Pedro Ruiz»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar conductor' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wialon no respondió.')

    await user.click(within(dialog).getByRole('button', { name: 'Eliminar conductor' }))
    expect(await screen.findByText('Conductor eliminado')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The button that opened the dialog belonged to the deleted row: focus goes to the list.
    expect(screen.getByRole('heading', { name: 'Lista de conductores' })).toHaveFocus()
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'DELETE /api/v1/drivers/10/2',
      'DELETE /api/v1/drivers/10/2',
    ])
  })

  it('assigns a searched vehicle and explains a 409 conflict clearly', async () => {
    const answers = [
      () => problemResponse(409, 'conflict', { detail: 'El conductor ya está asignado a este vehículo.' }),
      () => jsonResponse({ ...PEDRO, vehicle: { id: 102, name: 'Van 02' } }),
    ]
    const { calls } = mockApi({ write: () => answers.shift()!() })
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Asignar vehículo a Pedro Ruiz' }))
    const dialog = screen.getByRole('dialog', { name: 'Asignar vehículo a «Pedro Ruiz»' })
    expect(within(dialog).getByRole('searchbox', { name: 'Buscar vehículo' })).toHaveFocus()
    const select = within(dialog).getByRole('combobox', { name: /Vehículo/ })
    // The vehicle's current driver is shown as context.
    await within(dialog).findByRole('option', { name: 'Camión 01 (conductor: Luz Gómez)' })

    await user.click(within(dialog).getByRole('button', { name: 'Asignar vehículo' }))
    expect(select).toHaveAccessibleDescription(/Elige un vehículo de la lista\./)
    expect(writes(calls)).toHaveLength(0)

    await user.type(within(dialog).getByRole('searchbox', { name: 'Buscar vehículo' }), 'van')
    await waitFor(() => expect(within(dialog).queryByRole('option', { name: /Bus 03/ })).not.toBeInTheDocument())
    await user.selectOptions(select, '102')
    await user.click(within(dialog).getByRole('button', { name: 'Asignar vehículo' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'El conductor ya está asignado a este vehículo. Actualizamos la lista con los datos de Wialon.',
    )
    expect(writes(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/v1/drivers/10/2/assignment',
      body: { unit_id: 102 },
    })

    await user.click(within(dialog).getByRole('button', { name: 'Asignar vehículo' }))
    expect(await screen.findByText('Vehículo asignado')).toBeInTheDocument()
    expect(screen.getByText('Se asignó «Van 02» a «Pedro Ruiz».')).toBeInTheDocument()
  })

  it('reports a missing vehicle (404) and unassigns after confirmation', async () => {
    const answers = [
      () => problemResponse(404, 'not_found', { detail: 'El vehículo no existe o no es accesible.' }),
      () => jsonResponse({ ...LUZ, vehicle: null }),
    ]
    const { calls } = mockApi({ write: () => answers.shift()!() })
    renderDrivers()
    const user = userEvent.setup()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Más acciones para Luz Gómez' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Cambiar vehículo',
      'Desvincular',
      'Eliminar',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Cambiar vehículo' }))
    let dialog = screen.getByRole('dialog', { name: 'Cambiar el vehículo de «Luz Gómez»' })
    expect(dialog).toHaveTextContent('Vehículo actual: Camión 01')
    // The current vehicle is not offered again.
    await within(dialog).findByRole('option', { name: 'Van 02' })
    expect(within(dialog).queryByRole('option', { name: /Camión 01/ })).not.toBeInTheDocument()
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Vehículo/ }), '103')
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar vehículo' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El vehículo no existe o no es accesible.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await user.click(screen.getByRole('button', { name: 'Más acciones para Luz Gómez' }))
    await user.click(screen.getByRole('menuitem', { name: 'Desvincular' }))
    dialog = screen.getByRole('dialog', { name: '¿Desvincular a «Luz Gómez»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }))

    expect(await screen.findByText('Conductor desvinculado')).toBeInTheDocument()
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'PUT /api/v1/drivers/10/1/assignment',
      'DELETE /api/v1/drivers/10/1/assignment',
    ])
  })
})

describe('DriversPage — permissions', () => {
  it('gives a viewer the list without any write action', async () => {
    mockApi()
    renderDrivers(VIEWER_PERMISSIONS)

    const table = await screen.findByRole('table')
    expect(within(table).getByRole('row', { name: /Luz Gómez/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo conductor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^(Editar|Eliminar|Asignar|Cambiar|Desvincular|Más acciones)/ }),
    ).not.toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Pedro Ruiz/ })).toHaveTextContent('Sin vehículo')
    expect(within(table).queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
  })

  it('tells a viewer where drivers come from when there are none', async () => {
    mockApi({ drivers: [], total: 0 })
    renderDrivers(VIEWER_PERMISSIONS)

    expect(await screen.findByText('Cuando se registren conductores en Wialon, aparecerán aquí.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear el primer conductor' })).not.toBeInTheDocument()
  })

  it('shows export and create actions to an operator', async () => {
    mockApi()
    renderDrivers()
    await screen.findByRole('table')

    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo conductor' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Acciones de Luz Gómez' })).toBeInTheDocument()
  })
})
