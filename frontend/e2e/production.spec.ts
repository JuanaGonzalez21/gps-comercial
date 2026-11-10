import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Read-only checks against the deployed app (no Wialon writes, no data created).
// Credentials only through environment variables typed in the operator's own terminal:
//   E2E_PRODUCTION=1 E2E_BASE_URL=https://gpscomercial.juanagonzalez.dev E2E_EMAIL=… E2E_PASSWORD=…
// Optional role check with an existing Visualizador: E2E_VIEWER_EMAIL / E2E_VIEWER_PASSWORD.
const admin = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' }
const viewer = { email: process.env.E2E_VIEWER_EMAIL ?? '', password: process.env.E2E_VIEWER_PASSWORD ?? '' }

test.skip(!process.env.E2E_PRODUCTION || !admin.email || !admin.password, 'Solo bajo demanda (E2E_PRODUCTION=1)')
test.describe.configure({ mode: 'serial' })
test.setTimeout(240_000) // the first request may wake the free backend (~1 min)

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(user.email)
  await page.getByRole('textbox', { name: /^Contraseña/ }).fill(user.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/app/**', { timeout: 180_000 })
}

async function csrf(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === 'gc_csrf')?.value ?? ''
}

test('Admin: sesión con cookies seguras, CSRF, datos reales, rutas directas y logout', async ({ page, context }) => {
  await login(page, admin)
  const host = new URL(page.url()).hostname
  const cookies = Object.fromEntries((await context.cookies()).map((cookie) => [cookie.name, cookie]))
  for (const name of ['gc_access', 'gc_refresh']) {
    expect(cookies[name], name).toBeDefined()
    expect(cookies[name].httpOnly, `${name} HttpOnly`).toBe(true)
    expect(cookies[name].secure, `${name} Secure`).toBe(true)
    expect(cookies[name].sameSite, `${name} SameSite`).toBe('Lax')
    expect(cookies[name].domain.replace(/^\./, ''), `${name} first-party`).toBe(host)
  }
  expect(cookies.gc_csrf.httpOnly).toBe(false)
  expect(cookies.gc_refresh.path).toBe('/api/v1/auth')

  const me = await page.request.get('/api/v1/auth/me')
  expect(me.status()).toBe(200)
  expect((await me.json()).role.code).toBe('admin')

  const withoutToken = await page.request.post('/api/v1/auth/refresh')
  expect(withoutToken.status()).toBe(403)
  expect((await withoutToken.json()).code).toBe('csrf_failed')
  const refreshed = await page.request.post('/api/v1/auth/refresh', { headers: { 'X-CSRF-Token': await csrf(context) } })
  expect(refreshed.status()).toBe(200)

  const vehicles = await page.request.get('/api/v1/vehicles', { params: { page_size: 5 } })
  expect((await vehicles.json()).total).toBeGreaterThan(0)
  const positions = await page.request.get('/api/v1/vehicles/positions')
  expect((await positions.json()).items.length).toBeGreaterThan(0)
  const system = await page.request.get('/api/v1/system/info')
  expect(await system.json()).toMatchObject({ fleet_source: 'wialon', environment: 'production' })

  // Deep link + reload keeps the session (cookies, not storage).
  await page.goto('/app/vehicles')
  await page.reload()
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 60_000 })
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toMatch(/eyJ|gc_/)

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL('**/login**')
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401)
})

test('Visualizador existente: solo lectura (opcional)', async ({ page, context }) => {
  test.skip(!viewer.email || !viewer.password, 'Define E2E_VIEWER_EMAIL y E2E_VIEWER_PASSWORD para comprobar el rol')
  await login(page, viewer)
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(nav.getByRole('link', { name: 'Vehículos' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
  const headers = { 'X-CSRF-Token': await csrf(context) }
  expect((await page.request.get('/api/v1/users')).status()).toBe(403)
  expect((await page.request.get('/api/v1/exports/vehicles.csv')).status()).toBe(403)
  expect((await page.request.post('/api/v1/drivers', { headers, data: { name: 'ZZ-PRUEBA no' } })).status()).toBe(403)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
})
