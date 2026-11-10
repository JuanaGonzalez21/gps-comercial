import type { UserOut } from '@/api/types'
import { Avatar, Skeleton } from '@/ui'
import { SelfNote, UserActions, type UserAction } from './UserActions'
import { ActiveBadge, LastLogin, PendingPasswordBadge } from './UserBadges'

interface UserCardListProps {
  items: readonly UserOut[]
  currentUserId: string | null
  onAction: (action: UserAction, user: UserOut) => void
}

/** Phones (UX-01): one row per user, stacked, with the same identity and actions as the table. */
export function UserCardList({ items, currentUserId, onAction }: UserCardListProps) {
  return (
    <ul className="admin-cards" role="list">
      {items.map((user) => {
        const isSelf = user.id === currentUserId
        const titleId = `user-card-${user.id}`
        const selfNoteId = `user-card-self-note-${user.id}`
        return (
          <li key={user.id}>
            <article className="admin-card" aria-labelledby={titleId}>
              <div className="users-person">
                <Avatar name={user.full_name} tone="dark" size="lg" />
                <div className="users-person__identity">
                  <h3 id={titleId} className="users-person__name">
                    {user.full_name}
                    {isSelf && <span className="admin-tag">Tu cuenta</span>}
                  </h3>
                  <p className="users-person__email">{user.email}</p>
                  {isSelf && <SelfNote id={selfNoteId} className="users-person__note" />}
                </div>
              </div>
              <dl className="admin-card__details">
                <div>
                  <dt>Rol</dt>
                  <dd>{user.role.name}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd className="admin-badges">
                    <ActiveBadge active={user.is_active} />
                    {user.must_change_password && <PendingPasswordBadge />}
                  </dd>
                </div>
                <div>
                  <dt>Último ingreso</dt>
                  <dd>
                    <LastLogin user={user} />
                  </dd>
                </div>
              </dl>
              <div className="users-card__actions">
                <UserActions user={user} isSelf={isSelf} onAction={onAction} selfNoteId={selfNoteId} />
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}

export function UserCardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="admin-cards" role="list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="admin-card">
          <Skeleton width="10rem" height="1.25rem" />
          <Skeleton width="70%" />
          <Skeleton width="50%" />
          <Skeleton width="6rem" height="2.5rem" />
        </li>
      ))}
    </ul>
  )
}
