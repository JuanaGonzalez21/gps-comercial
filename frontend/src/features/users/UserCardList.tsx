import type { UserOut } from '@/api/types'
import { Skeleton } from '@/ui'
import { UserActions, type UserAction } from './UserActions'
import { ActiveBadge, LastLogin, PasswordState } from './UserBadges'

interface UserCardListProps {
  items: readonly UserOut[]
  currentUserId: string | null
  onAction: (action: UserAction, user: UserOut) => void
}

/** Phones (UX-01): one readable card per user with the same actions as the table. */
export function UserCardList({ items, currentUserId, onAction }: UserCardListProps) {
  return (
    <ul className="admin-cards" role="list">
      {items.map((user) => {
        const isSelf = user.id === currentUserId
        const titleId = `user-card-${user.id}`
        return (
          <li key={user.id}>
            <article className="admin-card" aria-labelledby={titleId}>
              <div className="admin-card__header">
                <h3 id={titleId} className="admin-card__title">
                  {user.full_name}
                  {isSelf && <span className="admin-tag">Tu cuenta</span>}
                </h3>
                <p className="admin-card__subtitle">{user.email}</p>
              </div>
              <dl className="admin-card__details">
                <div>
                  <dt>Rol</dt>
                  <dd>{user.role.name}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <ActiveBadge active={user.is_active} />
                  </dd>
                </div>
                <div>
                  <dt>Contraseña</dt>
                  <dd>
                    <PasswordState mustChange={user.must_change_password} />
                  </dd>
                </div>
                <div>
                  <dt>Último ingreso</dt>
                  <dd>
                    <LastLogin user={user} />
                  </dd>
                </div>
              </dl>
              <UserActions user={user} isSelf={isSelf} onAction={onAction} />
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
          <Skeleton width="80%" height="2rem" />
        </li>
      ))}
    </ul>
  )
}
