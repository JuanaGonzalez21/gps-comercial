import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

// Real end-to-end flows against the running backend and the REAL Wialon account.
// Writes only touch our own test data (prefix ZZ-PRUEBA-GPS-COMERCIAL) and are cleaned up.
const email = process.env.E2E_EMAIL ?? ''
const password = process.env.E2E_PASSWORD ?? ''
const PREFIX = 'ZZ-PRUEBA-GPS-COMERCIAL'
const stamp = Date.now().toString(36)
const shots = 'e2e-results/screens'

test.skip(!email || !password, 'Define E2E_EMAIL y E2E_PASSWORD para ejecutar los flujos reales')
test.describe.configure({ mode: 'serial' })

async function login(page: Page, user = email, secret = password) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(user)
  await page.getByRole('textbox', { name: /^Contraseña/ }).fill(secret)
  await page.locator('button[type="submit"]').click()
}

async function csrfHeaders(context: BrowserContext) {
  const token = (await context.cookies()).find((cookie) => cookie.name === 'gc_csrf')?.value ?? ''
  return { 'X-CSRF-Token': token }
}

async function cleanupTestData(request: APIRequestContext, context: BrowserContext) {
  const headers = await csrfHeaders(context)
  for (const entity of ['drivers', 'passengers'] as const) {
    const list = await request.get(`/api/v1/${entity}`, { params: { search: PREFIX, page_size: 100 } })
    if (!list.ok()) continue
    for (const item of (await list.json()).items as { resource_id: number; id: number; name: string }[]) {
      if (item.name.startsWith(PREFIX)) await request.delete(`/api/v1/${entity}/${item.resource_id}/${item.id}`, { headers })
    }
  }
}

test('Admin: dashboard, CSV e historial con datos reales', async ({ page }) => {
  await login(page)
  await page.waitForURL('**/app/**')
  await page.goto('/app/dashboard')
  await expect(page.getByText('Sin conductor', { exact: true }).first()).toBeVisible({ timeout: 45_000 })
  await page.screenshot({ path: `${shots}/05-dashboard.png`, fullPage: true })

  await page.goto('/app/vehicles')
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 45_000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.csv$/)

  const moving = await page.request.get('/api/v1/vehicles', { params: { status: 'stopped', page_size: 1 } })
  const vehicleId = (await moving.json()).items[0]?.id
  await page.goto(`/app/history?vehicle=${vehicleId}`)
  await page.getByRole('button', { name: /Últimas 24 h/ }).click()
  await page.getByRole('button', { name: /Ver recorrido|Consultar|Cargar/ }).first().click()
  await expect(
    page.getByText(/No hay posiciones|Distancia|Sin recorrido|puntos/i).first(),
  ).toBeVisible({ timeout: 60_000 })
  await page.screenshot({ path: `${shots}/06-historial.png`, fullPage: true })
})

test('Admin: CRUD de conductor de prueba reflejado en Wialon', async ({ page, context }) => {
  await login(page)
  await page.waitForURL('**/app/**')
  const name = `${PREFIX} e2e ${stamp}`
  try {
    await page.goto('/app/drivers')
    await page.getByRole('button', { name: 'Nuevo conductor' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /^Nombre/ }).fill(name)
    await dialog.getByRole('textbox', { name: /^Código/ }).fill(`ZZE2E${stamp}`.slice(0, 30))
    await dialog.getByRole('textbox', { name: /^Teléfono/ }).fill('+573000000000')
    await dialog.getByRole('button', { name: 'Crear conductor' }).click()
    await expect(dialog).toBeHidden({ timeout: 30_000 })

    // The API reads Wialon again: the driver exists remotely.
    const created = await page.request.get('/api/v1/drivers', { params: { search: name } })
    expect((await created.json()).items.map((d: { name: string }) => d.name)).toContain(name)

    await page.getByRole('searchbox').or(page.getByRole('textbox', { name: /Buscar/ })).first().fill(name)
    await page.getByRole('button', { name: `Editar a ${name}` }).first().click()
    await page.getByRole('dialog').getByRole('textbox', { name: /^Nombre/ }).fill(`${name} editado`)
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30_000 })
    const edited = await page.request.get('/api/v1/drivers', { params: { search: `${name} editado` } })
    expect((await edited.json()).total).toBe(1)
    await page.screenshot({ path: `${shots}/07-conductores.png` })

    // Row actions live in the "⋮" menu since the redesign.
    await page.getByRole('button', { name: `Más acciones para ${name} editado` }).first().click()
    await page.getByRole('menuitem', { name: 'Eliminar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar conductor' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30_000 })
    const gone = await page.request.get('/api/v1/drivers', { params: { search: name } })
    expect((await gone.json()).total).toBe(0)
  } finally {
    await cleanupTestData(page.request, context)
  }
})

