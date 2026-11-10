"""Driver use cases (RF-16, RF-17, RF-18): CRUD and unit binding, persisted in Wialon.

Every write leaves an audit entry: `success` after Wialon confirms it, or `failure` with the error
code when the gateway (or a rule checked here) refuses it.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.errors import ConflictError, NotFoundError
from app.domain.fleet import Driver, DriverInput
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

DRIVER_NOT_FOUND = "El conductor no existe en Wialon o no es accesible."
_ENTITY = "driver"


@dataclass(frozen=True, slots=True)
class DriverView:
    driver: Driver
    vehicle: VehicleRef | None


def _editable(driver: Driver | DriverInput) -> dict[str, object]:
    return {
        "name": driver.name,
        "code": driver.code,
        "phone": driver.phone,
        "description": driver.description,
    }


class DriverService:
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
        self, *, search: str | None = None, assigned: bool | None = None, sort: str = "name"
    ) -> list[DriverView]:
        names = vehicle_names(self._gateway)
        views = [
            DriverView(driver=d, vehicle=vehicle_ref(d.unit_id, names))
            for d in self._gateway.list_drivers()
            if (assigned is None or (d.unit_id is not None) == assigned)
            and matches(search, d.name, d.code, d.phone)
        ]
        if sort == NEWEST_FIRST:
            created = self._creations.created_at("driver.created") if self._creations else {}
            views.sort(
                key=lambda v: newest_first_key(created, v.driver.resource_id, v.driver.id),
                reverse=True,
            )
            return views
        views.sort(
            key=lambda v: (sort_key(v.driver.name), v.driver.resource_id, v.driver.id),
            reverse=sort.startswith("-"),
        )
        return views

    def search(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        sort: str = "name",
        page: int = 1,
        page_size: int = 20,
    ) -> ResultPage[DriverView]:
        return paginate(self.list_all(search=search, assigned=assigned, sort=sort), page, page_size)

    def get(self, resource_id: int, driver_id: int) -> DriverView:
        return self._view(self._find(resource_id, driver_id))

    # ----- writes ------------------------------------------------------------------------
    def create(self, data: DriverInput, *, resource_id: int | None = None) -> DriverView:
        details: dict[str, object] = {"name": data.name, "resource_id": resource_id}
        with audit_failures(
            self._audit, "driver.created", entity_type=_ENTITY, entity_id=None, details=details
        ):
            rid = self._resources.resolve(resource_id)
            details["resource_id"] = rid
            self._ensure_unique_code(rid, data.code, own_id=None)
            driver = self._gateway.create_driver(rid, data)
        self._audit.record(
            "driver.created",
            entity_type=_ENTITY,
            entity_id=entity_key(rid, driver.id),
            details=details,
        )
        return self._view(driver)

    def update(self, resource_id: int, driver_id: int, data: DriverInput) -> DriverView:
        key = entity_key(resource_id, driver_id)
        details: dict[str, object] = {"name": data.name}
        with audit_failures(
            self._audit, "driver.updated", entity_type=_ENTITY, entity_id=key, details=details
        ):
            current = self._find_fresh(resource_id, driver_id)
            details["changed_fields"] = changed_fields(_editable(current), _editable(data))
            self._ensure_unique_code(resource_id, data.code, own_id=driver_id)
            # The gateway re-sends every remote attribute it does not edit (jp, ej, ck...).
            driver = self._gateway.update_driver(resource_id, driver_id, data)
        self._audit.record("driver.updated", entity_type=_ENTITY, entity_id=key, details=details)
        return self._view(driver)

    def delete(self, resource_id: int, driver_id: int) -> None:
        key = entity_key(resource_id, driver_id)
        details: dict[str, object] = {}
        with audit_failures(
            self._audit, "driver.deleted", entity_type=_ENTITY, entity_id=key, details=details
        ):
            current = self._find_fresh(resource_id, driver_id)
            details["name"] = current.name
            self._gateway.delete_driver(resource_id, driver_id)
        self._audit.record("driver.deleted", entity_type=_ENTITY, entity_id=key, details=details)

    def assign(self, resource_id: int, driver_id: int, unit_id: int) -> DriverView:
        key = entity_key(resource_id, driver_id)
        details: dict[str, object] = {"unit_id": unit_id}
        with audit_failures(
            self._audit, "driver.assigned", entity_type=_ENTITY, entity_id=key, details=details
        ):
            driver = self._find_fresh(resource_id, driver_id)
            unit = self._gateway.get_unit(unit_id)  # 404 if the vehicle does not exist
            if driver.unit_id == unit_id:
                raise ConflictError("El conductor ya está asignado a este vehículo.")
            details["unit_name"] = unit.name
            if driver.unit_id is not None:
                # Reassignment. A driver is bound to one unit at a time: the current binding is
                # closed explicitly first (Wialon needs the bound unit to unbind), so the
                # platform's history shows "unbound from A, bound to B" instead of relying on
                # implicit behaviour. Both units were validated above, before any write.
                details["previous_unit_id"] = driver.unit_id
                self._gateway.unbind_driver(resource_id, driver_id)
            self._gateway.bind_driver(resource_id, driver_id, unit_id)
        self._audit.record("driver.assigned", entity_type=_ENTITY, entity_id=key, details=details)
        return self.get(resource_id, driver_id)

    def unassign(self, resource_id: int, driver_id: int) -> DriverView:
        key = entity_key(resource_id, driver_id)
        details: dict[str, object] = {}
        with audit_failures(
            self._audit, "driver.unassigned", entity_type=_ENTITY, entity_id=key, details=details
        ):
            driver = self._find_fresh(resource_id, driver_id)
            if driver.unit_id is None:
                raise ConflictError("El conductor no está asignado a ningún vehículo.")
            details["unit_id"] = driver.unit_id
            self._gateway.unbind_driver(resource_id, driver_id)
        self._audit.record("driver.unassigned", entity_type=_ENTITY, entity_id=key, details=details)
        return self.get(resource_id, driver_id)

    # ----- helpers -----------------------------------------------------------------------
    def _find_fresh(self, resource_id: int, driver_id: int) -> Driver:
        # Writes merge onto the current remote object: never start from a cached copy.
        self._gateway.refresh()
        return self._find(resource_id, driver_id)

    def _find(self, resource_id: int, driver_id: int) -> Driver:
        for driver in self._gateway.list_drivers():
            if driver.resource_id == resource_id and driver.id == driver_id:
                return driver
        raise NotFoundError(DRIVER_NOT_FOUND)

    def _view(self, driver: Driver) -> DriverView:
        names = vehicle_names(self._gateway) if driver.unit_id is not None else {}
        return DriverView(driver=driver, vehicle=vehicle_ref(driver.unit_id, names))

    def _ensure_unique_code(
        self, resource_id: int, code: str | None, *, own_id: int | None
    ) -> None:
        """RF-18 duplicates: checked before calling Wialon so the user gets a clear message."""
        if not code:
            return
        drivers: Sequence[Driver] = self._gateway.list_drivers()
        for other in drivers:
            same_resource = other.resource_id == resource_id and other.id != own_id
            if same_resource and (other.code or "").lower() == code.lower():
                raise ConflictError(
                    f"Ya existe un conductor con el código «{code}» en este recurso."
                )
