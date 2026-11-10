"""Audit trail (RF-26): who did what, when, and with which outcome."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.domain.errors import DomainError
from app.infrastructure.db.models import AuditLog, User
from app.infrastructure.db.repositories import AuditRepository, PageSlice

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

    def search(
        self,
        *,
        action: str | None = None,
        actor: str | None = None,
        outcome: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PageSlice[AuditLog]:
        return self._repository.search(
            action=action,
            actor=actor,
            outcome=outcome,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )


class AuditSink(Protocol):
    """What fleet use cases need to leave a trace; the actor and origin are already bound."""

    def record(
        self,
        action: str,
        *,
        outcome: str = "success",
        entity_type: str | None = None,
        entity_id: str | int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None: ...


class RequestAuditTrail:
    """AuditSink bound to the user and IP of one request.

    Every entry is committed at once: the change it describes already happened (or failed) in
    Wialon, outside our database transaction, so the trace must survive whatever happens next.
    """

    def __init__(self, db: Session, *, actor: User | None, ip_address: str | None) -> None:
        self._db = db
        self._service = AuditService(db)
        self._actor = actor
        self._ip_address = ip_address

    def record(
        self,
        action: str,
        *,
        outcome: str = "success",
        entity_type: str | None = None,
        entity_id: str | int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self._service.record(
            action,
            outcome=outcome,
            actor=self._actor,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=self._ip_address,
            details=details,
        )
        self._db.commit()


@contextmanager
def audit_failures(
    audit: AuditSink,
    action: str,
    *,
    entity_type: str,
    entity_id: str | int | None,
    details: dict[str, Any] | None = None,
) -> Iterator[None]:
    """Records a failed attempt (with the error code) and re-raises the original domain error."""
    try:
        yield
    except DomainError as error:
        audit.record(
            action,
            outcome="failure",
            entity_type=entity_type,
            entity_id=entity_id,
            details={**(details or {}), "code": error.code},
        )
        raise
