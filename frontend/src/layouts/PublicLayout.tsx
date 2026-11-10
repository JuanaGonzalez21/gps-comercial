import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { ArrowRightIcon, Brand, LinkButton } from '@/ui'
import './layouts.css'

const SECTIONS = [
  { href: '/#funcionalidades', label: 'Funcionalidades' },
  { href: '/#producto', label: 'Producto' },
  { href: '/#seguridad', label: 'Seguridad' },
] as const

/** Public pages: header with the access CTA, content and footer. No public sign-up. */
export default function PublicLayout() {
  const { status } = useAuth()
  const { pathname } = useLocation()
  const signedIn = status === 'authenticated'
  return (
    <div className="public-layout">
      <a className="skip-link" href="#main">
        Saltar al contenido principal
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <Brand to="/" />
          {/* Section links only on the landing; on small screens the hero link and the footer cover them. */}
          {pathname === '/' && (
            <nav aria-label="Secciones" className="public-header__nav">
              {SECTIONS.map((section) => (
                <a key={section.href} href={section.href}>
                  {section.label}
                </a>
              ))}
            </nav>
          )}
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
          <div className="public-footer__brand">
            <Brand to="/" tone="dark" />
            <p>Monitoreo de flotas sobre Wialon. Acceso solo para usuarios creados por un administrador.</p>
          </div>
          <nav aria-label="Pie de página" className="public-footer__nav">
            {SECTIONS.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
            <Link to={signedIn ? '/app/dashboard' : '/login'}>{signedIn ? 'Ir al panel' : 'Iniciar sesión'}</Link>
          </nav>
          <p className="public-footer__legal">
            © 2026 GPS Comercial · Mapas © colaboradores de OpenStreetMap
          </p>
        </div>
      </footer>
    </div>
  )
}
