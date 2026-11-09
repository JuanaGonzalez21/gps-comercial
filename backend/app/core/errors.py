"""Uniform error responses: RFC 7807 Problem Details (application/problem+json).

Domain errors are mapped by class; validation errors keep per-field messages; anything
unexpected is logged with its stack trace server-side and answered with a generic 500.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import current_request_id
from app.domain import errors as domain

logger = logging.getLogger("app.errors")

PROBLEM_JSON = "application/problem+json"

# Order matters: subclasses before their parents.
_STATUS_BY_ERROR: list[tuple[type[domain.DomainError], int, str]] = [
    (domain.UpstreamNotConfiguredError, 503, "Integración no configurada"),
    (domain.UpstreamUnavailableError, 503, "Servicio externo no disponible"),
    (domain.UpstreamForbiddenError, 502, "Operación no permitida por Wialon"),
    (domain.UpstreamError, 502, "Error del servicio externo"),
    (domain.PasswordChangeRequiredError, 403, "Debes cambiar tu contraseña"),
    (domain.CsrfError, 403, "Solicitud rechazada"),
    (domain.PermissionDeniedError, 403, "Acceso denegado"),
    (domain.InvalidCredentialsError, 401, "Credenciales inválidas"),
    (domain.AuthenticationError, 401, "Sesión no válida"),
    (domain.NotFoundError, 404, "Recurso no encontrado"),
    (domain.ConflictError, 409, "Conflicto"),
    (domain.InvalidInputError, 422, "Datos inválidos"),
    (domain.RateLimitedError, 429, "Demasiados intentos"),
]

_VALIDATION_MESSAGES = {
    "missing": "Este campo es obligatorio.",
    "string_too_short": "Es demasiado corto.",
    "string_too_long": "Es demasiado largo.",
    "string_type": "Debe ser texto.",
    "int_parsing": "Debe ser un número entero.",
    "int_type": "Debe ser un número entero.",
    "float_parsing": "Debe ser un número.",
    "bool_parsing": "Debe ser verdadero o falso.",
    "datetime_parsing": "Debe ser una fecha y hora ISO-8601.",
    "datetime_from_date_parsing": "Debe ser una fecha y hora ISO-8601.",
    "greater_than_equal": "El valor es demasiado pequeño.",
    "less_than_equal": "El valor es demasiado grande.",
    "literal_error": "Valor no permitido.",
    "enum": "Valor no permitido.",
    "string_pattern_mismatch": "El formato no es válido.",
    "value_error": "El valor no es válido.",
    "json_invalid": "El cuerpo de la petición no es JSON válido.",
}


def problem_response(
    request: Request,
    *,
    status: int,
    code: str,
    title: str,
    detail: str | None,
    errors: list[dict[str, str]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "instance": request.url.path,
        "request_id": current_request_id(),
        "errors": errors,
    }
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def _status_for(error: domain.DomainError) -> tuple[int, str]:
    for error_type, status, title in _STATUS_BY_ERROR:
        if isinstance(error, error_type):
            return status, title
    return 400, "Solicitud no válida"


def _validation_message(error: dict[str, Any]) -> str:
    error_type = str(error.get("type", ""))
    message = str(error.get("msg", ""))
    if error_type == "value_error" and message.startswith("Value error, "):
        return message.removeprefix("Value error, ")
    return _VALIDATION_MESSAGES.get(error_type, "El valor no es válido.")


async def _domain_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, domain.DomainError)  # noqa: S101 - registered only for DomainError
    status, title = _status_for(exc)
    headers: dict[str, str] = {}
    retry_after = getattr(exc, "retry_after_seconds", None)
    if retry_after:
        headers["Retry-After"] = str(retry_after)
    errors = [{"field": e.field, "message": e.message} for e in exc.field_errors] or None
    if status >= 500:
        logger.warning("upstream_error", extra={"code": exc.code, "path": request.url.path})
    return problem_response(
        request,
        status=status,
        code=exc.code,
        title=title,
        detail=exc.detail,
        errors=errors,
        headers=headers or None,
    )


async def _validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101 - registered only for this type
    errors = []
    for error in exc.errors():
        location = [
            str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")
        ]
        errors.append(
            {"field": ".".join(location) or "body", "message": _validation_message(error)}
        )
    return problem_response(
        request,
        status=422,
        code="validation_error",
        title="Datos inválidos",
        detail="Revisa los campos marcados.",
        errors=errors,
    )


async def _http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)  # noqa: S101 - registered only for this type
    titles = {404: "Recurso no encontrado", 405: "Método no permitido"}
    codes = {404: "not_found", 405: "method_not_allowed"}
    return problem_response(
        request,
        status=exc.status_code,
        code=codes.get(exc.status_code, "http_error"),
        title=titles.get(exc.status_code, "Error"),
        detail=exc.detail if isinstance(exc.detail, str) and exc.status_code != 404 else None,
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error", extra={"path": request.url.path})
    return problem_response(
        request,
        status=500,
        code="internal_error",
        title="Error interno",
        detail="Ocurrió un error inesperado. Intenta de nuevo más tarde.",
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(domain.DomainError, _domain_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
