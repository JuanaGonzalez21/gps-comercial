"""Shared HTTP schema pieces: UTC timestamps, pagination envelope, Problem Details."""

import math
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, PlainSerializer


def _iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


# ISO-8601 in UTC with "Z" suffix, as the contract requires for every timestamp.
UtcDateTime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str, when_used="json")]


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: Sequence[T], *, total: int, page: int, page_size: int) -> "Page[T]":
        return cls(
            items=list(items),
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )


class FieldErrorOut(BaseModel):
    field: str
    message: str


class ProblemOut(BaseModel):
    """RFC 7807 Problem Details (documented in OpenAPI for error responses)."""

    type: str
    title: str
    status: int
    detail: str | None
    code: str
    instance: str | None = None
    request_id: str | None = None
    errors: list[FieldErrorOut] | None = None


PROBLEM_RESPONSES: dict[int | str, dict[str, object]] = {
    status: {"model": ProblemOut, "description": description}
    for status, description in {
        401: "Sesión ausente o vencida",
        403: "Sin permiso, cambio de contraseña pendiente o CSRF inválido",
        422: "Datos inválidos",
        502: "Error de Wialon",
        503: "Wialon no disponible o no configurado",
    }.items()
}
