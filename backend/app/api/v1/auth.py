"""Authentication endpoints. Session state lives in HttpOnly cookies, never in the response body."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    Principal,
    client_ip,
    get_db,
    get_principal,
    get_settings,
)
from app.api.schemas.auth import AuthResponse, ChangePasswordRequest, LoginRequest, MeOut
from app.api.schemas.common import PROBLEM_RESPONSES
from app.core.config import Settings
from app.domain.errors import RateLimitedError
from app.services import tokens
from app.services.auth_service import AuthService, IssuedSession

router = APIRouter(prefix="/auth", tags=["auth"], responses=PROBLEM_RESPONSES)

REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_session_cookies(
    response: Response,
    issued: IssuedSession,
    settings: Settings,
    *,
    csrf_token: str | None = None,
) -> None:
    secure = settings.secure_cookies
    refresh_max_age = settings.refresh_token_ttl_days * 86_400
    response.set_cookie(
        ACCESS_COOKIE,
        issued.access_token,
        max_age=settings.access_token_ttl_minutes * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        issued.refresh_token,
        max_age=refresh_max_age,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )
    # Readable by the SPA on purpose: it echoes it in X-CSRF-Token (double-submit pattern).
    # New at login; kept stable on refresh so requests already in flight stay valid.
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token or tokens.new_opaque_token(),
        max_age=refresh_max_age,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    secure = settings.secure_cookies
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=secure, httponly=True, samesite="lax")
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, secure=secure, httponly=True, samesite="lax"
    )
    response.delete_cookie(CSRF_COOKIE, path="/", secure=secure, samesite="lax")


@router.post("/login", response_model=AuthResponse, summary="Iniciar sesión")
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    ip = client_ip(request)
    retry_after = request.app.state.login_limiter.hit(ip or "unknown")
    if retry_after is not None:
        minutes = max(1, round(retry_after / 60))
        raise RateLimitedError(
            f"Demasiados intentos de inicio de sesión. Espera {minutes} min e inténtalo de nuevo.",
            retry_after_seconds=retry_after,
        )
    issued = AuthService(db, settings).login(
        body.email, body.password, ip_address=ip, user_agent=request.headers.get("user-agent")
    )
    _set_session_cookies(response, issued, settings)
    return AuthResponse(user=MeOut.from_user(issued.user))


@router.post("/refresh", response_model=AuthResponse, summary="Renovar la sesión")
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    issued = AuthService(db, settings).refresh(
        request.cookies.get(REFRESH_COOKIE), ip_address=client_ip(request)
    )
    _set_session_cookies(response, issued, settings, csrf_token=request.cookies.get(CSRF_COOKIE))
    return AuthResponse(user=MeOut.from_user(issued.user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Cerrar sesión")
def logout(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    # No get_principal here: an expired access cookie must not prevent revoking the session.
    AuthService(db, settings).logout(
        request.cookies.get(ACCESS_COOKIE),
        request.cookies.get(REFRESH_COOKIE),
        ip_address=client_ip(request),
    )
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_session_cookies(response, settings)
    return response


@router.get("/me", response_model=MeOut, summary="Usuario actual")
def me(principal: Principal = Depends(get_principal)) -> MeOut:
    return MeOut.from_user(principal.user)


@router.post("/change-password", response_model=AuthResponse, summary="Cambiar la contraseña")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    retry_after = request.app.state.password_change_limiter.hit(str(principal.user.id))
    if retry_after is not None:
        raise RateLimitedError(
            "Demasiados intentos de cambio de contraseña. Espera unos minutos.",
            retry_after_seconds=retry_after,
        )
    # The principal was loaded with this same request-scoped DB session, so it can be updated here.
    AuthService(db, settings).change_password(
        principal.user,
        principal.session,
        body.current_password,
        body.new_password,
        ip_address=client_ip(request),
    )
    return AuthResponse(user=MeOut.from_user(principal.user))
