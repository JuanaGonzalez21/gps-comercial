"""RF-06: user management by the Admin (temporary passwords, roles, activation, self-protection)."""

import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.db.models import AuditLog, AuthSession, User
from app.services.passwords import policy_errors, verify_password
from tests.conftest import login


@pytest.fixture
def admin(client: TestClient, make_user):
    user = make_user("admin")
    assert login(client, user.email).status_code == 200
    return user


@pytest.fixture
def other_client(app) -> TestClient:
    """A second browser: its own cookie jar against the same application."""
    return TestClient(app)


def _create(client: TestClient, **overrides) -> dict:
    body = {"email": "nuevo@example.com", "full_name": "Nuevo Usuario", "role": "operator"}
    response = client.post("/api/v1/users", json={**body, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_user_with_temporary_password_and_forced_change(
    client, admin, other_client, session_factory
) -> None:
    body = _create(client, email="  Nuevo.Operador@Example.COM ", full_name="  Nuevo Operador ")
    temporary = body["temporary_password"]
    user = body["user"]
    assert user["email"] == "nuevo.operador@example.com"  # normalized lowercase
    assert user["full_name"] == "Nuevo Operador"
    assert user["role"] == {"code": "operator", "name": "Operador"}
    assert user["must_change_password"] is True and user["is_active"] is True
    assert user["last_login_at"] is None and user["created_at"].endswith("Z")
    assert policy_errors(temporary, user["email"]) == []

    # Shown once: never part of any later response.
    assert "temporary_password" not in client.get(f"/api/v1/users/{user['id']}").json()
    with session_factory() as db:
        stored = db.query(User).filter_by(email=user["email"]).one()
        assert stored.password_hash != temporary
        assert verify_password(stored.password_hash, temporary)
        assert str(stored.created_by_id) == admin.id
        entry = db.query(AuditLog).filter_by(action="user.created").one()
        assert entry.details == {"email": user["email"], "role": "operator"}
        assert entry.actor_email == admin.email
        assert temporary not in json.dumps(entry.details)

    assert login(other_client, user["email"], temporary).status_code == 200
    blocked = other_client.get("/api/v1/vehicles")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"


def test_duplicate_email_is_a_conflict_case_insensitive(client, admin) -> None:
    _create(client)
    response = client.post(
        "/api/v1/users",
        json={"email": "NUEVO@example.com", "full_name": "Otro", "role": "viewer"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"email": "no-es-correo", "full_name": "Ana", "role": "viewer"}, "email"),
        ({"email": "ana@example.com", "full_name": "   ", "role": "viewer"}, "full_name"),
        ({"email": "ana@example.com", "role": "viewer"}, "full_name"),
        ({"email": "ana@example.com", "full_name": "Ana", "role": "superadmin"}, "role"),
    ],
)
def test_create_validation_errors_name_the_field(client, admin, payload, field) -> None:
    response = client.post("/api/v1/users", json=payload)
    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [e["field"] for e in errors] == [field]
    assert all(e["message"] for e in errors)


def test_invalid_email_message_is_spanish(client, admin) -> None:
    response = client.post(
        "/api/v1/users", json={"email": "x@", "full_name": "Ana", "role": "viewer"}
    )
    assert response.json()["errors"][0]["message"] == "Ingresa un correo electrónico válido."


def test_list_filters_search_and_paging(client, admin, make_user) -> None:
    make_user("viewer")
    make_user("viewer", is_active=False)
    make_user("operator")
    viewers = client.get("/api/v1/users", params={"role": "viewer"}).json()
    assert viewers["total"] == 2
    inactive = client.get("/api/v1/users", params={"is_active": False}).json()
    assert [u["is_active"] for u in inactive["items"]] == [False]
    found = client.get("/api/v1/users", params={"search": "OPERATOR"}).json()
    assert [u["role"]["code"] for u in found["items"]] == ["operator"]
    paged = client.get("/api/v1/users", params={"page_size": 2, "page": 2, "sort": "email"}).json()
    assert paged["total"] == 4 and paged["pages"] == 2 and len(paged["items"]) == 2
    emails = [
        u["email"] for u in client.get("/api/v1/users", params={"sort": "-email"}).json()["items"]
    ]
    assert emails == sorted(emails, reverse=True)


