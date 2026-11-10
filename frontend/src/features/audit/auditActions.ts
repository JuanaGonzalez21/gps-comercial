import type { AuditLogOut } from '@/api/types'

// Human Spanish labels for the audit actions of docs/api-contract.md (Auditoría) plus the
// security event the backend also records (auth.refresh_reuse_detected). Unknown codes are shown raw.

export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  'auth.login_succeeded': 'Inicio de sesión',
  'auth.login_failed': 'Inicio de sesión fallido',
  'auth.logout': 'Cierre de sesión',
  'auth.password_changed': 'Cambio de contraseña',
  'auth.refresh_reuse_detected': 'Reutilización de sesión detectada',
  'user.created': 'Usuario creado',
  'user.updated': 'Usuario actualizado',
  'user.password_reset': 'Contraseña restablecida',
  'driver.created': 'Conductor creado',
  'driver.updated': 'Conductor editado',
  'driver.deleted': 'Conductor eliminado',
  'driver.assigned': 'Conductor vinculado a un vehículo',
  'driver.unassigned': 'Conductor desvinculado de un vehículo',
  'passenger.created': 'Pasajero creado',
  'passenger.updated': 'Pasajero editado',
  'passenger.deleted': 'Pasajero eliminado',
  'passenger.assigned': 'Pasajero asignado a un vehículo',
  'passenger.unassigned': 'Pasajero desasignado de un vehículo',
  'passenger.custom_field.created': 'Campo de pasajero creado',
  'passenger.custom_field.updated': 'Campo de pasajero editado',
  'passenger.custom_field.deleted': 'Campo de pasajero eliminado',
  'vehicle.custom_field.created': 'Campo de vehículo creado',
  'vehicle.custom_field.updated': 'Campo de vehículo editado',
  'vehicle.custom_field.deleted': 'Campo de vehículo eliminado',
  'export.generated': 'Exportación CSV',
  'access.denied': 'Acceso denegado',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

export const ENTITY_LABELS: Readonly<Record<string, string>> = {
  user: 'Usuario',
  session: 'Sesión',
  driver: 'Conductor',
  passenger: 'Pasajero',
  vehicle: 'Vehículo',
  export: 'Exportación',
}

export function entityLabel(entityType: string | null): string | null {
  if (!entityType) return null
  return ENTITY_LABELS[entityType] ?? entityType
}

const ID_HEAD = 8
const ID_TAIL = 5

/** "1422e771…cfb6c": long identifiers (UUIDs) are shortened on screen. */
export function shortId(id: string): string {
  return id.length > ID_HEAD + ID_TAIL + 3 ? `${id.slice(0, ID_HEAD)}…${id.slice(-ID_TAIL)}` : id
}

/** Entries without details (or with an empty object) show "Sin detalles" instead of a toggle. */
export function hasDetails(entry: Pick<AuditLogOut, 'details'>): boolean {
  return entry.details !== null && Object.keys(entry.details).length > 0
}

export interface ActionOption {
  value: string
  label: string
}

export interface ActionGroup {
  label: string
  options: readonly ActionOption[]
}

function only(...actions: string[]): ActionOption[] {
  return actions.map((action) => ({ value: action, label: auditActionLabel(action) }))
}

/**
 * The backend filters by prefix: "user." matches every user action, "user.created" only that one.
 * Each group starts with its "all" prefix.
 */
export const ACTION_FILTER_GROUPS: readonly ActionGroup[] = [
  {
    label: 'Sesiones',
    options: [
      { value: 'auth.', label: 'Todas las de sesión' },
      ...only(
        'auth.login_succeeded',
        'auth.login_failed',
        'auth.logout',
        'auth.password_changed',
        'auth.refresh_reuse_detected',
      ),
    ],
  },
  {
    label: 'Usuarios',
    options: [
      { value: 'user.', label: 'Toda la gestión de usuarios' },
      ...only('user.created', 'user.updated', 'user.password_reset'),
    ],
  },
  {
    label: 'Conductores',
    options: [
      { value: 'driver.', label: 'Todos los cambios de conductores' },
      ...only('driver.created', 'driver.updated', 'driver.deleted', 'driver.assigned', 'driver.unassigned'),
    ],
  },
  {
    label: 'Pasajeros',
    options: [
      { value: 'passenger.', label: 'Todos los cambios de pasajeros' },
      ...only(
        'passenger.created',
        'passenger.updated',
        'passenger.deleted',
        'passenger.assigned',
        'passenger.unassigned',
      ),
      { value: 'passenger.custom_field.', label: 'Todos los campos de pasajeros' },
      ...only(
        'passenger.custom_field.created',
        'passenger.custom_field.updated',
        'passenger.custom_field.deleted',
      ),
    ],
  },
  {
    label: 'Vehículos',
    options: [
      { value: 'vehicle.custom_field.', label: 'Todos los campos de vehículos' },
      ...only('vehicle.custom_field.created', 'vehicle.custom_field.updated', 'vehicle.custom_field.deleted'),
    ],
  },
  {
    label: 'Seguridad y exportaciones',
    options: only('access.denied', 'export.generated'),
  },
]

export function isKnownActionFilter(value: string): boolean {
  return ACTION_FILTER_GROUPS.some((group) => group.options.some((option) => option.value === value))
}
