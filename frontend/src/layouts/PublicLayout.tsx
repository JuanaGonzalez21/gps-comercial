import { Outlet } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { ArrowRightIcon, Brand, LinkButton } from '@/ui'
import './layouts.css'

/** Public pages: header with the access CTA, content and footer. No public sign-up. */
export default function PublicLayout() {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  return (
    <div className="public-layout">
      <a className="skip-link" href="#main">
        Saltar al contenido principal
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <Brand to="/" />
          {/* RF-03: a signed-in user gets a shortcut to the panel instead of the login button. */}
          {signedIn ? (
            <LinkButton to="/app/dashboard" size="sm" icon={<ArrowRightIcon />}>
              Ir al panel
            </LinkButton>
          ) : (
            <LinkButton to="/login" size="sm">
              Iniciar sesión
            </LinkButton>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="public-footer__inner">
          <p>© 2026 GPS Comercial. Plataforma de monitoreo de flotas.</p>
          <p>Acceso solo para usuarios creados por un administrador.</p>
        </div>
      </footer>
    </div>
  )
}
