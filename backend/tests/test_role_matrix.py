"""TST-02: each role is refused exactly what section 5.3 does not grant it, enforced by the backend.

Complements test_authorization.py (anonymous -> 401, role without permissions -> 403 everywhere).
"""

import pytest
from fastapi.routing import APIRoute, iter_route_contexts

from app.domain.permissions import Permission

WRITE_REQUESTS = [
    ("POST", "/api/v1/drivers", {"name": "Prohibido"}),
    ("PUT", "/api/v1/drivers/1000/1", {"name": "Prohibido"}),
    ("DELETE", "/api/v1/drivers/1000/1", None),
    ("PUT", "/api/v1/drivers/1000/9/assignment", {"unit_id": 120}),
    ("DELETE", "/api/v1/drivers/1000/1/assignment", None),
    ("POST", "/api/v1/passengers", {"name": "Prohibido"}),
    ("PUT", "/api/v1/passengers/1000/1", {"name": "Prohibido"}),
    ("DELETE", "/api/v1/passengers/1000/1", None),
    ("PUT", "/api/v1/passengers/1000/13/assignment", {"unit_id": 110}),
    ("DELETE", "/api/v1/passengers/1000/1/assignment", None),
    ("POST", "/api/v1/passengers/1000/1/custom-fields", {"key": "k", "value": "v"}),
    ("PUT", "/api/v1/passengers/1000/1/custom-fields/Empresa", {"value": "v"}),
    ("DELETE", "/api/v1/passengers/1000/1/custom-fields/Empresa", None),
    ("POST", "/api/v1/vehicles/100/custom-fields", {"name": "n", "value": "v"}),
    ("PUT", "/api/v1/vehicles/100/custom-fields/1", {"name": "Placa", "value": "v"}),
    ("DELETE", "/api/v1/vehicles/100/custom-fields/1", None),
]
EXPORTS = [
    ("GET", "/api/v1/exports/vehicles.csv", None),
    ("GET", "/api/v1/exports/drivers.csv", None),
    ("GET", "/api/v1/exports/passengers.csv", None),
]
ADMIN_ONLY = [
    ("GET", "/api/v1/users", None),
    ("POST", "/api/v1/users", {"email": "x@example.com", "full_name": "X", "role": "viewer"}),
    ("GET", "/api/v1/roles", None),
    ("GET", "/api/v1/audit-logs", None),
]
READS = [
    "/api/v1/dashboard/summary",
    "/api/v1/vehicles",
    "/api/v1/vehicles/100",
    "/api/v1/vehicles/100/custom-fields",
    "/api/v1/vehicles/100/track?from=2026-11-02T12:00:00Z&to=2026-11-02T13:00:00Z",
    "/api/v1/resources",
    "/api/v1/drivers",
    "/api/v1/drivers/1000/1",
    "/api/v1/passengers",
    "/api/v1/passengers/1000/1",
    "/api/v1/passengers/1000/1/custom-fields",
]


def _required_permissions(route: APIRoute) -> set[str]:
    found, pending = set(), list(route.dependant.dependencies)
    while pending:
        dependant = pending.pop()
        permission = getattr(dependant.call, "required_permission", None)
        if permission is not None:
            found.add(permission.value)
        pending.extend(dependant.dependencies)
    return found


def _business_routes(app) -> list[APIRoute]:
    # FastAPI 0.16x keeps included routers wrapped; iter_route_contexts flattens them.
    routes = []
    for context in iter_route_contexts(app.routes):
        route = context.original_route
        module = getattr(getattr(route, "endpoint", None), "__module__", "")
        if isinstance(route, APIRoute) and module.startswith("app.api.v1."):
            if module != "app.api.v1.auth":
                routes.append(route)
    return routes


def test_every_business_route_declares_a_permission(app) -> None:
    routes = _business_routes(app)
    documented = [
        method
        for path, methods in app.openapi()["paths"].items()
        if path.startswith("/api/v1/") and not path.startswith("/api/v1/auth/")
        for method in methods
    ]
    assert sum(len(r.methods) for r in routes) == len(documented)  # none escaped the walk
    known = {p.value for p in Permission}
    for route in routes:
        permissions = _required_permissions(route)
        assert permissions, f"{route.methods} {route.path} declares no permission"
        assert permissions <= known


@pytest.mark.parametrize(("method", "path", "body"), WRITE_REQUESTS + EXPORTS + ADMIN_ONLY)
def test_viewer_cannot_write_export_or_administer(login_as, fleet, method, path, body) -> None:
    client = login_as("viewer")
    before = (list(fleet.list_drivers()), list(fleet.list_passengers()), fleet.get_unit(100))
    response = client.request(method, path, json=body)
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "forbidden"
    after = (list(fleet.list_drivers()), list(fleet.list_passengers()), fleet.get_unit(100))
    assert after == before  # nothing reached Wialon


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ONLY)
def test_operator_cannot_manage_users_or_read_audit(login_as, method, path, body) -> None:
    client = login_as("operator")
    response = client.request(method, path, json=body)
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


@pytest.mark.parametrize("role", ["admin", "operator", "viewer"])
def test_every_role_can_read_the_fleet(login_as, role: str) -> None:
    client = login_as(role)
    for path in READS:
        assert client.get(path).status_code == 200, path


@pytest.mark.parametrize("role", ["admin", "operator"])
def test_admin_and_operator_can_write_and_export(login_as, role: str) -> None:
    client = login_as(role)
    assert client.post("/api/v1/drivers", json={"name": "Permitido"}).status_code == 201
    assert client.put("/api/v1/drivers/1000/9/assignment", json={"unit_id": 120}).status_code == 200
    assert client.get("/api/v1/exports/drivers.csv").status_code == 200


def test_admin_reaches_admin_only_endpoints(login_as) -> None:
    client = login_as("admin")
    for method, path, body in ADMIN_ONLY:
        expected = 201 if method == "POST" else 200
        assert client.request(method, path, json=body).status_code == expected, path
