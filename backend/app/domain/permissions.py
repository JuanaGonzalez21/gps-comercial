"""Granular permissions and the default role matrix.

At runtime the database (roles, permissions, role_permissions) is the source of truth: the initial
migration seeds it from a frozen copy of this matrix, so adding a role or permission is a data
change, not an `if role == "admin"` scattered through the code. Endpoints only ask for a Permission.
"""

from enum import StrEnum
from types import MappingProxyType


class Permission(StrEnum):
    DASHBOARD_READ = "dashboard:read"
    VEHICLES_READ = "vehicles:read"
    DRIVERS_READ = "drivers:read"
    PASSENGERS_READ = "passengers:read"
    HISTORY_READ = "history:read"
    DRIVERS_WRITE = "drivers:write"
    PASSENGERS_WRITE = "passengers:write"
    ASSIGNMENTS_WRITE = "assignments:write"
    VEHICLE_CUSTOM_FIELDS_WRITE = "vehicles:custom_fields:write"
    EXPORTS_CSV = "exports:csv"
    USERS_MANAGE = "users:manage"
    AUDIT_READ = "audit:read"


class RoleCode(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


ROLE_NAMES = MappingProxyType(
    {
        RoleCode.ADMIN: "Administrador",
        RoleCode.OPERATOR: "Operador",
        RoleCode.VIEWER: "Visualizador",
    }
)

PERMISSION_DESCRIPTIONS = MappingProxyType(
    {
        Permission.DASHBOARD_READ: "Ver el dashboard",
        Permission.VEHICLES_READ: "Ver vehículos, mapa y detalle",
        Permission.DRIVERS_READ: "Ver conductores",
        Permission.PASSENGERS_READ: "Ver pasajeros",
        Permission.HISTORY_READ: "Ver historial de recorridos",
        Permission.DRIVERS_WRITE: "Crear, editar y eliminar conductores",
        Permission.PASSENGERS_WRITE: (
            "Crear, editar y eliminar pasajeros y sus campos personalizados"
        ),
        Permission.ASSIGNMENTS_WRITE: "Vincular y desvincular conductores y pasajeros de vehículos",
        Permission.VEHICLE_CUSTOM_FIELDS_WRITE: "Editar campos personalizados de vehículos",
        Permission.EXPORTS_CSV: "Exportar datos en CSV",
        Permission.USERS_MANAGE: "Gestionar usuarios y roles",
        Permission.AUDIT_READ: "Ver el registro de auditoría",
    }
)

_READ_ONLY = frozenset(
    {
        Permission.DASHBOARD_READ,
        Permission.VEHICLES_READ,
        Permission.DRIVERS_READ,
        Permission.PASSENGERS_READ,
        Permission.HISTORY_READ,
    }
)

_OPERATIONS = _READ_ONLY | {
    Permission.DRIVERS_WRITE,
    Permission.PASSENGERS_WRITE,
    Permission.ASSIGNMENTS_WRITE,
    Permission.VEHICLE_CUSTOM_FIELDS_WRITE,
    Permission.EXPORTS_CSV,
}

ROLE_PERMISSIONS = MappingProxyType(
    {
        RoleCode.ADMIN: _OPERATIONS | {Permission.USERS_MANAGE, Permission.AUDIT_READ},
        RoleCode.OPERATOR: _OPERATIONS,
        RoleCode.VIEWER: _READ_ONLY,
    }
)
