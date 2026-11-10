"""Custom fields of a vehicle (RF-19, RF-22), stored in Wialon (`flds` of the unit)."""

from app.domain.errors import ConflictError, NotFoundError
from app.domain.fleet import CustomField
from app.domain.ports import FleetGateway
from app.services.audit_service import AuditSink, audit_failures

FIELD_NOT_FOUND = "El campo personalizado no existe en este vehículo."
NAME_TAKEN = "Ya existe un campo con ese nombre en este vehículo."
EDIT_CONFLICT = (
    "El campo cambió en Wialon mientras lo editabas. Recarga para ver el valor actual "
    "y vuelve a intentarlo."
)
_ENTITY = "vehicle"


class VehicleCustomFieldService:
    def __init__(self, gateway: FleetGateway, audit: AuditSink) -> None:
        self._gateway = gateway
        self._audit = audit

    def list_fields(self, unit_id: int) -> list[CustomField]:
        return sorted(self._gateway.get_unit(unit_id).custom_fields, key=lambda f: f.id)

    def create(self, unit_id: int, name: str, value: str) -> CustomField:
        action = "vehicle.custom_field.created"
        details: dict[str, object] = {"name": name}
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=unit_id, details=details
        ):
            self._ensure_unique_name(self.list_fields(unit_id), name, own_id=None)
            field = self._gateway.create_unit_custom_field(unit_id, name, value)
            details["field_id"] = field.id
        self._audit.record(action, entity_type=_ENTITY, entity_id=unit_id, details=details)
        return field

    def update(
        self,
        unit_id: int,
        field_id: int,
        name: str,
        value: str,
        *,
        expected_value: str | None = None,
    ) -> CustomField:
        """`expected_value` is the value the user started editing from (optimistic concurrency):
        if Wialon already holds something else, the edit is refused with 409 instead of silently
        overwriting a change made elsewhere (RF-22)."""
        action = "vehicle.custom_field.updated"
        details: dict[str, object] = {"field_id": field_id, "name": name}
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=unit_id, details=details
        ):
            fields = self.list_fields(unit_id)
            current = self._field(fields, field_id)
            if expected_value is not None and current.value != expected_value:
                raise ConflictError(EDIT_CONFLICT)
            self._ensure_unique_name(fields, name, own_id=field_id)
            details["changed_fields"] = [
                attribute
                for attribute, before, after in (
                    ("name", current.name, name),
                    ("value", current.value, value),
                )
                if before != after
            ]
            field = self._gateway.update_unit_custom_field(unit_id, field_id, name, value)
        self._audit.record(action, entity_type=_ENTITY, entity_id=unit_id, details=details)
        return field

    def delete(self, unit_id: int, field_id: int) -> None:
        action = "vehicle.custom_field.deleted"
        details: dict[str, object] = {"field_id": field_id}
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=unit_id, details=details
        ):
            current = self._field(self.list_fields(unit_id), field_id)
            details["name"] = current.name
            self._gateway.delete_unit_custom_field(unit_id, field_id)
        self._audit.record(action, entity_type=_ENTITY, entity_id=unit_id, details=details)

    @staticmethod
    def _field(fields: list[CustomField], field_id: int) -> CustomField:
        for field in fields:
            if field.id == field_id:
                return field
        raise NotFoundError(FIELD_NOT_FOUND)

    @staticmethod
    def _ensure_unique_name(fields: list[CustomField], name: str, *, own_id: int | None) -> None:
        if any(f.name.casefold() == name.casefold() and f.id != own_id for f in fields):
            raise ConflictError(NAME_TAKEN)
