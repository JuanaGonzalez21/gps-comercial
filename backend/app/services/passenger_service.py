"""Passenger use cases (RF-08, RF-09, RF-27, RF-28). Wialon models passengers as resource tags.

Custom fields (Wialon `jp`) are always written as a complete dictionary: Wialon replaces `jp` as a
whole, so every operation reads the current passenger, merges the change into ALL of its fields and
sends the result. Editing the name never touches the custom fields and editing one field never
loses the others.
"""

from collections.abc import Mapping
from dataclasses import dataclass

from app.domain.errors import ConflictError, NotFoundError
from app.domain.fleet import Passenger, PassengerInput
from app.domain.ports import FleetGateway
from app.services.audit_service import AuditSink, CreationLog, audit_failures
from app.services.common import (
    NEWEST_FIRST,
    ResultPage,
    VehicleRef,
    changed_fields,
    entity_key,
    matches,
    newest_first_key,
    paginate,
    sort_key,
    vehicle_names,
    vehicle_ref,
)
from app.services.resource_service import ResourceService

PASSENGER_NOT_FOUND = "El pasajero no existe en Wialon o no es accesible."
FIELD_NOT_FOUND = "El campo personalizado no existe en este pasajero."
FIELD_TAKEN = "Ya existe un campo personalizado con esa clave en este pasajero."
_ENTITY = "passenger"


@dataclass(frozen=True, slots=True)
class PassengerView:
    passenger: Passenger
    vehicle: VehicleRef | None

    @property
    def custom_fields(self) -> list[tuple[str, str]]:
        return sorted_fields(self.passenger.custom_fields)


def sorted_fields(fields: Mapping[str, str]) -> list[tuple[str, str]]:
    return sorted(fields.items(), key=lambda item: (sort_key(item[0]), item[0]))


def _key_taken(fields: Mapping[str, str], key: str, *, ignore: str | None = None) -> bool:
    # Case-insensitive: "Empresa" and "empresa" side by side would only confuse users.
    return any(existing.casefold() == key.casefold() for existing in fields if existing != ignore)


def _editable(passenger: Passenger | PassengerInput) -> dict[str, object]:
    return {"name": passenger.name, "code": passenger.code, "phone": passenger.phone}


