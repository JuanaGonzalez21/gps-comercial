from app.domain.permissions import ROLE_PERMISSIONS, Permission, RoleCode

READ_ONLY = {
    Permission.DASHBOARD_READ,
    Permission.VEHICLES_READ,
    Permission.DRIVERS_READ,
    Permission.PASSENGERS_READ,
    Permission.HISTORY_READ,
}


def test_matrix_matches_prueba_section_5_3() -> None:
    admin, operator, viewer = (ROLE_PERMISSIONS[r] for r in RoleCode)
    assert set(Permission) == admin
    assert operator == admin - {Permission.USERS_MANAGE, Permission.AUDIT_READ}
    assert viewer == READ_ONLY


def test_viewer_has_no_mutation_or_export() -> None:
    viewer = ROLE_PERMISSIONS[RoleCode.VIEWER]
    assert not viewer & {
        Permission.DRIVERS_WRITE,
        Permission.PASSENGERS_WRITE,
        Permission.ASSIGNMENTS_WRITE,
        Permission.VEHICLE_CUSTOM_FIELDS_WRITE,
        Permission.EXPORTS_CSV,
    }
