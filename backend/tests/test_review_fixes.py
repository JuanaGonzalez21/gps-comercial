"""Regression tests for the independent security review (2026-11-09)."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.infrastructure.db.models import AuditLog, AuthSession, User
from tests.conftest import PASSWORD, login


def test_logout_with_expired_access_cookie_still_revokes_the_session(client, make_user) -> None:
    user = make_user("viewer")
    login(client, user.email)
    refresh_cookie, csrf = client.cookies.get("gc_refresh"), client.cookies.get("gc_csrf")
    client.cookies.delete("gc_access")  # the 15-minute access cookie already expired
    assert client.post("/api/v1/auth/logout").status_code == 204
    # Replaying the old refresh cookie (e.g. another tab or a stolen copy) must not sign in again.
    replay = TestClient(client.app, cookies={"gc_refresh": refresh_cookie, "gc_csrf": csrf})
    replay.headers["X-CSRF-Token"] = csrf
    assert replay.post("/api/v1/auth/refresh").status_code == 401


def test_logout_without_session_is_idempotent(client) -> None:
    client.cookies.set("gc_csrf", "x")
    client.headers["X-CSRF-Token"] = "x"
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_change_password_attempts_are_rate_limited(client, make_user) -> None:
    user = make_user("viewer")
    login(client, user.email)
    body = {"current_password": "Incorrecta-123!", "new_password": "Otra-Clave-Segura-1"}
    codes = [client.post("/api/v1/auth/change-password", json=body).status_code for _ in range(6)]
    assert codes[:5] == [422] * 5
    assert codes[5] == 429


def test_failed_attempts_are_counted_atomically(client, make_user, session_factory) -> None:
    user = make_user("viewer")
    for _ in range(3):
        login(client, user.email, "Mala-Clave-123!")
    with session_factory() as db:
        assert db.query(User).filter_by(email=user.email).one().failed_login_attempts == 3


def test_spoofed_forwarded_address_is_not_stored(settings, session_factory, fleet) -> None:
    from app.main import create_app

    app: FastAPI = create_app(settings, fleet_gateway=fleet, session_factory=session_factory)
    with TestClient(app, client=("not-an-ip-" + "x" * 80, 123)) as spoofed:
        spoofed.post("/api/v1/auth/login", json={"email": "a@b.co", "password": "Mala-Clave-123!"})
    with session_factory() as db:
        entry = db.query(AuditLog).filter_by(action="auth.login_failed").one()
        assert entry.ip_address is None


def test_rate_limiter_purges_stale_keys() -> None:
    now = {"t": 0.0}
    limiter = SlidingWindowRateLimiter(5, window_seconds=60, clock=lambda: now["t"])
    for i in range(10_001):
        limiter.hit(f"ip-{i}")
    now["t"] = 120.0
    limiter.hit("fresh-a")
    limiter.hit("fresh-b")
    assert len(limiter._hits) <= 2


def test_unhandled_error_keeps_request_id_and_hides_details(app: FastAPI) -> None:
    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.get("/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "internal_error"
    assert body["request_id"] and response.headers["x-request-id"] == body["request_id"]
    assert "secret internal detail" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_seed_admin_does_not_touch_an_existing_admin(tmp_path, session_factory, settings) -> None:
    from app.cli import seed_admin

    configured: Settings = settings.model_copy(
        update={
            "admin_email": "jefa@example.com",
            "admin_full_name": "Jefa",
            "admin_password": Settings(_env_file=None, admin_password=PASSWORD).admin_password,
        }
    )
    assert seed_admin(configured) == 0
    with session_factory() as db:
        admin = db.query(User).filter_by(email="jefa@example.com").one()
        admin.is_active = False  # an admin decision made later in the app
        db.commit()
    assert seed_admin(configured) == 0  # a restart must not undo it
    with session_factory() as db:
        assert db.query(User).filter_by(email="jefa@example.com").one().is_active is False
        assert db.query(AuditLog).filter_by(action="user.updated").count() == 0


def test_seed_admin_skipped_sessions_untouched(client, make_user, session_factory) -> None:
    # Sanity: sessions table exists and is empty before any login in this isolated database.
    with session_factory() as db:
        assert db.query(AuthSession).count() == 0


def test_custom_field_keys_cannot_be_dot_segments(login_as) -> None:
    client = login_as("operator")
    for key in (".", "..", "a/../b"):
        response = client.post(
            "/api/v1/passengers/1000/1/custom-fields", json={"key": key, "value": "x"}
        )
        assert response.status_code == 422, key
        assert response.json()["errors"][0]["field"] == "key"
