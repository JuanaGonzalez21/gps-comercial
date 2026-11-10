import { useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import type { RoleCode, UserOut, UserUpdateInput } from '@/api/types'
import {
  useCreateUser,
  useResetUserPassword,
  useRoles,
  useUpdateUser,
  useUsers,
  type UserQueryParams,
  type UserSort,
} from '@/api/users'
import { useAuth } from '@/auth/useAuth'
import { formatNumber } from '@/lib/format'
import { useDebouncedValue, useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchIcon,
  UserCogIcon,
  UserPlusIcon,
  useToast,
} from '@/ui'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'
import type { UserAction } from './UserActions'
import { UserCardList, UserCardListSkeleton } from './UserCardList'
import { UserFilters, type ActiveFilter } from './UserFilters'
import { UserFormDialog } from './UserFormDialog'
import { roleOptions } from './roles'
import type { UserFormOutput } from './userSchema'
import { UserTable, UserTableSkeleton } from './UserTable'
import './admin-table.css'
import './users.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350
/** Below 80rem (phones, tablets, small laptops) the list is cards; the full table needs the width. */
const COMPACT_QUERY = '(max-width: 79.99rem)'

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; user: UserOut }
  | { kind: 'toggle-active'; user: UserOut }
  | { kind: 'reset'; user: UserOut }
  | { kind: 'password'; user: UserOut; password: string; reason: 'created' | 'reset' }

