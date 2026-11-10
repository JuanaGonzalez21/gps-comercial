import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { ApiError } from './errors'
import { scopedPath, useResyncFleetViews, type ResourceScopedRef } from './resources'
import type {
  AssignmentInput,
  Page,
  PassengerCustomField,
  PassengerCustomFieldUpdateInput,
  PassengerInput,
  PassengerListParams,
  PassengerOut,
} from './types'

// Passengers (RF-08, RF-09, RF-27, RF-28) are Wialon tags inside a resource. Their custom fields
// (Wialon `jp`) are edited one at a time: the backend reads the passenger and merges each change
// into the complete set, so editing one field or the basic data never loses the others.

/** Sort keys accepted by GET /passengers (backend/app/api/v1/passengers.py). */
/** "-created": recently added first (audit date, then Wialon id order). */
export type PassengerSort = 'name' | '-name' | '-created'

export interface PassengerQueryParams extends PassengerListParams {
  sort?: PassengerSort
}

/** PUT body: basic data only; the backend keeps the custom fields as they are in Wialon. */
export type PassengerUpdateInput = Pick<PassengerInput, 'name' | 'code' | 'phone'>

const BASE = '/api/v1/passengers'

export const passengerKeys = {
  all: ['passengers'] as const,
  lists: () => [...passengerKeys.all, 'list'] as const,
  list: (params: PassengerQueryParams) => [...passengerKeys.lists(), params] as const,
  customFields: (ref: ResourceScopedRef) =>
    [...passengerKeys.all, 'custom-fields', ref.resource_id, ref.id] as const,
}

/**
 * The key travels in the URL path. "." and ".." cannot: the URL parser would resolve them as
 * path segments (even percent-encoded) and the request would reach another endpoint, for example
 * DELETE on the passenger itself. Such keys are refused before any request is sent.
 */
export function isPathSafeFieldKey(key: string): boolean {
  return key !== '.' && key !== '..'
}

function customFieldPath(ref: ResourceScopedRef, key: string): string {
  if (!isPathSafeFieldKey(key)) {
    throw new ApiError({
      status: 0,
      code: 'unsupported_key',
      detail: 'Este campo tiene una clave que no se puede editar desde la aplicación («.» o «..»).',
    })
  }
  return `${scopedPath(BASE, ref)}/custom-fields/${encodeURIComponent(key)}`
}

export function fetchPassengers(
  params: PassengerQueryParams,
  signal?: AbortSignal,
): Promise<Page<PassengerOut>> {
  return apiFetch<Page<PassengerOut>>(BASE, { query: params, signal })
}

export function createPassenger(input: PassengerInput): Promise<PassengerOut> {
  return apiFetch<PassengerOut>(BASE, { method: 'POST', body: input })
}

export function updatePassenger(ref: ResourceScopedRef, input: PassengerUpdateInput): Promise<PassengerOut> {
  return apiFetch<PassengerOut>(scopedPath(BASE, ref), { method: 'PUT', body: input })
}

export function deletePassenger(ref: ResourceScopedRef): Promise<void> {
  return apiFetch<void>(scopedPath(BASE, ref), { method: 'DELETE' })
}

/** Assigns the passenger to a vehicle; the backend waits until Wialon confirms it. */
export function assignPassenger(ref: ResourceScopedRef, unitId: number): Promise<PassengerOut> {
  const body: AssignmentInput = { unit_id: unitId }
  return apiFetch<PassengerOut>(`${scopedPath(BASE, ref)}/assignment`, { method: 'PUT', body })
}

export function unassignPassenger(ref: ResourceScopedRef): Promise<PassengerOut> {
  return apiFetch<PassengerOut>(`${scopedPath(BASE, ref)}/assignment`, { method: 'DELETE' })
}

export function fetchPassengerCustomFields(
  ref: ResourceScopedRef,
  signal?: AbortSignal,
): Promise<PassengerCustomField[]> {
  return apiFetch<PassengerCustomField[]>(`${scopedPath(BASE, ref)}/custom-fields`, { signal })
}

export function createPassengerCustomField(
  ref: ResourceScopedRef,
  field: PassengerCustomField,
): Promise<PassengerCustomField> {
  return apiFetch<PassengerCustomField>(`${scopedPath(BASE, ref)}/custom-fields`, {
    method: 'POST',
    body: field,
  })
}

/** Changes the value and, with `new_key`, renames the field (it keeps its position). */
export async function updatePassengerCustomField(
  ref: ResourceScopedRef,
  key: string,
  input: PassengerCustomFieldUpdateInput,
): Promise<PassengerCustomField> {
  return apiFetch<PassengerCustomField>(customFieldPath(ref, key), { method: 'PUT', body: input })
}

