"""Reusable validated field types for request bodies (RF-18, RF-28, SEG-03).

Text is trimmed before its length is checked; optional text that is blank becomes None, so an
empty input never reaches Wialon as "" and the API answers `null` for missing data. Error messages
are Spanish (see app/core/errors.py); custom validators raise ValueError with the final message.
"""

import re
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, Field, StringConstraints

PHONE_PATTERN = r"^\+?[0-9 ()-]{7,20}$"
_PHONE_RE = re.compile(PHONE_PATTERN)


def _blank_to_none(value: str | None) -> str | None:
    return value or None


def _phone(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    if not _PHONE_RE.fullmatch(text):
        raise ValueError(
            "Ingresa un teléfono válido: de 7 a 20 dígitos, espacios, paréntesis o guiones, "
            "con + inicial opcional."
        )
    return text


def _email(value: str) -> str:
    normalized = value.strip().lower()
    try:
        validate_email(normalized, check_deliverability=False)
    except EmailNotValidError as error:
        raise ValueError("Ingresa un correo electrónico válido.") from error
    return normalized


def _trimmed(max_length: int, *, required: bool) -> StringConstraints:
    return StringConstraints(
        strip_whitespace=True, min_length=1 if required else None, max_length=max_length
    )


# Driver and passenger names (Wialon `n`).
EntityName = Annotated[str, _trimmed(50, required=True)]
OptionalCode = Annotated[
    Annotated[str, _trimmed(30, required=False)] | None,
    AfterValidator(_blank_to_none),
    Field(description="Opcional, máximo 30 caracteres, único dentro del recurso."),
]
OptionalDescription = Annotated[
    Annotated[str, _trimmed(255, required=False)] | None,
    AfterValidator(_blank_to_none),
]
OptionalPhone = Annotated[
    str | None,
    AfterValidator(_phone),
    Field(description=f"Opcional. Formato {PHONE_PATTERN}", examples=["+57 300 123 4567"]),
]

# Custom fields: passenger keys and vehicle field names 1-50, values up to 255.
CustomFieldKey = Annotated[str, _trimmed(50, required=True)]
CustomFieldValue = Annotated[str, _trimmed(255, required=False)]

Email = Annotated[str, StringConstraints(max_length=254), AfterValidator(_email)]
FullName = Annotated[str, _trimmed(120, required=True)]
RoleCodeText = Annotated[str, _trimmed(32, required=True)]