test('Admin: campo personalizado de vehículo creado, editado y borrado en Wialon', async ({ page }) => {
  await login(page)
  await page.waitForURL('**/app/**')
  const list = await page.request.get('/api/v1/vehicles', { params: { page_size: 1, sort: 'name' } })
  const vehicle = (await list.json()).items[0] as { id: number }
  const before = await page.request.get(`/api/v1/vehicles/${vehicle.id}/custom-fields`)
  const original = JSON.stringify(await before.json())
  const fieldName = `${PREFIX} ${stamp}`.slice(0, 50)

  await page.goto(`/app/vehicles/${vehicle.id}`)
  await page.getByRole('button', { name: /Agregar campo|Nuevo campo/ }).first().click()
  const form = page.getByRole('form', { name: 'Agregar campo personalizado' })
  await form.getByRole('textbox', { name: /^Nombre/ }).fill(fieldName)
  await form.getByRole('textbox', { name: /^Valor/ }).fill('uno')
  await form.getByRole('button', { name: 'Agregar campo' }).click()
  await expect(page.getByText(fieldName).first()).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${shots}/08-campos.png`, fullPage: true })

  try {
    await page.getByRole('button', { name: `Editar el campo ${fieldName}` }).click()
    await page.getByRole('textbox', { name: /^Valor/ }).first().fill('dos')
    await page.getByRole('button', { name: /Guardar/ }).first().click()
    await expect.poll(async () => {
      const fields = (await (await page.request.get(`/api/v1/vehicles/${vehicle.id}/custom-fields`)).json()) as { name: string; value: string }[]
      return fields.find((f) => f.name === fieldName)?.value
    }, { timeout: 30_000 }).toBe('dos')

    await page.getByRole('button', { name: `Eliminar el campo ${fieldName}` }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Eliminar/ }).click()
  } finally {
    // Whatever happened in the UI, the vehicle must end exactly as it started.
    const fields = (await (await page.request.get(`/api/v1/vehicles/${vehicle.id}/custom-fields`)).json()) as { id: number; name: string }[]
    const headers = await csrfHeaders(page.context())
    for (const field of fields.filter((f) => f.name === fieldName)) {
      await page.request.delete(`/api/v1/vehicles/${vehicle.id}/custom-fields/${field.id}`, { headers })
    }
  }
  await expect.poll(async () => JSON.stringify(await (await page.request.get(`/api/v1/vehicles/${vehicle.id}/custom-fields`)).json()), { timeout: 30_000 }).toBe(original)
})

test('Visualizador: solo lectura en la interfaz y 403 en la API', async ({ page, browser }) => {
  await login(page)
  await page.waitForURL('**/app/**')
  const headers = await csrfHeaders(page.context())
  const viewerEmail = `zz-prueba-viewer-${stamp}@example.com`
  const created = await page.request.post('/api/v1/users', {
    headers,
    data: { email: viewerEmail, full_name: `${PREFIX} visualizador`, role: 'viewer' },
  })
  expect(created.status()).toBe(201)
  const { user, temporary_password: temporary } = await created.json()
  const viewerContext = await browser.newContext()
  const viewer = await viewerContext.newPage()
  try {
    await login(viewer, viewerEmail, temporary)
    await viewer.waitForURL('**/change-password**')
    const newPassword = `Visor-${stamp}-Seguro!9`
    await viewer.getByRole('textbox', { name: /^Contraseña actual/ }).fill(temporary)
    await viewer.getByRole('textbox', { name: /^Nueva contraseña/ }).fill(newPassword)
    await viewer.getByRole('textbox', { name: /^Confirma|^Repite|^Confirmar/ }).fill(newPassword)
    await viewer.locator('button[type="submit"]').click()
    await viewer.waitForURL('**/app/**')

    const nav = viewer.getByRole('navigation', { name: 'Navegación principal' })
    await expect(nav.getByRole('link', { name: 'Vehículos' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Auditoría' })).toHaveCount(0)
    await viewer.goto('/app/drivers')
    await expect(viewer.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Nuevo conductor' })).toHaveCount(0)
    await viewer.goto('/app/vehicles')
    await expect(viewer.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0)
    await viewer.screenshot({ path: `${shots}/09-visualizador.png` })

    const viewerHeaders = await csrfHeaders(viewerContext)
    const write = await viewer.request.post('/api/v1/drivers', { headers: viewerHeaders, data: { name: `${PREFIX} no` } })
    expect(write.status()).toBe(403)
    const exportCsv = await viewer.request.get('/api/v1/exports/vehicles.csv')
    expect(exportCsv.status()).toBe(403)
    await viewer.goto('/app/users')
    await expect(viewer.getByText(/Acceso denegado|No tienes permiso/).first()).toBeVisible()
  } finally {
    await viewerContext.close()
    // Users cannot be deleted (audit trail); the test user is deactivated instead.
    await page.request.patch(`/api/v1/users/${user.id}`, { headers, data: { is_active: false } })
  }
})