class PassengerService:
    def __init__(
        self,
        gateway: FleetGateway,
        audit: AuditSink,
        resources: ResourceService,
        creations: CreationLog | None = None,
    ) -> None:
        self._gateway = gateway
        self._audit = audit
        self._resources = resources
        self._creations = creations

    # ----- reads -------------------------------------------------------------------------
    def list_all(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        vehicle_id: int | None = None,
        sort: str = "name",
    ) -> list[PassengerView]:
        names = vehicle_names(self._gateway)
        views = [
            PassengerView(passenger=p, vehicle=vehicle_ref(p.unit_id, names))
            for p in self._gateway.list_passengers()
            if (assigned is None or (p.unit_id is not None) == assigned)
            and (vehicle_id is None or p.unit_id == vehicle_id)
            and matches(search, p.name, p.code, p.phone)
        ]
        if sort == NEWEST_FIRST:
            created = self._creations.created_at("passenger.created") if self._creations else {}
            views.sort(
                key=lambda v: newest_first_key(created, v.passenger.resource_id, v.passenger.id),
                reverse=True,
            )
            return views
        views.sort(
            key=lambda v: (sort_key(v.passenger.name), v.passenger.resource_id, v.passenger.id),
            reverse=sort.startswith("-"),
        )
        return views

    def search(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        vehicle_id: int | None = None,
        sort: str = "name",
        page: int = 1,
        page_size: int = 20,
    ) -> ResultPage[PassengerView]:
        views = self.list_all(search=search, assigned=assigned, vehicle_id=vehicle_id, sort=sort)
        return paginate(views, page, page_size)

    def get(self, resource_id: int, passenger_id: int) -> PassengerView:
        return self._view(self._find(resource_id, passenger_id))

    # ----- passenger writes --------------------------------------------------------------
    def create(self, data: PassengerInput, *, resource_id: int | None = None) -> PassengerView:
        details: dict[str, object] = {
            "name": data.name,
            "resource_id": resource_id,
            "custom_field_keys": sorted(data.custom_fields),
        }
        with audit_failures(
            self._audit, "passenger.created", entity_type=_ENTITY, entity_id=None, details=details
        ):
            rid = self._resources.resolve(resource_id)
            details["resource_id"] = rid
            self._ensure_unique_code(rid, data.code, own_id=None)
            passenger = self._gateway.create_passenger(rid, data)
        self._audit.record(
            "passenger.created",
            entity_type=_ENTITY,
            entity_id=entity_key(rid, passenger.id),
            details=details,
        )
        return self._view(passenger)

    def update(
        self, resource_id: int, passenger_id: int, *, name: str, code: str | None, phone: str | None
    ) -> PassengerView:
        """Basic data only. The current custom fields are re-sent untouched (RF-27)."""
        key = entity_key(resource_id, passenger_id)
        details: dict[str, object] = {"name": name}
        with audit_failures(
            self._audit, "passenger.updated", entity_type=_ENTITY, entity_id=key, details=details
        ):
            current = self._find_fresh(resource_id, passenger_id)
            data = PassengerInput(
                name=name, code=code, phone=phone, custom_fields=dict(current.custom_fields)
            )
            details["changed_fields"] = changed_fields(_editable(current), _editable(data))
            self._ensure_unique_code(resource_id, code, own_id=passenger_id)
            passenger = self._gateway.update_passenger(resource_id, passenger_id, data)
        self._audit.record("passenger.updated", entity_type=_ENTITY, entity_id=key, details=details)
        return self._view(passenger)

    def delete(self, resource_id: int, passenger_id: int) -> None:
        key = entity_key(resource_id, passenger_id)
        details: dict[str, object] = {}
        with audit_failures(
            self._audit, "passenger.deleted", entity_type=_ENTITY, entity_id=key, details=details
        ):
            current = self._find_fresh(resource_id, passenger_id)
            details["name"] = current.name
            self._gateway.delete_passenger(resource_id, passenger_id)
        self._audit.record("passenger.deleted", entity_type=_ENTITY, entity_id=key, details=details)

    def assign(self, resource_id: int, passenger_id: int, unit_id: int) -> PassengerView:
        key = entity_key(resource_id, passenger_id)
        details: dict[str, object] = {"unit_id": unit_id}
        with audit_failures(
            self._audit, "passenger.assigned", entity_type=_ENTITY, entity_id=key, details=details
        ):
            passenger = self._find_fresh(resource_id, passenger_id)
            unit = self._gateway.get_unit(unit_id)  # 404 if the vehicle does not exist
            if passenger.unit_id == unit_id:
                raise ConflictError("El pasajero ya está asignado a este vehículo.")
            details["unit_name"] = unit.name
            if passenger.unit_id is not None:
                # Reassignment: a tag is bound to one unit at a time. The current binding is
                # closed explicitly first (unbinding needs the bound unit), then the new one is
                # opened; both ids were validated above, before any write.
                details["previous_unit_id"] = passenger.unit_id
                self._gateway.unbind_passenger(resource_id, passenger_id)
            self._gateway.bind_passenger(resource_id, passenger_id, unit_id)
        self._audit.record(
            "passenger.assigned", entity_type=_ENTITY, entity_id=key, details=details
        )
        return self.get(resource_id, passenger_id)

    def unassign(self, resource_id: int, passenger_id: int) -> PassengerView:
        key = entity_key(resource_id, passenger_id)
        details: dict[str, object] = {}
        with audit_failures(
            self._audit,
            "passenger.unassigned",
            entity_type=_ENTITY,
            entity_id=key,
            details=details,
        ):
            passenger = self._find_fresh(resource_id, passenger_id)
            if passenger.unit_id is None:
                raise ConflictError("El pasajero no está asignado a ningún vehículo.")
            details["unit_id"] = passenger.unit_id
            self._gateway.unbind_passenger(resource_id, passenger_id)
        self._audit.record(
            "passenger.unassigned", entity_type=_ENTITY, entity_id=key, details=details
        )
        return self.get(resource_id, passenger_id)

    # ----- custom fields -----------------------------------------------------------------
    def custom_fields(self, resource_id: int, passenger_id: int) -> list[tuple[str, str]]:
        return sorted_fields(self._find(resource_id, passenger_id).custom_fields)

    def add_custom_field(
        self, resource_id: int, passenger_id: int, key: str, value: str
    ) -> tuple[str, str]:
        action = "passenger.custom_field.created"
        details: dict[str, object] = {"key": key}
        entity = entity_key(resource_id, passenger_id)
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=entity, details=details
        ):
            current = self._find_fresh(resource_id, passenger_id)
            if _key_taken(current.custom_fields, key):
                raise ConflictError(FIELD_TAKEN)
            self._save_fields(current, {**current.custom_fields, key: value})
        self._audit.record(action, entity_type=_ENTITY, entity_id=entity, details=details)
        return key, value

    def update_custom_field(
        self,
        resource_id: int,
        passenger_id: int,
        key: str,
        *,
        value: str,
        new_key: str | None = None,
    ) -> tuple[str, str]:
        """Changes the value and, with `new_key`, renames the field keeping its position."""
        action = "passenger.custom_field.updated"
        target = new_key or key
        details: dict[str, object] = {"key": key}
        entity = entity_key(resource_id, passenger_id)
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=entity, details=details
        ):
            current = self._find_fresh(resource_id, passenger_id)
            fields = current.custom_fields
            if key not in fields:
                raise NotFoundError(FIELD_NOT_FOUND)
            if target != key:
                details["new_key"] = target
                if _key_taken(fields, target, ignore=key):
                    raise ConflictError(FIELD_TAKEN)
            details["value_changed"] = fields[key] != value
            merged = {
                (target if k == key else k): (value if k == key else v) for k, v in fields.items()
            }
            self._save_fields(current, merged)
        self._audit.record(action, entity_type=_ENTITY, entity_id=entity, details=details)
        return target, value

    def delete_custom_field(self, resource_id: int, passenger_id: int, key: str) -> None:
        action = "passenger.custom_field.deleted"
        details: dict[str, object] = {"key": key}
        entity = entity_key(resource_id, passenger_id)
        with audit_failures(
            self._audit, action, entity_type=_ENTITY, entity_id=entity, details=details
        ):
            current = self._find_fresh(resource_id, passenger_id)
            if key not in current.custom_fields:
                raise NotFoundError(FIELD_NOT_FOUND)
            remaining = {k: v for k, v in current.custom_fields.items() if k != key}
            self._save_fields(current, remaining)
        self._audit.record(action, entity_type=_ENTITY, entity_id=entity, details=details)

    # ----- helpers -----------------------------------------------------------------------
    def _save_fields(self, current: Passenger, fields: dict[str, str]) -> Passenger:
        """Sends the passenger's own basic data plus the COMPLETE merged field set."""
        data = PassengerInput(
            name=current.name, code=current.code, phone=current.phone, custom_fields=fields
        )
        return self._gateway.update_passenger(current.resource_id, current.id, data)

    def _find_fresh(self, resource_id: int, passenger_id: int) -> Passenger:
        # Writes merge onto the current remote object: never start from a cached copy.
        self._gateway.refresh()
        return self._find(resource_id, passenger_id)

    def _find(self, resource_id: int, passenger_id: int) -> Passenger:
        for passenger in self._gateway.list_passengers():
            if passenger.resource_id == resource_id and passenger.id == passenger_id:
                return passenger
        raise NotFoundError(PASSENGER_NOT_FOUND)

    def _view(self, passenger: Passenger) -> PassengerView:
        names = vehicle_names(self._gateway) if passenger.unit_id is not None else {}
        return PassengerView(passenger=passenger, vehicle=vehicle_ref(passenger.unit_id, names))

    def _ensure_unique_code(
        self, resource_id: int, code: str | None, *, own_id: int | None
    ) -> None:
        if not code:
            return
        for other in self._gateway.list_passengers():
            same_resource = other.resource_id == resource_id and other.id != own_id
            if same_resource and (other.code or "").lower() == code.lower():
                raise ConflictError(
                    f"Ya existe un pasajero con el código «{code}» en este recurso."
                )
