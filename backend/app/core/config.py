"""Application settings loaded from environment variables (and backend/.env in development)."""

import secrets
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "production", "test"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    # None = decide from APP_ENV: interactive docs everywhere except production.
    api_docs_enabled: bool | None = None

    # Comma-separated list of explicit origins. Never "*": the API uses credentials (cookies).
    cors_origins: Annotated[list[str], NoDecode] = []

    # --- Database ---
    # SQLite only for tests and quick local runs; production requires PostgreSQL.
    database_url: str = "sqlite:///./gps_comercial.db"

    # --- Authentication ---
    # Empty outside production = random per-process secret (sessions end on restart). No default.
    jwt_secret: SecretStr = SecretStr("")
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(default=7, ge=1, le=30)
    # None = Secure cookies in production only (local http://localhost cannot store Secure cookies).
    cookie_secure: bool | None = None
    login_max_attempts: int = Field(default=5, ge=1, le=20)
    login_lockout_minutes: int = Field(default=15, ge=1, le=1440)
    login_rate_limit_per_minute: int = Field(default=10, ge=1, le=600)

    # --- Fleet platform ---
    # "fake" = in-memory simulated fleet for tests and local UI work; forbidden in production.
    fleet_gateway: Literal["wialon", "fake"] = "wialon"
    # Wialon is only called from the backend, always against this fixed host (no user URLs).
    wialon_base_url: AnyHttpUrl = AnyHttpUrl("https://hst-api.wialon.com/wialon/ajax.html")
    # SecretStr keeps the token out of repr() and logs. Empty until configured locally.
    wialon_token: SecretStr = SecretStr("")
    wialon_timeout_seconds: float = Field(default=15, gt=0, le=60)
    wialon_cache_ttl_seconds: float = Field(default=15, ge=0, le=300)
    wialon_default_resource_id: int | None = None

    # --- Derived vehicle status thresholds (documented in docs/api-contract.md) ---
    vehicle_moving_speed_kmh: float = Field(default=5, gt=0, le=50)
    vehicle_no_signal_after_minutes: int = Field(default=60, ge=1, le=10080)

    # --- Initial admin, read only by `python -m app.cli seed-admin` ---
    admin_email: str | None = None
    admin_password: SecretStr | None = None
    admin_full_name: str | None = None

    @field_validator(
        "api_docs_enabled",
        "cookie_secure",
        "wialon_default_resource_id",
        "admin_email",
        "admin_password",
        "admin_full_name",
        mode="before",
    )
    @classmethod
    def empty_string_is_unset(cls, value: object) -> object:
        # .env.example lists optional variables with empty values; treat them as "not configured".
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def reject_wildcard(cls, origins: list[str]) -> list[str]:
        if "*" in origins:
            raise ValueError("CORS_ORIGINS must list explicit origins; '*' is not allowed")
        return origins

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        # Providers hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver name.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    @model_validator(mode="after")
    def check_environment_rules(self) -> "Settings":
        secret = self.jwt_secret.get_secret_value()
        if secret and len(secret) < _MIN_JWT_SECRET_LENGTH:
            raise ValueError(f"JWT_SECRET must have at least {_MIN_JWT_SECRET_LENGTH} characters")
        if self.is_production:
            if not secret:
                raise ValueError("JWT_SECRET is required in production")
            if self.database_url.startswith("sqlite"):
                raise ValueError("DATABASE_URL must point to PostgreSQL in production")
            if self.fleet_gateway == "fake":
                raise ValueError("FLEET_GATEWAY=fake (simulated data) is not allowed in production")
            if not self.cors_origins or any(
                not origin.startswith("https://") for origin in self.cors_origins
            ):
                # Without them every login would fail the Origin check (403) with no startup error.
                raise ValueError(
                    "CORS_ORIGINS must list the https:// frontend origin(s) in production"
                )
        elif not secret:
            self.jwt_secret = SecretStr(secrets.token_urlsafe(48))
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def docs_enabled(self) -> bool:
        if self.api_docs_enabled is None:
            return not self.is_production
        return self.api_docs_enabled

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is None:
            return self.is_production
        return self.cookie_secure


@lru_cache
def get_settings() -> Settings:
    return Settings()
