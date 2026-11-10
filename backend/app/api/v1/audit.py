"""Audit log (RF-26, SEG-09). Read-only; only `audit:read` (Admin in the default matrix)."""

from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime

from app.api.deps import get_audit_service, require_permission
from app.api.schemas.audit import AuditLogOut, AuditOutcome
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.domain.errors import FieldError, InvalidInputError
from app.domain.permissions import Permission
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit-logs", tags=["audit"], responses=PROBLEM_RESPONSES)


@router.get(
    "",
    response_model=Page[AuditLogOut],
    dependencies=[Depends(require_permission(Permission.AUDIT_READ))],
    summary="Registro de auditoría (más reciente primero)",
)
def list_audit_logs(
    action: str | None = Query(default=None, max_length=64, description="Prefijo de la acción"),
    actor: str | None = Query(default=None, max_length=254, description="Parte del correo"),
    outcome: AuditOutcome | None = None,
    date_from: AwareDatetime | None = None,
    date_to: AwareDatetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: AuditService = Depends(get_audit_service),
) -> Page[AuditLogOut]:
    if date_from and date_to and date_from > date_to:
        message = "La fecha final debe ser posterior a la inicial."
        raise InvalidInputError(message, field_errors=[FieldError("date_to", message)])
    result = service.search(
        action=action,
        actor=actor,
        outcome=outcome,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    items = [AuditLogOut.from_entry(entry) for entry in result.items]
    return Page.build(items, total=result.total, page=page, page_size=page_size)
