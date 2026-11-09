"""FastAPI application factory (composition root: wires settings, adapters and middlewares)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session, sessionmaker

from app.api.health import router as health_router
from app.api.v1 import api_v1_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.request_context import RequestContextMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.domain.ports import FleetGateway
from app.infrastructure.db.session import create_db_engine, create_session_factory
from app.infrastructure.fake_fleet.gateway import FakeFleetGateway
from app.infrastructure.wialon.client import WialonClient
from app.infrastructure.wialon.gateway import WialonFleetGateway


def build_fleet_gateway(settings: Settings) -> FleetGateway:
    """Factory: the configured fleet adapter. "fake" is refused in production by Settings."""
    if settings.fleet_gateway == "fake":
        return FakeFleetGateway()
    client = WialonClient(
        base_url=str(settings.wialon_base_url),
        token=settings.wialon_token.get_secret_value(),
        timeout_seconds=settings.wialon_timeout_seconds,
    )
    return WialonFleetGateway(client, cache_ttl_seconds=settings.wialon_cache_ttl_seconds)


def create_app(
    settings: Settings | None = None,
    *,
    fleet_gateway: FleetGateway | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    engine = None
    if session_factory is None:
        engine = create_db_engine(settings.database_url)
        session_factory = create_session_factory(engine)
    gateway = fleet_gateway or build_fleet_gateway(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        close = getattr(gateway, "close", None)
        if callable(close):
            close()  # ends the Wialon session (best effort)
        if engine is not None:
            engine.dispose()

    app = FastAPI(
        title="GPS Comercial API",
        version="0.1.0",
        description=(
            "API de monitoreo de flota sobre Wialon. Autenticación con cookies HttpOnly; "
            "las peticiones que modifican datos requieren la cabecera X-CSRF-Token."
        ),
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        # A trailing-slash redirect would be absolute and could send the browser to the backend
        # host behind the frontend's rewrite, losing the first-party cookies.
        redirect_slashes=False,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.fleet_gateway = gateway
    app.state.login_limiter = SlidingWindowRateLimiter(
        settings.login_rate_limit_per_minute, window_seconds=60
    )

    register_error_handlers(app)

    # Starlette runs the last added middleware first: request id -> headers -> CORS -> gzip.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Content-Type", "X-CSRF-Token"],
        )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(RequestContextMiddleware)

    app.include_router(health_router)
    app.include_router(api_v1_router)
    return app


app = create_app()