def test_get_unknown_or_malformed_user(client, admin) -> None:
    missing = client.get(f"/api/v1/users/{uuid.uuid4()}")
    assert missing.status_code == 404 and missing.json()["code"] == "not_found"
    malformed = client.get("/api/v1/users/no-es-uuid")
    assert malformed.status_code == 422
    assert malformed.json()["errors"][0]["field"] == "user_id"


def test_change_role_and_deactivate_revokes_sessions(
    client, admin, make_user, other_client, session_factory
) -> None:
    target = make_user("operator")
    assert login(other_client, target.email).status_code == 200
    assert other_client.get("/api/v1/vehicles").status_code == 200

    demoted = client.patch(f"/api/v1/users/{target.id}", json={"role": "viewer"})
    assert demoted.status_code == 200
    assert demoted.json()["role"]["code"] == "viewer"
    # Permissions are read on every request: the demotion applies at once.
    assert other_client.post("/api/v1/drivers", json={"name": "X"}).status_code == 403

    deactivated = client.patch(f"/api/v1/users/{target.id}", json={"is_active": False})
    assert deactivated.json()["is_active"] is False
    assert other_client.get("/api/v1/vehicles").status_code == 401
    assert login(TestClient(client.app), target.email).status_code == 401

    with session_factory() as db:
        sessions = db.query(AuthSession).filter_by(user_id=uuid.UUID(target.id)).all()
        assert sessions and all(s.revoked_at is not None for s in sessions)
        updates = db.query(AuditLog).filter_by(action="user.updated").order_by(AuditLog.id).all()
        assert updates[0].details == {
            "email": target.email,
            "old_role": "operator",
            "new_role": "viewer",
            "changed_fields": ["role"],
        }
        assert updates[1].details["is_active"] is False
        assert updates[1].details["changed_fields"] == ["is_active"]


def test_noop_patch_is_not_audited(client, admin, make_user, session_factory) -> None:
    target = make_user("viewer")
    response = client.patch(f"/api/v1/users/{target.id}", json={"role": "viewer"})
    assert response.status_code == 200
    with session_factory() as db:
        assert db.query(AuditLog).filter_by(action="user.updated").count() == 0


def test_admin_cannot_deactivate_or_demote_self(client, admin) -> None:
    for body in ({"is_active": False}, {"role": "operator"}):
        response = client.patch(f"/api/v1/users/{admin.id}", json=body)
        assert response.status_code == 409, body
        assert response.json()["code"] == "conflict"
    me = client.get(f"/api/v1/users/{admin.id}").json()
    assert me["is_active"] is True and me["role"]["code"] == "admin"
    renamed = client.patch(f"/api/v1/users/{admin.id}", json={"full_name": "Admin Renombrado"})
    assert renamed.status_code == 200 and renamed.json()["full_name"] == "Admin Renombrado"


def test_reset_password_revokes_sessions_and_forces_change(
    client, admin, make_user, other_client, session_factory
) -> None:
    target = make_user("operator")
    assert login(other_client, target.email).status_code == 200
    with session_factory() as db:
        stored = db.query(User).filter_by(email=target.email).one()
        stored.failed_login_attempts = 3
        db.commit()

    response = client.post(f"/api/v1/users/{target.id}/reset-password")
    assert response.status_code == 200
    temporary = response.json()["temporary_password"]
    assert other_client.get("/api/v1/vehicles").status_code == 401  # old session revoked
    assert login(TestClient(client.app), target.email).status_code == 401  # old password gone

    fresh = TestClient(client.app)
    assert login(fresh, target.email, temporary).status_code == 200
    assert fresh.get("/api/v1/auth/me").json()["must_change_password"] is True
    with session_factory() as db:
        assert db.query(User).filter_by(email=target.email).one().failed_login_attempts == 0
        entry = db.query(AuditLog).filter_by(action="user.password_reset").one()
        assert entry.details == {"email": target.email}
        assert entry.entity_id == target.id


def test_admin_cannot_reset_own_password_here(client, admin) -> None:
    response = client.post(f"/api/v1/users/{admin.id}/reset-password")
    assert response.status_code == 409


def test_roles_list_permissions(client, admin) -> None:
    roles = {r["code"]: r for r in client.get("/api/v1/roles").json()}
    assert roles["admin"]["name"] == "Administrador"
    assert "users:manage" in roles["admin"]["permissions"]
    assert "users:manage" not in roles["operator"]["permissions"]
    assert "drivers:write" not in roles["viewer"]["permissions"]
