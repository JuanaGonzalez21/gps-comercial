"""Audit trail (RF-26): who did what, when, and with which outcome."""

from typing import Any

from sqlalchemy.orm import Session

from app.infrastructure.db.models import AuditLog, User
from app.infrastructure.db.repositories import AuditRepository

_SENSITIVE_MARKERS = ("password", "token", "secret", "cookie", "sid", "authorization")


def _sanitize(details: dict[str, Any] | None) -> dict[str, Any] | None:
    if not details:
        return None
    clean: dict[str, Any] = {}
    for key, value in details.items():
        if any(marker in key.lower() for marker in _SENSITIVE_MARKERS):
            continue
        if isinstance(value, dict):
            value = _sanitize(value)
        elif isinstance(value, str):
            value = value[:500]
        clean[key] = value
    return clean


class AuditService:
    def __init__(self, db: Session) -> None:
        self._repository = AuditRepository(db)

    def record(
        self,
        action: str,
        *,
        outcome: str = "success",
        actor: User | None = None,
        actor_email: str | None = None,
        entity_type: str | None = None,
        entity_id: str | int | None = None,
        ip_address: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Adds the entry to the current unit of work; the caller commits."""
        self._repository.add(
            AuditLog(
                actor_user_id=actor.id if actor else None,
                actor_email=(actor.email if actor else actor_email or None),
                action=action,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id is not None else None,
                outcome=outcome,
                ip_address=ip_address,
                details=_sanitize(details),
            )
        )
