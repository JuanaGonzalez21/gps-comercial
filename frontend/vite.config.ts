/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The browser only talks to the Vite origin; Vite forwards API calls to the backend.
  // Same origin => auth cookies are first-party (production does the same with a host rewrite).
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000'
  const proxy = {
    '/api': { target: proxyTarget },
    '/health': { target: proxyTarget },
  }

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
