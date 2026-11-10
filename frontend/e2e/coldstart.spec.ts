import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// DEP-04 evidence: open the public landing after >15 min of inactivity (Render Free spins down) and
// record whether the "server starting" notice appears and how long the API takes to answer.
// Anonymous and read-only. Run with E2E_COLDSTART=1 and E2E_BASE_URL=<public URL>.
test.skip(!process.env.E2E_COLDSTART, 'Solo bajo demanda (E2E_COLDSTART=1)')
test.setTimeout(240_000)

test('arranque en frío: aviso visible y API disponible', async ({ page }) => {
  const started = Date.now()
  let healthMs: number | null = null
  page.on('response', (response) => {
    if (response.url().endsWith('/health') && response.status() === 200 && healthMs === null) {
      healthMs = Date.now() - started
    }
  })
  await page.goto('/')
  const banner = page.getByText(/Iniciando el servidor/)
  const bannerSeen = await banner
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false)
  if (bannerSeen) await page.screenshot({ path: 'e2e-results/coldstart-aviso.png' })
  await expect.poll(() => healthMs, { timeout: 180_000, intervals: [1000] }).not.toBeNull()
  await expect(banner).toHaveCount(0, { timeout: 30_000 })
  const summary = { at: new Date(started).toISOString(), bannerSeen, healthMs }
  writeFileSync('e2e-results/coldstart.json', JSON.stringify(summary, null, 2))
  console.log('COLDSTART', JSON.stringify(summary))
})
