import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import type { Me } from '@/api/types'
import { FleetSourceBanner } from '@/app/FleetSourceBanner'
import { useAuth } from '@/auth/useAuth'
import { Brand, Button, CloseIcon, LogoutIcon, MenuIcon, useToast } from '@/ui'
import { NAV_ITEMS, type NavItem } from './navigation'
import './layouts.css'
import '@/styles/panel-theme.css'

const DRAWER_ID = 'app-navigation-drawer'

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function Navigation({ items }: { items: readonly NavItem[] }) {
  return (
    <nav className="app-nav" aria-label="Navegación principal">
      <ul role="list" className="app-nav__list">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            {/* NavLink sets aria-current="page" on the active item. */}
            <NavLink to={to} className="app-nav__link">
              <Icon className="app-nav__icon" />
              <span>{label}</span>
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
      <div className="user-panel__identity">
        <span className="user-panel__avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <div className="user-panel__text">
          <p className="user-panel__name">{user.full_name}</p>
          <p className="user-panel__role">{user.role.name}</p>
        </div>
      </div>
      {/* Own password changes go through /change-password (the admin reset is for other users). */}
      <Link to="/change-password" className="user-panel__link">
        Cambiar contraseña
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="user-panel__logout"
        icon={<LogoutIcon />}
        onClick={onLogout}
        loading={loggingOut}
        loadingText="Cerrando sesión…"
        fullWidth
      >
        Cerrar sesión
      </Button>
    </div>
  )
}

/** Authenticated layout: sidebar on desktop, top bar + modal drawer on mobile (UX-01, UX-05). */
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
          className="app-topbar__menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={DRAWER_ID}
          onClick={openDrawer}
        >
          <MenuIcon />
          <span className="visually-hidden">Abrir menú de navegación</span>
        </button>
        <Brand to="/app/dashboard" tone="light" />
      </header>

      <div className="app-sidebar">
        <div className="app-sidebar__brand">
          <Brand to="/app/dashboard" tone="light" />
        </div>
        <Navigation items={items} />
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
            <button type="button" className="app-drawer__close" onClick={closeDrawer}>
              <CloseIcon />
              <span className="visually-hidden">Cerrar menú</span>
            </button>
          </div>
          <Navigation items={items} />
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
