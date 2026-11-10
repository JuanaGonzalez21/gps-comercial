import type { UserOut } from '@/api/types'
import { formatDateTime, formatDateTimeShort, formatRelative } from '@/lib/format'
import { CheckCircleIcon, CircleIcon, KeyIcon } from '@/ui'
import { ToneBadge } from './ToneBadge'

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <ToneBadge tone="success" icon={<CheckCircleIcon />}>
      Activo
    </ToneBadge>
  ) : (
    <ToneBadge tone="neutral" icon={<CircleIcon />}>
      Inactivo
    </ToneBadge>
  )
}

/** must_change_password: the user still has a temporary password (RF-06). */
export function PendingPasswordBadge() {
  return (
    <ToneBadge tone="warning" icon={<KeyIcon />}>
      Debe cambiar la contraseña
    </ToneBadge>
  )
}

/**
 * Last login in Bogota time with a relative hint; null means the user never signed in.
 * `compact` (table) drops the year; the relative hint below keeps it unambiguous.
 */
export function LastLogin({ user, compact = false }: { user: UserOut; compact?: boolean }) {
  if (!user.last_login_at) return <span className="admin-muted">Nunca ha ingresado</span>
  return (
    <>
      <time dateTime={user.last_login_at} title={formatDateTime(user.last_login_at)}>
        {compact ? formatDateTimeShort(user.last_login_at) : formatDateTime(user.last_login_at)}
      </time>
      <span className="admin-table__secondary">{formatRelative(user.last_login_at)}</span>
    </>
  )
}
