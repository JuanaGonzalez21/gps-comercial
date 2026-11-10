import { expect, test, type Page } from '@playwright/test'

// Public README screenshots with real data, masking identifiers and precise locations.
// Read-only: it never writes to Wialon or to the database. Run with E2E_SCREENSHOTS=1.
const email = process.env.E2E_EMAIL ?? ''
const password = process.env.E2E_PASSWORD ?? ''
const out = 'e2e-results/readme'

test.skip(!process.env.E2E_SCREENSHOTS || !email || !password, 'Solo bajo demanda (E2E_SCREENSHOTS=1)')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(email)
  await page.getByRole('textbox', { name: /^Contraseña/ }).fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/app/**')
}

test('capturas públicas con datos enmascarados', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.screenshot({ path: `${out}/landing.png` })
  await page.setViewportSize({ width: 360, height: 780 })
  await page.screenshot({ path: `${out}/landing-movil.png`, fullPage: true })
  await page.setViewportSize({ width: 1366, height: 860 })

  await login(page)
  await page.goto('/app/dashboard')
  await expect(page.getByText('Sin conductor', { exact: true }).first()).toBeVisible({ timeout: 45_000 })
  await page.screenshot({ path: `${out}/dashboard.png` })
  await page.setViewportSize({ width: 360, height: 780 })
  await page.screenshot({ path: `${out}/dashboard-movil.png`, fullPage: true })
  await page.setViewportSize({ width: 1366, height: 860 })

  // Vehicle names (some are device IMEIs) and driver names are masked; the map stays zoomed out.
  await page.goto('/app/vehicles')
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 45_000 })
  await page.waitForTimeout(1500) // let tiles settle
  await page.screenshot({
    path: `${out}/vehiculos-mapa.png`,
    mask: [page.getByRole('rowheader'), page.locator('table tbody td:nth-child(3)')],
  })

  // History: stats, playback and speed chart are shown; vehicle identity and the route map are masked.
  const vehicles = await page.request.get('/api/v1/vehicles', { params: { status: 'stopped', page_size: 1 } })
  const vehicleId = (await vehicles.json()).items[0]?.id
  await page.goto(`/app/history?vehicle=${vehicleId}`)
  await page.getByRole('button', { name: /Últimas 24 h/ }).click()
  await page.getByRole('button', { name: /Ver recorrido/ }).click()
  await expect(page.getByText(/Distancia|No hay posiciones|No hay recorrido/).first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: `${out}/historial.png`,
    fullPage: true,
    mask: [
      page.getByRole('combobox', { name: /^Vehículo/ }),
      page.getByRole('heading', { name: /^Recorrido de/ }),
      page.locator('.leaflet-container'),
    ],
  })
})
