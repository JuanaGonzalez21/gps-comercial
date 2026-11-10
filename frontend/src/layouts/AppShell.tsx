import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useNavigationCounts } from '@/api/dashboard'
import { getErrorMessage } from '@/api/errors'
import type { Me } from '@/api/types'
import { FleetSourceBanner } from '@/app/FleetSourceBanner'
import { useAuth } from '@/auth/useAuth'
import { Avatar, Brand, CloseIcon, KeyIcon, LogoutIcon, MenuIcon, Spinner, useToast } from '@/ui'
import { NAV_ITEMS, type NavItem } from './navigation'
import '@/styles/panel-theme.css'
import './app-shell.css'

const DRAWER_ID = 'app-navigation-drawer'

type NavCounts = Partial<Record<NavItem['to'], number>>

function Navigation({ items, counts }: { items: readonly NavItem[]; counts: NavCounts }) {
  return (
    <nav className="app-nav" aria-label="Navegación principal">
      <p className="app-nav__heading" aria-hidden="true">
        Menú
      </p>
      <ul role="list" className="app-nav__list">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            {/* NavLink sets aria-current="page" on the active item (also on /app/vehicles/:id). */}
            <NavLink to={to} className="app-nav__link">
              <Icon className="app-nav__icon" />
              <span className="app-nav__label">{label}</span>
              {counts[to] !== undefined && (
                // The count is a visual extra: the destination page states the same total.
                <span className="app-nav__count" aria-hidden="true">
                  {counts[to]}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function UserPanel({
  user,
  onLogout,
  loggingOut,
}: {
  user: Me
  onLogout: () => void
  loggingOut: boolean
}) {
  return (
    <div className="user-panel">
      <div className="user-panel__identity" title={`${user.full_name} · ${user.role.name}`}>
        <Avatar name={user.full_name} tone="dark" size="md" />
        <div className="user-panel__text">
          <p className="user-panel__name">{user.full_name}</p>
          <p className="user-panel__role">{user.role.name}</p>
        </div>
      </div>
      {/* Own password changes go through /change-password (the admin reset is for other users). */}
      <Link to="/change-password" className="user-panel__action" title="Cambiar contraseña">
        <KeyIcon className="user-panel__action-icon" />
        <span className="user-panel__action-label">Cambiar contraseña</span>
      </Link>
      <button
        type="button"
        className="user-panel__action"
        onClick={onLogout}
        disabled={loggingOut}
        aria-busy={loggingOut || undefined}
        title="Cerrar sesión"
      >
        {loggingOut ? (
          <Spinner size="sm" />
        ) : (
          <LogoutIcon className="user-panel__action-icon" />
        )}
        <span className="user-panel__action-label">
          {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </span>
      </button>
    </div>
  )
}

/**
 * Authenticated layout (UX-01, UX-05). One navigation, three presentations:
 * ≥ 73.75rem full sidebar (256 px), 47.5–73.75rem compact rail (88 px), below that a top bar
 * with a modal drawer.
 */
export default function AppShell() {
  const { user, hasPermission, logout } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const drawerRef = useRef<HTMLDialogElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const items = NAV_ITEMS.filter((item) => hasPermission(item.permission))
  const totals = useNavigationCounts(hasPermission('dashboard:read'))
  const counts: NavCounts = totals.data
    ? {
        '/app/vehicles': totals.data.vehicles,
        '/app/drivers': totals.data.drivers,
        '/app/passengers': totals.data.passengers,
      }
    : {}

  // On navigation: close the drawer and move focus to the new content, so keyboard and
  // screen-reader users start at the page they opened.
  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    if (drawerRef.current?.open) drawerRef.current.close()
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  const openDrawer = () => {
    // Native modal dialog: focus trap, Escape and inert background for free.
    drawerRef.current?.showModal()
    setDrawerOpen(true)
  }
  const closeDrawer = () => drawerRef.current?.close()

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout() // the guard then redirects to /login
    } catch (error) {
      setLoggingOut(false)
      toast.show({
        tone: 'error',
        title: 'No se pudo cerrar la sesión',
        description: getErrorMessage(error),
      })
    }
  }

  const userPanel = user && (
    <UserPanel user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  )

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido principal
      </a>

      <header className="app-topbar">
        <button
          type="button"
          className="icon-button app-topbar__menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={DRAWER_ID}
          onClick={openDrawer}
        >
          <MenuIcon />
          <span className="visually-hidden">Abrir menú de navegación</span>
        </button>
        <Brand to="/app/dashboard" tone="light" />
        {user && (
          <span className="app-topbar__avatar" title={`${user.full_name} · ${user.role.name}`}>
            <Avatar name={user.full_name} tone="dark" size="sm" />
          </span>
        )}
      </header>

      <div className="app-sidebar">
        <div className="app-sidebar__brand">
          <Brand to="/app/dashboard" tone="light" />
        </div>
        <Navigation items={items} counts={counts} />
        {userPanel}
      </div>

      <dialog
        ref={drawerRef}
        id={DRAWER_ID}
        className="app-drawer"
        aria-label="Menú de navegación"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <div className="app-drawer__panel">
          <div className="app-drawer__header">
            <Brand to="/app/dashboard" tone="light" />
            <button type="button" className="icon-button" onClick={closeDrawer}>
              <CloseIcon />
              <span className="visually-hidden">Cerrar menú</span>
            </button>
          </div>
          <Navigation items={items} counts={counts} />
          {userPanel}
        </div>
      </dialog>

      <div className="app-content">
        <main id="main" ref={mainRef} tabIndex={-1} className="app-main">
          <FleetSourceBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
