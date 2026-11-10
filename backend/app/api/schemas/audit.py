"""Audit log contract (RF-26)."""

from typing import Any, Literal

from pydantic import BaseModel

from app.api.schemas.common import UtcDateTime
from app.infrastructure.db.models import AuditLog

AuditOutcome = Literal["success", "failure"]


class AuditLogOut(BaseModel):
    id: int
    occurred_at: UtcDateTime
    actor_email: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    outcome: str
    ip_address: str | None
    details: dict[str, Any] | None

    @classmethod
    def from_entry(cls, entry: AuditLog) -> "AuditLogOut":
        return cls(
            id=entry.id,
            occurred_at=entry.occurred_at,
            actor_email=entry.actor_email,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            outcome=entry.outcome,
            ip_address=entry.ip_address,
            details=entry.details,
        )
