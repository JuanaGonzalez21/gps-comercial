"""Application settings loaded from environment variables (and backend/.env in development)."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "production", "test"] = "development"

    # Comma-separated list of explicit origins. Never "*": the API will use credentials later.
    cors_origins: Annotated[list[str], NoDecode] = []

    # Wialon is only called from the backend, always against this fixed host.
    wialon_base_url: AnyHttpUrl = AnyHttpUrl("https://hst-api.wialon.com/wialon/ajax.html")
    # SecretStr keeps the token out of repr() and logs. Empty until configured locally.
    wialon_token: SecretStr = SecretStr("")

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

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
