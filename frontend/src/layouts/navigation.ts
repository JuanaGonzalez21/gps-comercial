import type { ComponentType } from 'react'
import type { Permission } from '@/api/types'
import {
  AuditIcon,
  DashboardIcon,
  HistoryIcon,
  SteeringWheelIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  type IconProps,
} from '@/ui'

export interface NavItem {
  to: string
  label: string
  /** The item is shown only with this permission (UX-05); the backend checks it again. */
  permission: Permission
  icon: ComponentType<IconProps>
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/app/dashboard', label: 'Panel', permission: 'dashboard:read', icon: DashboardIcon },
  { to: '/app/vehicles', label: 'Vehículos', permission: 'vehicles:read', icon: TruckIcon },
  { to: '/app/drivers', label: 'Conductores', permission: 'drivers:read', icon: SteeringWheelIcon },
  { to: '/app/passengers', label: 'Pasajeros', permission: 'passengers:read', icon: UsersIcon },
  { to: '/app/history', label: 'Historial', permission: 'history:read', icon: HistoryIcon },
  { to: '/app/users', label: 'Usuarios', permission: 'users:manage', icon: UserCogIcon },
  { to: '/app/audit', label: 'Auditoría', permission: 'audit:read', icon: AuditIcon },
]
