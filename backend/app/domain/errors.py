"""Domain errors.

Services and adapters raise these; the API layer (app/core/errors.py) translates each class into an
RFC 7807 Problem Details response. Messages in `detail` are user-facing (es-CO) and must never
contain secrets, Wialon session ids or raw upstream payloads.
"""

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FieldError:
    field: str
    message: str


class DomainError(Exception):
    code = "domain_error"

    def __init__(self, detail: str, *, field_errors: Sequence[FieldError] = ()) -> None:
        super().__init__(detail)
        self.detail = detail
        self.field_errors = tuple(field_errors)


class NotFoundError(DomainError):
    code = "not_found"


class ConflictError(DomainError):
    code = "conflict"


class InvalidInputError(DomainError):
    code = "validation_error"


class AuthenticationError(DomainError):
    code = "not_authenticated"


class InvalidCredentialsError(AuthenticationError):
    code = "invalid_credentials"


class PermissionDeniedError(DomainError):
    code = "forbidden"


class PasswordChangeRequiredError(PermissionDeniedError):
    code = "password_change_required"


class CsrfError(PermissionDeniedError):
    code = "csrf_failed"


class RateLimitedError(DomainError):
    code = "rate_limited"

    def __init__(self, detail: str, *, retry_after_seconds: int) -> None:
        super().__init__(detail)
        self.retry_after_seconds = retry_after_seconds


class UpstreamError(DomainError):
    """The fleet platform (Wialon) answered with an error we cannot translate more precisely."""

    code = "upstream_error"


class UpstreamForbiddenError(UpstreamError):
    """The configured fleet account lacks the access rights for the operation."""

    code = "upstream_forbidden"


class UpstreamUnavailableError(UpstreamError):
    """Timeout, connection failure or the platform is temporarily unavailable."""

    code = "upstream_unavailable"

    def __init__(self, detail: str, *, retry_after_seconds: int | None = None) -> None:
        super().__init__(detail)
        self.retry_after_seconds = retry_after_seconds


class UpstreamNotConfiguredError(UpstreamUnavailableError):
    """WIALON_TOKEN (or other required integration settings) is missing."""

    code = "upstream_not_configured"