export async function deletePassengerCustomField(ref: ResourceScopedRef, key: string): Promise<void> {
  return apiFetch<void>(customFieldPath(ref, key), { method: 'DELETE' })
}

/** Server-side search, assignment and vehicle filters, sort and paging (RF-28). */
export function usePassengers(params: PassengerQueryParams) {
  return useQuery({
    queryKey: passengerKeys.list(params),
    queryFn: ({ signal }) => fetchPassengers(params, signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * Fresh custom fields of one passenger. The list row is shown at once (`initialData`) and is
 * re-read immediately (`initialDataUpdatedAt: 0`), so edits start from what Wialon has now.
 */
export function usePassengerCustomFields(ref: ResourceScopedRef, fromList?: PassengerCustomField[]) {
  return useQuery({
    queryKey: passengerKeys.customFields(ref),
    queryFn: ({ signal }) => fetchPassengerCustomFields(ref, signal),
    initialData: fromList,
    initialDataUpdatedAt: 0,
  })
}

// Mutations are never retried automatically; `onSettled` re-reads what Wialon has.

function useResyncPassengers() {
  return useResyncFleetViews([passengerKeys.all])
}

export function useCreatePassenger() {
  const resync = useResyncPassengers()
  return useMutation({
    mutationFn: createPassenger,
    onSettled: (_data, error) => resync(error),
  })
}

export function useUpdatePassenger() {
  const resync = useResyncPassengers()
  return useMutation({
    mutationFn: ({ ref, input }: { ref: ResourceScopedRef; input: PassengerUpdateInput }) =>
      updatePassenger(ref, input),
    onSettled: (_data, error) => resync(error),
  })
}

export function useDeletePassenger() {
  const resync = useResyncPassengers()
  return useMutation({
    mutationFn: deletePassenger,
    onSettled: (_data, error) => resync(error),
  })
}

export function useAssignPassenger() {
  const resync = useResyncPassengers()
  return useMutation({
    mutationFn: ({ ref, unitId }: { ref: ResourceScopedRef; unitId: number }) =>
      assignPassenger(ref, unitId),
    onSettled: (_data, error) => resync(error),
  })
}

export function useUnassignPassenger() {
  const resync = useResyncPassengers()
  return useMutation({
    mutationFn: unassignPassenger,
    onSettled: (_data, error) => resync(error),
  })
}

/** Mutation key shared by the custom-field writes of one passenger (to know if one is running). */
export function customFieldMutationKey(ref: ResourceScopedRef) {
  return [...passengerKeys.customFields(ref), 'write'] as const
}

export interface CustomFieldUpdateVariables {
  key: string
  input: PassengerCustomFieldUpdateInput
}

/**
 * Custom-field writes of one passenger. On success the cached list is patched at once (no
 * flicker); then it is re-read together with the passenger lists.
 */
function useCustomFieldCache(ref: ResourceScopedRef) {
  const queryClient = useQueryClient()
  const resync = useResyncFleetViews([passengerKeys.all])
  const patch = (update: (fields: PassengerCustomField[]) => PassengerCustomField[]) =>
    queryClient.setQueryData<PassengerCustomField[]>(passengerKeys.customFields(ref), (fields) =>
      fields ? update(fields) : fields,
    )
  return { patch, resync, mutationKey: customFieldMutationKey(ref) }
}

export function useCreatePassengerCustomField(ref: ResourceScopedRef) {
  const { patch, resync, mutationKey } = useCustomFieldCache(ref)
  return useMutation({
    mutationKey,
    mutationFn: (field: PassengerCustomField) => createPassengerCustomField(ref, field),
    onSuccess: (created) => patch((fields) => [...fields, created]),
    onSettled: (_data, error) => resync(error),
  })
}

export function useUpdatePassengerCustomField(ref: ResourceScopedRef) {
  const { patch, resync, mutationKey } = useCustomFieldCache(ref)
  return useMutation({
    mutationKey,
    mutationFn: ({ key, input }: CustomFieldUpdateVariables) => updatePassengerCustomField(ref, key, input),
    onSuccess: (saved, { key }) =>
      patch((fields) => fields.map((field) => (field.key === key ? saved : field))),
    onSettled: (_data, error) => resync(error),
  })
}

export function useDeletePassengerCustomField(ref: ResourceScopedRef) {
  const { patch, resync, mutationKey } = useCustomFieldCache(ref)
  return useMutation({
    mutationKey,
    mutationFn: (key: string) => deletePassengerCustomField(ref, key),
    onSuccess: (_data, key) => patch((fields) => fields.filter((field) => field.key !== key)),
    onSettled: (_data, error) => resync(error),
  })
}
