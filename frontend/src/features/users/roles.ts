import type { RoleCode, RoleOut } from '@/api/types'
import type { SelectOption } from '@/ui'

// Role names come from GET /roles (the database is the source of truth). These Spanish fallbacks
// keep filters and forms usable while that request loads or if it fails.

export const ROLE_CODES: readonly RoleCode[] = ['admin', 'operator', 'viewer']

export const ROLE_FALLBACK_NAMES: Record<RoleCode, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
}

/** What each role can do, in plain words (mirrors the permission matrix, section 5.3). */
export const ROLE_SUMMARIES: Record<RoleCode, string> = {
  admin: 'Acceso total, incluida la gestión de usuarios y el registro de auditoría.',
  operator:
    'Gestiona conductores, pasajeros, asignaciones y campos personalizados, y exporta CSV.',
  viewer: 'Solo lectura: panel, mapa, detalle, conductores, pasajeros e historial.',
}

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value)
}

/** Known roles in a stable order, named as the server says when it has answered. */
export function roleOptions(roles: readonly RoleOut[] | undefined): (SelectOption & { value: RoleCode })[] {
  return ROLE_CODES.map((code) => ({
    value: code,
    label: roles?.find((role) => role.code === code)?.name ?? ROLE_FALLBACK_NAMES[code],
  }))
}
