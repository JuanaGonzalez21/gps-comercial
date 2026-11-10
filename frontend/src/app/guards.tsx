import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { Permission } from '@/api/types'
import type { LoginRedirectState } from '@/auth/redirect'
import { useSessionEndReason } from '@/auth/sessionEnd'
import { useAuth } from '@/auth/useAuth'
import { useDocumentTitle } from '@/lib/hooks'
import { AlertCircleIcon, LinkButton, PageLoader } from '@/ui'

// Route guards (RF-04). They only adapt the UI: the backend enforces every permission again.

/** Signed-in users only; others go to /login and come back afterwards. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth()
  const endReason = useSessionEndReason()
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Verificando tu sesión…" />
  if (status === 'anonymous') {
    if (endReason === 'logout') {
      const state: LoginRedirectState = { loggedOut: true }
      return <Navigate to="/login" replace state={state} />
    }
    const state: LoginRedirectState = {
      from: { pathname: location.pathname, search: location.search },
    }
    const to = endReason === 'expired' ? '/login?reason=expired' : '/login'
    return <Navigate to={to} replace state={state} />
  }
  return children ?? <Outlet />
}

/** A temporary password must be replaced before using the app (RF-06). */
export function RequirePasswordChanged({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  if (user?.must_change_password) return <Navigate to="/change-password" replace />
  return children ?? <Outlet />
}

/** Views the role cannot use show an explicit, accessible "Acceso denegado" (UX-05). */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? children : <AccessDenied />
}

export function AccessDenied() {
  useDocumentTitle('Acceso denegado')
  return (
    <div className="state-block state-block--error">
      <div className="state-block__icon">
        <AlertCircleIcon />
      </div>
      <h1 className="state-block__title">Acceso denegado</h1>
      <p className="state-block__text">
        Tu rol no tiene permiso para ver esta sección. Si necesitas acceso, pide a un administrador
        que revise tu rol.
      </p>
      <div className="state-block__action">
        <LinkButton to="/app/dashboard" variant="secondary">
          Ir al panel
        </LinkButton>
      </div>
    </div>
  )
}
