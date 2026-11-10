import { expect, test } from '@playwright/test'

const email = process.env.E2E_EMAIL ?? ''
const password = process.env.E2E_PASSWORD ?? ''
const shots = 'e2e-results/screens'

test.skip(!email || !password, 'Define E2E_EMAIL y E2E_PASSWORD para ejecutar el flujo real')

test('login → vehículos en lista y mapa → selección sincronizada → logout', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.screenshot({ path: `${shots}/01-landing.png`, fullPage: true })

  await page.goto('/login')
  await page.getByRole('textbox', { name: /^Correo electrónico/ }).fill(email)
  await page.getByRole('textbox', { name: /^Contraseña/ }).fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/app/**')

  await page.goto('/app/vehicles')
  const rows = page.locator('table tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 45_000 })
  await page.screenshot({ path: `${shots}/02-vehiculos.png` })

  // First vehicle that has a position (rows without one say "Sin posición en el mapa").
  const header = page.getByRole('rowheader').filter({ hasNotText: 'Sin posición' }).first()
  const button = header.getByRole('button')
  const name = (await button.innerText()).trim()
  await button.click()
  await expect(page.locator('.leaflet-popup')).toContainText(name, { timeout: 15_000 })
  await page.screenshot({ path: `${shots}/03-seleccion.png` })

  await page.setViewportSize({ width: 360, height: 780 })
  await page.screenshot({ path: `${shots}/04-movil.png`, fullPage: true })
  await page.setViewportSize({ width: 1366, height: 860 })

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL('**/login**')
  await page.goto('/app/vehicles')
  await page.waitForURL('**/login**')
})
