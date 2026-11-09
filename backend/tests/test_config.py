import pytest
from pydantic import ValidationError

from app.core.config import Settings

PRODUCTION = {
    "app_env": "production",
    "jwt_secret": "x" * 48,
    "database_url": "postgresql://user@localhost/db",
}


def make(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_development_generates_ephemeral_jwt_secret() -> None:
    first, second = make(), make()
    assert len(first.jwt_secret.get_secret_value()) >= 32
    assert first.jwt_secret.get_secret_value() != second.jwt_secret.get_secret_value()


def test_production_requires_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        make(**{**PRODUCTION, "jwt_secret": ""})


def test_short_jwt_secret_rejected() -> None:
    with pytest.raises(ValidationError):
        make(jwt_secret="too-short")


def test_production_rejects_sqlite() -> None:
    with pytest.raises(ValidationError):
        make(**{**PRODUCTION, "database_url": "sqlite:///./x.db"})


def test_production_rejects_fake_fleet() -> None:
    with pytest.raises(ValidationError):
        make(**PRODUCTION, fleet_gateway="fake")


def test_postgres_url_uses_psycopg_driver() -> None:
    settings = make(database_url="postgres://user:pw@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://user:pw@host:5432/db"


def test_secure_cookies_and_docs_follow_environment() -> None:
    assert make().secure_cookies is False
    assert make().docs_enabled is True
    production = make(**PRODUCTION)
    assert production.secure_cookies is True
    assert production.docs_enabled is False
    assert make(**PRODUCTION, api_docs_enabled=True).docs_enabled is True


def test_empty_optional_values_are_unset() -> None:
    settings = make(wialon_default_resource_id="", admin_email="", cookie_secure="")
    assert settings.wialon_default_resource_id is None
    assert settings.admin_email is None
    assert settings.cookie_secure is None


def test_secrets_hidden_in_repr() -> None:
    settings = make(jwt_secret="s" * 40, admin_password="Admin-Password-123!")
    text = repr(settings)
    assert "s" * 40 not in text
    assert "Admin-Password-123!" not in text