/** User administration, exclusive to `users:manage` (RF-06). The backend enforces every rule again. */
export default function UsersPage() {
  useDocumentTitle('Usuarios')
  const { user: me } = useAuth()
  const toast = useToast()
  const isCompact = useMediaQuery(COMPACT_QUERY)

  // ---- Filters (UI state) -> query params (server state) ----
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS)
  const [role, setRole] = useState<RoleCode | ''>('')
  const [active, setActive] = useState<ActiveFilter>('')
  const [sort, setSort] = useState<UserSort>('full_name')

  // Any filter change starts again at page 1, without an extra effect.
  const filterKey = `${search}|${role}|${active}|${sort}`
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1
  const goToPage = (next: number) => setPaging({ key: filterKey, page: next })

  const params: UserQueryParams = {
    search: search || undefined,
    role: role || undefined,
    is_active: active === '' ? undefined : active === 'active',
    sort,
    page,
    page_size: PAGE_SIZE,
  }
  const list = useUsers(params)
  const roles = useRoles()
  const options = useMemo(() => roleOptions(roles.data), [roles.data])

  const hasFilters = searchInput.trim() !== '' || role !== '' || active !== ''
  const clearFilters = () => {
    setSearchInput('')
    setRole('')
    setActive('')
  }

  // ---- Dialogs: one at a time ----
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const resetMutation = useResetUserPassword()

  // Focus goes back to the button that started the flow, also after a chain of dialogs
  // (form -> temporary password), where each native dialog only knows its own opener.
  const triggerRef = useRef<HTMLElement | null>(null)
  const openDialog = (next: DialogState) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setConfirmError(null)
    setDialog(next)
  }
  useEffect(() => {
    if (dialog !== null) return
    const trigger = triggerRef.current
    triggerRef.current = null
    if (trigger?.isConnected) trigger.focus()
  }, [dialog])

  const closeDialog = () => {
    setConfirmError(null)
    setDialog(null)
  }

  const openAction = (action: UserAction, user: UserOut) => {
    if (action === 'edit') openDialog({ kind: 'edit', user })
    else if (action === 'toggle-active') openDialog({ kind: 'toggle-active', user })
    else openDialog({ kind: 'reset', user })
  }

  const submitCreate = async (values: UserFormOutput) => {
    const result = await createMutation.mutateAsync({
      email: values.email,
      full_name: values.full_name,
      role: values.role,
    })
    createMutation.reset() // the password stays only in the dialog below
    setDialog({ kind: 'password', user: result.user, password: result.temporary_password, reason: 'created' })
  }

  const submitEdit = async (target: UserOut, values: UserFormOutput) => {
    // PATCH: send only what changed. The own role is never sent (the backend refuses it).
    const input: UserUpdateInput = {}
    if (values.full_name !== target.full_name) input.full_name = values.full_name
    if (target.id !== me?.id && values.role !== target.role.code) input.role = values.role
    if (Object.keys(input).length === 0) {
      closeDialog()
      toast.show({ tone: 'info', title: 'No había cambios para guardar' })
      return
    }
    const updated = await updateMutation.mutateAsync({ id: target.id, input })
    closeDialog()
    toast.show({
      tone: 'success',
      title: 'Cambios guardados',
      description: `${updated.full_name} · ${updated.role.name}`,
    })
  }

  const confirmToggle = async (target: UserOut) => {
    setConfirmError(null)
    try {
      const updated = await updateMutation.mutateAsync({
        id: target.id,
        input: { is_active: !target.is_active },
      })
      closeDialog()
      toast.show(
        updated.is_active
          ? { tone: 'success', title: `${updated.full_name} está activo`, description: 'Ya puede iniciar sesión.' }
          : {
              tone: 'success',
              title: `${updated.full_name} fue desactivado`,
              description: 'Ya no puede iniciar sesión y sus sesiones abiertas se cerraron.',
            },
      )
    } catch (error) {
      setConfirmError(getErrorMessage(error))
    }
  }

  const confirmReset = async (target: UserOut) => {
    setConfirmError(null)
    try {
      const result = await resetMutation.mutateAsync(target.id)
      resetMutation.reset()
      setDialog({ kind: 'password', user: target, password: result.temporary_password, reason: 'reset' })
    } catch (error) {
      setConfirmError(getErrorMessage(error))
    }
  }

  // ---- List content ----
  const data = list.data
  let content
  if (!data && list.isError) {
    content = (
      <ErrorState
        title="No pudimos cargar los usuarios"
        message={getErrorMessage(list.error)}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!data) {
    content = (
      <>
        <p className="visually-hidden" role="status">
          Cargando usuarios…
        </p>
        {isCompact ? <UserCardListSkeleton /> : <UserTableSkeleton />}
      </>
    )
  } else if (data.total === 0) {
    content = hasFilters ? (
      <EmptyState
        icon={<SearchIcon />}
        title="Ningún usuario coincide con los filtros"
        description="Prueba con otro nombre o correo, o quita alguno de los filtros."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<UserCogIcon />}
        title="Aún no hay usuarios"
        description="Crea el primer acceso para tu equipo."
        action={
          <Button icon={<UserPlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
            Crear usuario
          </Button>
        }
      />
    )
  } else if (data.items.length === 0) {
    content = (
      <EmptyState
        title="Esta página ya no tiene usuarios"
        description="La lista cambió mientras la consultabas."
        action={
          <Button variant="secondary" onClick={() => goToPage(1)}>
            Ir a la primera página
          </Button>
        }
      />
    )
  } else {
    content = isCompact ? (
      <UserCardList items={data.items} currentUserId={me?.id ?? null} onAction={openAction} />
    ) : (
      <UserTable
        items={data.items}
        currentUserId={me?.id ?? null}
        sort={sort}
        onSortChange={setSort}
        onAction={openAction}
        busy={list.isPlaceholderData}
      />
    )
  }

  const total = data?.total

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Crea accesos, asigna roles, activa o desactiva cuentas y restablece contraseñas. No hay registro público: solo un administrador crea usuarios."
        actions={
          <Button icon={<UserPlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
            Crear usuario
          </Button>
        }
      />

      <UserFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        role={role}
        onRoleChange={setRole}
        roleOptions={options}
        active={active}
        onActiveChange={setActive}
        sort={sort}
        onSortChange={setSort}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      {list.isError && data && (
        <Alert
          tone="warning"
          role="status"
          className="admin-alert"
          title="No se pudo actualizar la lista"
          action={
            <Button size="sm" variant="secondary" onClick={() => void list.refetch()}>
              Reintentar
            </Button>
          }
        >
          {getErrorMessage(list.error)}
        </Alert>
      )}

      <section className="admin-panel" aria-labelledby="users-list-title">
        <div className="admin-panel__header">
          <h2 id="users-list-title" className="admin-panel__title">
            Lista de usuarios
          </h2>
          <p className="admin-panel__meta" role="status">
            {total === undefined ? '' : total === 1 ? '1 usuario' : `${formatNumber(total)} usuarios`}
          </p>
        </div>

        {content}

        {data && data.total > 0 && (
          <Pagination
            page={page}
            pages={data.pages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={goToPage}
            label="Paginación de usuarios"
            itemLabel="usuarios"
            disabled={list.isPlaceholderData}
          />
        )}
      </section>

      {/* Order matters: a closing dialog returns focus before the next one opens. */}
      {dialog?.kind === 'create' && (
        <UserFormDialog mode="create" roleOptions={options} onClose={closeDialog} onSubmit={submitCreate} />
      )}
      {dialog?.kind === 'edit' && (
        <UserFormDialog
          mode="edit"
          user={dialog.user}
          isSelf={dialog.user.id === me?.id}
          roleOptions={options}
          onClose={closeDialog}
          onSubmit={(values) => submitEdit(dialog.user, values)}
        />
      )}
      {dialog?.kind === 'toggle-active' && (
        <ConfirmDialog
          open
          destructive={dialog.user.is_active}
          title={
            dialog.user.is_active ? `¿Desactivar a ${dialog.user.full_name}?` : `¿Activar a ${dialog.user.full_name}?`
          }
          description={
            <>
              <p>
                {dialog.user.is_active
                  ? `${dialog.user.email} no podrá iniciar sesión y sus sesiones abiertas se cerrarán de inmediato. Podrás activarlo de nuevo cuando quieras.`
                  : `${dialog.user.email} podrá iniciar sesión otra vez con su contraseña actual.`}
              </p>
              {confirmError && (
                <Alert tone="error" role="alert" className="user-confirm__error" title="No se pudo completar">
                  {confirmError}
                </Alert>
              )}
            </>
          }
          confirmLabel={dialog.user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
          busy={updateMutation.isPending}
          onCancel={closeDialog}
          onConfirm={() => void confirmToggle(dialog.user)}
        />
      )}
      {dialog?.kind === 'reset' && (
        <ConfirmDialog
          open
          title={`¿Restablecer la contraseña de ${dialog.user.full_name}?`}
          description={
            <>
              <p>
                Se generará una contraseña temporal nueva, la actual dejará de funcionar y se cerrarán
                sus sesiones abiertas. Deberá cambiarla al iniciar sesión.
              </p>
              {confirmError && (
                <Alert tone="error" role="alert" className="user-confirm__error" title="No se pudo restablecer">
                  {confirmError}
                </Alert>
              )}
            </>
          }
          confirmLabel="Restablecer contraseña"
          busy={resetMutation.isPending}
          onCancel={closeDialog}
          onConfirm={() => void confirmReset(dialog.user)}
        />
      )}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordDialog
          user={dialog.user}
          password={dialog.password}
          reason={dialog.reason}
          onClose={closeDialog}
        />
      )}
    </>
  )
}
