import { useEffect, useState } from 'react'
import { API_BASE_URL } from './config'

type ApiStatus = 'checking' | 'ok' | 'unreachable'

const STATUS_TEXT: Record<ApiStatus, string> = {
  checking: 'Comprobando el servidor…',
  ok: 'Servidor disponible',
  unreachable: 'No se pudo contactar el servidor',
}

// Temporary bootstrap screen: confirms the frontend reaches the backend /health endpoint.
// It will be replaced by the landing page and the router.
export default function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then((response) => setStatus(response.ok ? 'ok' : 'unreachable'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setStatus('unreachable')
        }
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="bootstrap">
      <h1>GPS Comercial</h1>
      <p>Plataforma de monitoreo de flotas. Base del proyecto en construcción.</p>
      <p className={`status status--${status}`} role="status">
        {STATUS_TEXT[status]}
      </p>
    </main>
  )
}
