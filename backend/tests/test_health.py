import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app

FRONTEND_ORIGIN = "http://localhost:5173"


def make_client(**overrides: object) -> TestClient:
    settings = Settings(**{"_env_file": None, "cors_origins": FRONTEND_ORIGIN, **overrides})
    return TestClient(create_app(settings))


def test_health_returns_only_status() -> None:
    response = make_client().get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_does_not_leak_token() -> None:
    client = make_client(wialon_token="secret-value-for-test")
    assert "secret-value-for-test" not in client.get("/health").text


def test_cors_allows_configured_origin() -> None:
    response = make_client().get("/health", headers={"Origin": FRONTEND_ORIGIN})
    assert response.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN


def test_cors_ignores_unknown_origin() -> None:
    response = make_client().get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_cors_rejects_wildcard() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins="*")


PRODUCTION = {
    "app_env": "production",
    "jwt_secret": "x" * 48,
    "database_url": "postgresql://user@localhost/db",
    "cors_origins": "https://app.example",
}


def test_docs_disabled_in_production() -> None:
    client = make_client(**PRODUCTION)
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_token_is_hidden_in_repr() -> None:
    settings = Settings(_env_file=None, wialon_token="secret-value-for-test")
    assert "secret-value-for-test" not in repr(settings)


def test_health_answers_head_for_uptime_monitors() -> None:
    response = make_client().head("/health")
    assert response.status_code == 200
    assert response.text == ""
