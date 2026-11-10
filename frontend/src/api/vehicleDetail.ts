import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { isApiError } from './errors'
import type { CustomField, CustomFieldInput, CustomFieldUpdateInput, VehicleDetail } from './types'
import { POSITIONS_REFRESH_MS, vehicleKeys } from './vehicles'

// Vehicle detail (RF-12, RF-13, RF-09) and its custom fields (RF-19..RF-22).
// Custom field writes are optimistic: the cache changes at once and only the affected field is
// rolled back if the API (Wialon) fails, so concurrent edits of other fields are never undone.

export const vehicleDetailKeys = {
  detail: (id: number) => [...vehicleKeys.all, 'detail', id] as const,
  /** Nested under the detail key: invalidating a detail also refreshes its custom fields. */
  customFields: (id: number) => [...vehicleKeys.all, 'detail', id, 'custom-fields'] as const,
}

const customFieldMutationKey = (id: number) =>
  [...vehicleDetailKeys.customFields(id), 'mutation'] as const

function vehiclePath(id: number): string {
  return `/api/v1/vehicles/${encodeURIComponent(String(id))}`
}

export function fetchVehicleDetail(id: number, signal?: AbortSignal): Promise<VehicleDetail> {
  return apiFetch<VehicleDetail>(vehiclePath(id), { signal })
}

export function fetchVehicleCustomFields(id: number, signal?: AbortSignal): Promise<CustomField[]> {
  return apiFetch<CustomField[]>(`${vehiclePath(id)}/custom-fields`, { signal })
}

export function createVehicleCustomField(id: number, input: CustomFieldInput): Promise<CustomField> {
  return apiFetch<CustomField>(`${vehiclePath(id)}/custom-fields`, { method: 'POST', body: input })
}

export function updateVehicleCustomField(
  id: number,
  fieldId: number,
  input: CustomFieldUpdateInput,
): Promise<CustomField> {
  return apiFetch<CustomField>(`${vehiclePath(id)}/custom-fields/${fieldId}`, {
    method: 'PUT',
    body: input,
  })
}

export function deleteVehicleCustomField(id: number, fieldId: number): Promise<void> {
  return apiFetch<void>(`${vehiclePath(id)}/custom-fields/${fieldId}`, { method: 'DELETE' })
}

