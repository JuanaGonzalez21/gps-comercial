import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { LinkButton, MapIcon } from '@/ui'

/** Rendered inside a layout that already provides the main landmark. */
export function NotFound() {
  useDocumentTitle('Página no encontrada')
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  return (
    <div className="state-block">
      <div className="state-block__icon">
        <MapIcon />
      </div>
      <h1 className="state-block__title">Página no encontrada</h1>
      <p className="state-block__text">
        La dirección que abriste no existe o cambió. Revisa el enlace o vuelve a una sección conocida.
      </p>
      <div className="state-block__action">
        <LinkButton to={signedIn ? '/app/dashboard' : '/'} variant="secondary">
          {signedIn ? 'Ir al panel' : 'Ir al inicio'}
        </LinkButton>
      </div>
    </div>
  )
}
