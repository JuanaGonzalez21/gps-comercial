from datetime import timedelta

from fastapi.testclient import TestClient

from app.infrastructure.db.models import AuditLog, AuthSession, User
from tests.conftest import FRONTEND_ORIGIN, PASSWORD, login


def test_login_sets_httponly_session_cookies(client: TestClient, make_user) -> None:
    user = make_user("operator")
    response = login(client, user.email)
    assert response.status_code == 200
    body = response.json()["user"]
    assert body["role"]["code"] == "operator"
    assert "users:manage" not in body["permissions"]
    cookies = response.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith("gc_access="))
    refresh = next(c for c in cookies if c.startswith("gc_refresh="))
    csrf = next(c for c in cookies if c.startswith("gc_csrf="))
    assert "HttpOnly" in access and "HttpOnly" in refresh and "HttpOnly" not in csrf
    assert "Path=/api/v1/auth" in refresh
    assert all("samesite=lax" in c.lower() for c in (access, refresh, csrf))
    assert "token" not in response.text.lower()  # no tokens in the body


def test_wrong_password_and_unknown_email_share_generic_message(client, make_user) -> None:
    user = make_user("viewer")
    wrong = login(client, user.email, "Otra-Clave-123!")
    unknown = login(client, "nadie@example.com", "Otra-Clave-123!")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]
    assert wrong.json()["code"] == "invalid_credentials"
    assert wrong.headers["content-type"].startswith("application/problem+json")


def test_account_locks_after_max_failed_attempts(client, make_user, session_factory) -> None:
    user = make_user("viewer")
    for _ in range(5):
        assert login(client, user.email, "Mala-Clave-123!").status_code == 401
    # Even the right password is refused while the lock lasts, with the same generic message.
    assert login(client, user.email).status_code == 401
    with session_factory() as db:
        stored = db.query(User).filter_by(email=user.email).one()
        assert stored.locked_until is not None
        failures = db.query(AuditLog).filter_by(action="auth.login_failed").count()
        assert failures == 6


def test_rate_limit_per_ip(settings, session_factory, fleet) -> None:
    from app.main import create_app

    limited = settings.model_copy(update={"login_rate_limit_per_minute": 2})
    with TestClient(
        create_app(limited, fleet_gateway=fleet, session_factory=session_factory)
    ) as client:
        for _ in range(2):
            login(client, "x@example.com", "Mala-Clave-123!")
        response = login(client, "x@example.com", "Mala-Clave-123!")
        assert response.status_code == 429
        assert response.json()["code"] == "rate_limited"
        assert int(response.headers["retry-after"]) >= 1


def test_inactive_user_cannot_login(client, make_user) -> None:
    user = make_user("viewer", is_active=False)
    assert login(client, user.email).status_code == 401


def test_me_requires_session(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "not_authenticated"


def test_logout_revokes_session_immediately(client, make_user) -> None:
    user = make_user("admin")
    login(client, user.email)
    access_cookie = client.cookies.get("gc_access")
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set("gc_access", access_cookie)  # replaying the old token must not work
    assert client.get("/api/v1/auth/me").status_code == 401


def test_csrf_required_for_unsafe_methods(client, make_user) -> None:
    user = make_user("admin")
    login(client, user.email)
    client.headers.pop("X-CSRF-Token")
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_failed"


def test_foreign_origin_rejected(client, make_user) -> None:
    user = make_user("admin")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": PASSWORD},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_failed"


def test_refresh_rotates_token_and_detects_reuse(client, make_user, session_factory) -> None:
    user = make_user("viewer")
    login(client, user.email)
    old_refresh = client.cookies.get("gc_refresh")
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert client.cookies.get("gc_refresh") != old_refresh

    # Reusing the rotated token after the grace window revokes the whole session.
    with session_factory() as db:
        session = db.query(AuthSession).one()
        session.rotated_at = session.rotated_at - timedelta(minutes=5)
        db.commit()
    reuse = TestClient(client.app, cookies={"gc_refresh": old_refresh})
    reuse.headers["X-CSRF-Token"] = "x"
    reuse.cookies.set("gc_csrf", "x")
    assert reuse.post("/api/v1/auth/refresh").status_code == 401
    with session_factory() as db:
        assert db.query(AuthSession).one().revoked_at is not None
    assert client.get("/api/v1/auth/me").status_code == 401


def test_must_change_password_gates_the_api(client, make_user) -> None:
    user = make_user("operator", must_change_password=True)
    login(client, user.email)
    assert client.get("/api/v1/auth/me").status_code == 200
    blocked = client.get("/api/v1/vehicles")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "password_change_required"

    weak = client.post(
        "/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "corta"}
    )
    assert weak.status_code == 422
    assert {e["field"] for e in weak.json()["errors"]} == {"new_password"}

    ok = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "Nueva-Clave-Segura-9"},
    )
    assert ok.status_code == 200
    assert ok.json()["user"]["must_change_password"] is False
    assert client.get("/api/v1/vehicles").status_code == 200


def test_change_password_rejects_wrong_current(client, make_user) -> None:
    user = make_user("viewer")
    login(client, user.email)
    response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Incorrecta-123!", "new_password": "Otra-Clave-Segura-1"},
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "current_password"


def test_cors_preflight_only_for_frontend(client: TestClient) -> None:
    allowed = client.options(
        "/api/v1/auth/login",
        headers={"Origin": FRONTEND_ORIGIN, "Access-Control-Request-Method": "POST"},
    )
    denied = client.options(
        "/api/v1/auth/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN
    assert "access-control-allow-origin" not in denied.headers


def test_csrf_token_stays_stable_across_refresh(client, make_user) -> None:
    user = make_user("viewer")
    login(client, user.email)
    before = client.cookies.get("gc_csrf")
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert client.cookies.get("gc_csrf") == before
    # A request prepared with the token read before the refresh must still be accepted.
    assert client.post("/api/v1/auth/logout").status_code == 204