/** Detail with position, status, driver and passengers; refreshed like the map (RF-14). */
export function useVehicleDetail(id: number | null) {
  return useQuery({
    queryKey: vehicleDetailKeys.detail(id ?? -1),
    queryFn: ({ signal }) => fetchVehicleDetail(id as number, signal),
    enabled: id !== null,
    refetchInterval: POSITIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * Custom fields come from their own endpoint and are not polled, so the list does not shift
 * under the user while they edit. Edits still carry `expected_value` to detect remote changes.
 */
export function useVehicleCustomFields(id: number) {
  return useQuery({
    queryKey: vehicleDetailKeys.customFields(id),
    queryFn: ({ signal }) => fetchVehicleCustomFields(id, signal),
  })
}

/** Reads the fields again from the API, bypassing the cache (used after a 409 conflict). */
export function refetchVehicleCustomFields(queryClient: QueryClient, id: number): Promise<CustomField[]> {
  return queryClient.fetchQuery({
    queryKey: vehicleDetailKeys.customFields(id),
    queryFn: ({ signal }) => fetchVehicleCustomFields(id, signal),
    staleTime: 0,
  })
}

// ---------- Optimistic cache helpers ----------

let nextTemporaryId = -1

/** Negative ids mark rows that exist only in the cache while Wialon confirms them. */
export function isPendingField(field: CustomField): boolean {
  return field.id < 0
}

function setFields(
  queryClient: QueryClient,
  id: number,
  update: (fields: CustomField[]) => CustomField[],
): void {
  queryClient.setQueryData<CustomField[]>(vehicleDetailKeys.customFields(id), (current) =>
    current ? update(current) : current,
  )
}

/** Refresh from the server only when the last write for this vehicle has finished. */
async function settle(queryClient: QueryClient, id: number): Promise<void> {
  if (queryClient.isMutating({ mutationKey: customFieldMutationKey(id) }) > 1) return
  await queryClient.invalidateQueries({ queryKey: vehicleDetailKeys.detail(id) })
}

/** Number of custom field writes still waiting for Wialon (drives a polite live status). */
export function useCustomFieldWritesPending(id: number): number {
  return useIsMutating({ mutationKey: customFieldMutationKey(id) })
}

function useCustomFieldMutationBase(id: number) {
  return { queryClient: useQueryClient(), mutationKey: customFieldMutationKey(id) }
}

export function useCreateVehicleCustomField(id: number) {
  const { queryClient, mutationKey } = useCustomFieldMutationBase(id)
  return useMutation({
    mutationKey,
    mutationFn: (input: CustomFieldInput) => createVehicleCustomField(id, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: vehicleDetailKeys.customFields(id) })
      const temporaryId = nextTemporaryId--
      setFields(queryClient, id, (fields) => [...fields, { id: temporaryId, ...input }])
      return { temporaryId }
    },
    onSuccess: (created, _input, context) => {
      setFields(queryClient, id, (fields) =>
        fields.map((field) => (field.id === context.temporaryId ? created : field)),
      )
    },
    onError: (_error, _input, context) => {
      if (!context) return
      setFields(queryClient, id, (fields) => fields.filter((field) => field.id !== context.temporaryId))
    },
    onSettled: () => settle(queryClient, id),
  })
}

export interface UpdateCustomFieldVariables extends CustomFieldUpdateInput {
  fieldId: number
}

export function useUpdateVehicleCustomField(id: number) {
  const { queryClient, mutationKey } = useCustomFieldMutationBase(id)
  return useMutation({
    mutationKey,
    mutationFn: ({ fieldId, ...input }: UpdateCustomFieldVariables) =>
      updateVehicleCustomField(id, fieldId, input),
    onMutate: async ({ fieldId, name, value }) => {
      await queryClient.cancelQueries({ queryKey: vehicleDetailKeys.customFields(id) })
      const fields = queryClient.getQueryData<CustomField[]>(vehicleDetailKeys.customFields(id))
      const previous = fields?.find((field) => field.id === fieldId) ?? null
      setFields(queryClient, id, (current) =>
        current.map((field) => (field.id === fieldId ? { ...field, name, value } : field)),
      )
      return { previous }
    },
    onSuccess: (updated) => {
      setFields(queryClient, id, (fields) =>
        fields.map((field) => (field.id === updated.id ? updated : field)),
      )
    },
    onError: (_error, { fieldId }, context) => {
      const previous = context?.previous
      if (!previous) return
      setFields(queryClient, id, (fields) =>
        fields.map((field) => (field.id === fieldId ? previous : field)),
      )
    },
    onSettled: () => settle(queryClient, id),
  })
}

export function useDeleteVehicleCustomField(id: number) {
  const { queryClient, mutationKey } = useCustomFieldMutationBase(id)
  return useMutation({
    mutationKey,
    mutationFn: (field: CustomField) => deleteVehicleCustomField(id, field.id),
    onMutate: async (removed) => {
      await queryClient.cancelQueries({ queryKey: vehicleDetailKeys.customFields(id) })
      const fields = queryClient.getQueryData<CustomField[]>(vehicleDetailKeys.customFields(id))
      const index = fields?.findIndex((field) => field.id === removed.id) ?? -1
      setFields(queryClient, id, (current) => current.filter((field) => field.id !== removed.id))
      return { index }
    },
    onError: (error, removed, context) => {
      // Already gone in Wialon: the optimistic removal was right, keep it.
      if (isApiError(error) && error.code === 'not_found') return
      // Put the field back where it was, unless a refresh already brought it back.
      setFields(queryClient, id, (fields) => {
        if (fields.some((field) => field.id === removed.id)) return fields
        const next = [...fields]
        const index = context && context.index >= 0 ? Math.min(context.index, next.length) : next.length
        next.splice(index, 0, removed)
        return next
      })
    },
    onSettled: () => settle(queryClient, id),
  })
}
