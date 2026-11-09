"""Dependency injection for routers: settings, DB session, current principal, permissions, services.

Tests replace any of these with `app.dependency_overrides` or by passing them to create_app.
"""

import logging
import secrets
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domain.errors import CsrfError, PasswordChangeRequiredError, PermissionDeniedError
from app.domain.permissions import Permission
from app.domain.ports import FleetGateway
from app.domain.vehicle_status import ThresholdStatusPolicy
from app.infrastructure.db.models import AuthSession, User
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.vehicle_service import VehicleService

logger = logging.getLogger("app.security")

ACCESS_COOKIE = "gc_access"
REFRESH_COOKIE = "gc_refresh"
CSRF_COOKIE = "gc_csrf"
CSRF_HEADER = "X-CSRF-Token"
_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_CSRF_EXEMPT_PATHS = frozenset({"/api/v1/auth/login"})


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_fleet_gateway(request: Request) -> FleetGateway:
    return request.app.state.fleet_gateway


def get_vehicle_service(
    gateway: FleetGateway = Depends(get_fleet_gateway),
    settings: Settings = Depends(get_settings),
) -> VehicleService:
    policy = ThresholdStatusPolicy(
        moving_speed_kmh=settings.vehicle_moving_speed_kmh,
        no_signal_after=timedelta(minutes=settings.vehicle_no_signal_after_minutes),
    )
    return VehicleService(gateway, policy)


def csrf_protect(request: Request, settings: Settings = Depends(get_settings)) -> None:
    """Double-submit CSRF token plus Origin allow-list for state-changing requests (SEG-11)."""
    if request.method not in _UNSAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in settings.cors_origins:
        raise CsrfError("El origen de la solicitud no está permitido.")
    if request.url.path in _CSRF_EXEMPT_PATHS:
        return  # no session exists yet; the Origin check above still applies
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise CsrfError("La solicitud no incluye un token CSRF válido. Recarga la página.")


@dataclass(frozen=True, slots=True)
class Principal:
    user: User
    session: AuthSession
    permissions: frozenset[str]


def get_principal(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Principal:
    user, session = AuthService(db, settings).authenticate(request.cookies.get(ACCESS_COOKIE))
    return Principal(user=user, session=session, permissions=user.permission_codes)


def get_active_principal(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.user.must_change_password:
        raise PasswordChangeRequiredError("Debes cambiar tu contraseña antes de continuar.")
    return principal


def require_permission(permission: Permission) -> Callable[..., Principal]:
    """Dependency factory: the only way endpoints declare authorization (deny by default)."""

    def dependency(
        request: Request,
        principal: Principal = Depends(get_active_principal),
        db: Session = Depends(get_db),
    ) -> Principal:
        if permission.value in principal.permissions:
            return principal
        AuditService(db).record(
            "access.denied",
            outcome="failure",
            actor=principal.user,
            ip_address=client_ip(request),
            details={
                "permission": permission.value,
                "method": request.method,
                "path": request.url.path,
            },
        )
        db.commit()
        logger.warning(
            "access_denied",
            extra={
                "permission": permission.value,
                "path": request.url.path,
                "role": principal.user.role.code,
            },
        )
        raise PermissionDeniedError("No tienes permiso para realizar esta acción.")

    dependency.required_permission = permission  # type: ignore[attr-defined]  # route audit marker
    return dependency
