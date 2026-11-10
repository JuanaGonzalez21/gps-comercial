import type { UserSort } from '@/api/users'
import type { UserOut } from '@/api/types'
import { ArrowDownIcon, ArrowUpIcon, Avatar, Skeleton, SortIcon } from '@/ui'
import { SelfNote, UserActions, type UserAction } from './UserActions'
import { ActiveBadge, LastLogin, PendingPasswordBadge } from './UserBadges'

const SORT_DESCRIPTIONS: Record<UserSort, string> = {
  full_name: 'nombre, de la A a la Z',
  '-full_name': 'nombre, de la Z a la A',
  email: 'correo, de la A a la Z',
  '-email': 'correo, de la Z a la A',
  created_at: 'fecha de creación, más antiguos primero',
  '-created_at': 'fecha de creación, más recientes primero',
}

function NameHeader({ sort, onSort }: { sort: UserSort; onSort: (sort: UserSort) => void }) {
  const ascending = sort === 'full_name'
  const descending = sort === '-full_name'
  const Icon = ascending ? ArrowUpIcon : descending ? ArrowDownIcon : SortIcon
  return (
    <th scope="col" aria-sort={ascending ? 'ascending' : descending ? 'descending' : 'none'}>
      <button type="button" className="admin-sort" onClick={() => onSort(ascending ? '-full_name' : 'full_name')}>
        <span>Usuario</span>
        <Icon />
      </button>
    </th>
  )
}

interface UserTableProps {
  items: readonly UserOut[]
  currentUserId: string | null
  sort: UserSort
  onSortChange: (sort: UserSort) => void
  onAction: (action: UserAction, user: UserOut) => void
  busy: boolean
}

/** Tablet and desktop list (UX-06). Phones get UserCardList instead of a squeezed table. */
export function UserTable({ items, currentUserId, sort, onSortChange, onAction, busy }: UserTableProps) {
  return (
    <div className="admin-table-scroll" role="region" aria-label="Tabla de usuarios" tabIndex={0}>
      <table className="admin-table users-table" aria-busy={busy || undefined}>
        <caption className="visually-hidden">Usuarios ordenados por {SORT_DESCRIPTIONS[sort]}.</caption>
        <thead>
          <tr>
            <NameHeader sort={sort} onSort={onSortChange} />
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Último ingreso</th>
            <th scope="col" className="users-table__actions-head">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((user) => {
            const isSelf = user.id === currentUserId
            const selfNoteId = `user-self-note-${user.id}`
            return (
              <tr key={user.id}>
                <th scope="row" className="users-table__user">
                  <div className="users-person">
                    <Avatar name={user.full_name} tone="dark" size="lg" />
                    <div className="users-person__identity">
                      <span className="users-person__name">
                        {user.full_name}
                        {isSelf && <span className="admin-tag">Tu cuenta</span>}
                      </span>
                      <span className="users-person__email">{user.email}</span>
                      {isSelf && <SelfNote id={selfNoteId} className="users-person__note" />}
                    </div>
                  </div>
                </th>
                <td>{user.role.name}</td>
                <td>
                  {/* One column for both states keeps the table within a laptop screen. */}
                  <div className="admin-badges admin-badges--stack users-table__badges">
                    <ActiveBadge active={user.is_active} />
                    {user.must_change_password && <PendingPasswordBadge />}
                  </div>
                </td>
                <td>
                  <LastLogin user={user} compact />
                </td>
                <td className="users-table__actions">
                  <UserActions user={user} isSelf={isSelf} onAction={onAction} selfNoteId={selfNoteId} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function UserTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-table-scroll" aria-hidden="true">
      <table className="admin-table">
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index}>
              <td>
                <Skeleton width="10rem" />
                <Skeleton width="13rem" height="0.75rem" className="admin-skeleton-gap" />
              </td>
              <td>
                <Skeleton width="6rem" />
              </td>
              <td>
                <Skeleton width="5rem" height="1.5rem" pill />
              </td>
              <td>
                <Skeleton width="9rem" />
              </td>
              <td>
                <Skeleton width="8rem" height="2.5rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
