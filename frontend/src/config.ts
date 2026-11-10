// Every VITE_* variable ends up in the public bundle: never put secrets here.
// Empty (recommended) = same origin: Vite's dev proxy locally, the host rewrite in production.
const rawApiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? ''

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '')
