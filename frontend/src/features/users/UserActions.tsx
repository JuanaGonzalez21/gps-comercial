import { useId } from 'react'
import type { UserOut } from '@/api/types'
import { Button, CheckCircleIcon, CircleIcon, EditIcon, KeyIcon, LinkButton } from '@/ui'

export type UserAction = 'edit' | 'toggle-active' | 'reset-password'

export function SelfNote({ id, className }: { id: string; className?: string }) {
  return (
    <p id={id} className={['admin-note', className].filter(Boolean).join(' ')}>
      Es tu cuenta: no puedes desactivarla ni cambiar su rol. Otro administrador puede hacerlo.
    </p>
  )
}

interface UserActionsProps {
  user: UserOut
  /** The signed-in administrator's own account. */
  isSelf: boolean
  onAction: (action: UserAction, user: UserOut) => void
  /** Id of a "this is your account" note rendered elsewhere (table cell); otherwise it is shown here. */
  selfNoteId?: string
}

/**
 * Row actions shared by the table and the cards. Each aria-label starts with the visible word
 * (WCAG 2.5.3) and adds the person, so a list of "Editar" buttons is still unambiguous.
 * The backend refuses (409) to deactivate, demote or reset the signed-in admin; the UI says so
 * up front instead of letting the request fail.
 */
export function UserActions({ user, isSelf, onAction, selfNoteId }: UserActionsProps) {
  const ownNoteId = useId()
  const noteId = selfNoteId ?? ownNoteId
  const name = user.full_name
  const toggleLabel = user.is_active ? 'Desactivar' : 'Activar'
  return (
    <div className="admin-actions">
      <Button
        size="sm"
        variant="secondary"
        icon={<EditIcon />}
        aria-label={`Editar a ${name}`}
        onClick={() => onAction('edit', user)}
      >
        Editar
      </Button>
      <Button
        size="sm"
        variant={user.is_active ? 'ghost' : 'secondary'}
        icon={user.is_active ? <CircleIcon /> : <CheckCircleIcon />}
        disabled={isSelf}
        aria-label={`${toggleLabel} a ${name}`}
        aria-describedby={isSelf ? noteId : undefined}
        onClick={() => onAction('toggle-active', user)}
      >
        {toggleLabel}
      </Button>
      {isSelf ? (
        <LinkButton size="sm" variant="ghost" icon={<KeyIcon />} to="/change-password">
          Cambiar mi contraseña
        </LinkButton>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          icon={<KeyIcon />}
          aria-label={`Restablecer la contraseña de ${name}`}
          onClick={() => onAction('reset-password', user)}
        >
          Restablecer
        </Button>
      )}
      {isSelf && !selfNoteId && <SelfNote id={noteId} className="admin-actions__note" />}
    </div>
  )
}
