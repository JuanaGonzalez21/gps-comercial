import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { AuditListParams, AuditLogOut, Page } from './types'

// Audit log (RF-26). Read-only and gated by `audit:read`; newest entries first (server order).

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (params: AuditListParams) => [...auditKeys.all, 'list', params] as const,
}

export function fetchAuditLogs(params: AuditListParams, signal?: AbortSignal): Promise<Page<AuditLogOut>> {
  return apiFetch<Page<AuditLogOut>>('/api/v1/audit-logs', { query: params, signal })
}

export function useAuditLogs(params: AuditListParams, enabled = true) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: ({ signal }) => fetchAuditLogs(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}
