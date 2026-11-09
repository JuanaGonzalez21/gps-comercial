"""Translation of Wialon error codes (errors/errors) into domain errors."""

from app.domain import errors as domain

INVALID_SESSION_CODES = frozenset({1, 1011})
CONCURRENCY_CODES = frozenset({10, 1003})
NO_MESSAGES = 1001


class WialonApiError(Exception):
    """Raw error answered by Wialon; never leaves the adapter."""

    def __init__(self, code: int, svc: str) -> None:
        super().__init__(f"Wialon error {code} in {svc}")
        self.code = code
        self.svc = svc


def to_domain_error(error: WialonApiError) -> domain.DomainError:
    code = error.code
    if code == 4:
        return domain.InvalidInputError("Wialon rechazó los datos enviados. Revisa los campos.")
    if code == 7:
        return domain.UpstreamForbiddenError(
            "La cuenta de Wialon no tiene permiso para realizar esta operación."
        )
    if code == 1002:
        return domain.ConflictError("Ya existe un elemento con ese valor único en Wialon.")
    if code in CONCURRENCY_CODES:
        return domain.UpstreamUnavailableError(
            "Wialon está procesando otras solicitudes. Intenta de nuevo en unos segundos.",
            retry_after_seconds=5,
        )
    if code in INVALID_SESSION_CODES:
        return domain.UpstreamUnavailableError("No fue posible mantener la sesión con Wialon.")
    if code in (1004, 1005):
        return domain.UpstreamError(
            "La consulta supera los límites de Wialon. Reduce el rango de fechas."
        )
    return domain.UpstreamError("Wialon no pudo completar la operación.")


def login_error(code: int) -> domain.DomainError:
    if code == 9:
        return domain.UpstreamUnavailableError(
            "El servidor de autorización de Wialon no está disponible.", retry_after_seconds=30
        )
    return domain.UpstreamNotConfiguredError(
        "No fue posible autenticar con Wialon: el token es inválido o venció."
    )
