import { defineConfig } from '@playwright/test'

// End-to-end smoke tests against the running app (Vite on :5173 proxying the real backend).
// Uses the locally installed Google Chrome; no browser download. Credentials only via env vars:
//   E2E_EMAIL, E2E_PASSWORD (never commit them).
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results/artifacts',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    viewport: { width: 1366, height: 860 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
})
