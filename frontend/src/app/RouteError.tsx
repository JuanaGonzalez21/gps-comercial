import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useDocumentTitle } from '@/lib/hooks'
import { AlertCircleIcon, Button } from '@/ui'
import { NotFound } from './NotFound'
import './app.css'

// After a new deployment, old lazy chunks disappear: the fix for the user is a reload.
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

/**
 * Router error boundary: no blank screen and no stack trace for the user (ARQ-12).
 * `embedded` = rendered inside AppShell, which already provides the main landmark.
 */
export function RouteError({ embedded = false }: { embedded?: boolean }) {
  const error = useRouteError()
  useDocumentTitle('Error')
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />

  const chunkFailed = error instanceof Error && CHUNK_ERROR.test(error.message)
  const content = (
    <div className="state-block state-block--error" role="alert">
      <div className="state-block__icon">
        <AlertCircleIcon />
      </div>
      <h1 className="state-block__title">
        {chunkFailed ? 'Hay una versión nueva de la aplicación' : 'Algo salió mal'}
      </h1>
      <p className="state-block__text">
        {chunkFailed
          ? 'Recarga la página para cargar la versión más reciente.'
          : 'Ocurrió un error inesperado al mostrar esta página. Recarga la página o vuelve al inicio.'}
      </p>
      <div className="state-block__action">
        <Button onClick={() => window.location.reload()}>Recargar página</Button>
        <a className="btn btn--ghost btn--md" href="/">
          Ir al inicio
        </a>
      </div>
    </div>
  )
  if (embedded) return content
  return (
    <main id="main" className="route-error">
      {content}
    </main>
  )
}
