import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { ArrowRightIcon, Brand, CloseIcon, LinkButton, MenuIcon } from '@/ui'
import './layouts.css'

const SECTIONS = [
  { href: '/#funcionalidades', label: 'Funcionalidades' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/#control-de-acceso', label: 'Control de acceso' },
] as const

/** Public pages: header with the access CTA, content and footer. No public sign-up. */
export default function PublicLayout() {
  const { status } = useAuth()
  const { pathname, hash } = useLocation()
  const signedIn = status === 'authenticated'
  const onLanding = pathname === '/'
  // The mobile menu belongs to the location where it was opened, so any navigation closes it.
  const here = `${pathname}${hash}`
  const [openAt, setOpenAt] = useState<string | null>(null)
  const menuOpen = openAt === here
  const setMenuOpen = (open: boolean) => setOpenAt(open ? here : null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenAt(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="public-layout">
      <a className="skip-link" href="#main">
        Saltar al contenido principal
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <Brand to="/" />
          {onLanding && (
            <nav id="public-sections" aria-label="Secciones" className="public-header__nav" data-open={menuOpen || undefined}>
              {SECTIONS.map((section) => (
                <a key={section.href} href={section.href} onClick={() => setMenuOpen(false)}>
                  {section.label}
                </a>
              ))}
            </nav>
          )}
          <div className="public-header__end">
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
            {onLanding && (
              <button
                type="button"
                className="public-header__toggle"
                aria-expanded={menuOpen}
                aria-controls="public-sections"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <CloseIcon aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
                <span className="visually-hidden">{menuOpen ? 'Cerrar menú de secciones' : 'Abrir menú de secciones'}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="public-footer__inner">
          <div className="public-footer__brand">
            <Brand to="/" tone="dark" />
            <p>Gestión y monitoreo de flotas sobre Wialon. Acceso solo para usuarios creados por un administrador.</p>
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
            © 2026 GPS Comercial · Mapas © colaboradores de OpenStreetMap · Fotografías ilustrativas
          </p>
        </div>
      </footer>
    </div>
  )
}
