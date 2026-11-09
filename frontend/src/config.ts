// Every VITE_* variable ends up in the public bundle: never put secrets here.
const rawApiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL

if (!rawApiBaseUrl) {
  throw new Error('Falta VITE_API_BASE_URL. Copia frontend/.env.example a frontend/.env.local.')
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '')
