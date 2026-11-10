import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type {
  Page,
  PasswordResetResponse,
  RoleOut,
  UserCreatedResponse,
  UserCreateInput,
  UserListParams,
  UserOut,
  UserUpdateInput,
} from './types'

// Users and roles (RF-06). Every endpoint needs `users:manage`; the backend checks it again.

/** Sort keys accepted by GET /users ("-" prefix = descending), see backend/app/api/v1/users.py. */
export type UserSort = 'email' | '-email' | 'full_name' | '-full_name' | 'created_at' | '-created_at'

export interface UserQueryParams extends UserListParams {
  sort?: UserSort
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserQueryParams) => [...userKeys.lists(), params] as const,
  roles: ['roles'] as const,
}

export function fetchUsers(params: UserQueryParams, signal?: AbortSignal): Promise<Page<UserOut>> {
  return apiFetch<Page<UserOut>>('/api/v1/users', { query: params, signal })
}

export function fetchRoles(signal?: AbortSignal): Promise<RoleOut[]> {
  return apiFetch<RoleOut[]>('/api/v1/roles', { signal })
}

export function createUser(input: UserCreateInput): Promise<UserCreatedResponse> {
  return apiFetch<UserCreatedResponse>('/api/v1/users', { method: 'POST', body: input })
}

export function updateUser(id: string, input: UserUpdateInput): Promise<UserOut> {
  return apiFetch<UserOut>(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
}

export function resetUserPassword(id: string): Promise<PasswordResetResponse> {
  return apiFetch<PasswordResetResponse>(`/api/v1/users/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
  })
}

/** Server-side search, filters, sort and paging. */
export function useUsers(params: UserQueryParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: ({ signal }) => fetchUsers(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** Roles change only with a migration: cache them for the session. */
export function useRoles() {
  return useQuery({
    queryKey: userKeys.roles,
    queryFn: ({ signal }) => fetchRoles(signal),
    staleTime: 30 * 60_000,
  })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: userKeys.lists() })
}

// Create and reset return a temporary password. gcTime 0 drops the finished mutation (and the
// password inside it) from the in-memory cache as soon as the screen stops observing it.
// `onSettled` also refreshes after an uncertain failure (no answer): the change may have happened.

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: createUser, gcTime: 0, onSettled: invalidate })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdateInput }) => updateUser(id, input),
    onSettled: invalidate,
  })
}

export function useResetUserPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: resetUserPassword, gcTime: 0, onSettled: invalidate })
}
