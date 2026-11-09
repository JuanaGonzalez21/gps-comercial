"""TST-02: every role is denied what it is not allowed to do, and the API denies by default."""

import re

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.db.models import AuditLog

PUBLIC_OR_SESSION_ONLY = re.compile(r"^/api/v1/auth/")


def _api_operations(client: TestClient) -> list[tuple[str, str]]:
    schema = client.app.openapi()
    operations = []
    for path, methods in schema["paths"].items():
        if not path.startswith("/api/v1/") or PUBLIC_OR_SESSION_ONLY.match(path):
            continue
        concrete = re.sub(r"\{[^}]+\}", "1", path)
        operations += [(method.upper(), concrete) for method in methods]
    return operations


def test_every_business_endpoint_requires_a_session(client: TestClient) -> None:
    operations = _api_operations(client)
    assert operations, "no business endpoints found"
    for method, path in operations:
        client.headers["X-CSRF-Token"] = "x"
        client.cookies.set("gc_csrf", "x")
        response = client.request(method, path)
        assert response.status_code == 401, (method, path, response.status_code)


def test_role_without_permissions_is_denied_everywhere(login_as) -> None:
    client = login_as("nobody")
    for method, path in _api_operations(client):
        response = client.request(method, path)
        assert response.status_code == 403, (method, path, response.status_code)
        assert response.json()["code"] == "forbidden"


@pytest.mark.parametrize("role", ["admin", "operator", "viewer"])
def test_all_roles_can_read_vehicles(login_as, role: str) -> None:
    client = login_as(role)
    assert client.get("/api/v1/vehicles").status_code == 200
    assert client.get("/api/v1/vehicles/positions").status_code == 200


def test_denied_access_is_audited(login_as, session_factory) -> None:
    client = login_as("nobody")
    client.get("/api/v1/vehicles")
    with session_factory() as db:
        entry = db.query(AuditLog).filter_by(action="access.denied").one()
        assert entry.outcome == "failure"
        assert entry.details["permission"] == "vehicles:read"
