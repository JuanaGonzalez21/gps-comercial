import type { UserOut } from '@/api/types'
import { ActionMenu, CheckCircleIcon, CircleIcon, EditIcon, KeyIcon, LinkButton, type ActionMenuItem } from '@/ui'

export type UserAction = 'edit' | 'toggle-active' | 'reset-password'

/** Shown next to the signed-in admin's own account (design "7. Usuarios"). */
export function SelfNote({ id, className }: { id: string; className?: string }) {
  return (
    <p id={id} className={['admin-note', className].filter(Boolean).join(' ')}>
      No puedes desactivar tu propia cuenta ni cambiar tu rol.
    </p>
  )
}

interface UserActionsProps {
  user: UserOut
  /** The signed-in administrator's own account. */
  isSelf: boolean
  onAction: (action: UserAction, user: UserOut) => void
  /** Id of the visible SelfNote, which also describes the own "Editar" button. */
  selfNoteId?: string
}

/**
 * Row actions shared by the table and the cards. Own account: "Contraseña" (link to the change
 * page) and Editar; deactivating or resetting yourself is not offered because the backend refuses
 * it (409). Other people: Editar (role and name) plus "⋮" with reset and activate/deactivate,
 * destructive last. Names start with the visible meaning and add the person ("Editar a Ana").
 */
export function UserActions({ user, isSelf, onAction, selfNoteId }: UserActionsProps) {
  const name = user.full_name
  const edit = (
    <button
      type="button"
      className="icon-button users-actions__icon"
      aria-label={`Editar a ${name}`}
      aria-describedby={isSelf ? selfNoteId : undefined}
      onClick={() => onAction('edit', user)}
    >
      <EditIcon />
    </button>
  )

  if (isSelf) {
    return (
      <div className="users-actions" role="group" aria-label={`Acciones de ${name}`}>
        <LinkButton
          size="sm"
          variant="secondary"
          icon={<KeyIcon />}
          to="/change-password"
          aria-label="Contraseña: cambiar la tuya"
        >
          Contraseña
        </LinkButton>
        {edit}
      </div>
    )
  }

  const items: ActionMenuItem[] = [
    { label: 'Restablecer contraseña', icon: <KeyIcon />, onSelect: () => onAction('reset-password', user) },
    user.is_active
      ? { label: 'Desactivar', icon: <CircleIcon />, tone: 'danger', onSelect: () => onAction('toggle-active', user) }
      : { label: 'Activar', icon: <CheckCircleIcon />, onSelect: () => onAction('toggle-active', user) },
  ]
  return (
    <div className="users-actions" role="group" aria-label={`Acciones de ${name}`}>
      {edit}
      <ActionMenu label={`Más acciones para ${name}`} items={items} />
    </div>
  )
}
