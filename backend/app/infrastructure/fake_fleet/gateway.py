"""FakeFleetGateway: deterministic, in-memory implementation of the FleetGateway port.

It mimics the Wialon semantics the services rely on (drivers/passengers inside resources, one bound
unit per driver/passenger, custom fields, NotFound/Conflict errors) so services and endpoints can be
tested without network. Data is SIMULATED and the API exposes that through /api/v1/system/info.
"""

import math
import threading
from collections.abc import Callable, Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta

from app.domain.errors import ConflictError, NotFoundError
from app.domain.fleet import (
    CustomField,
    Driver,
    DriverInput,
    Passenger,
    PassengerInput,
    Position,
    Resource,
    Track,
    TrackPoint,
    Unit,
)

_BOGOTA = (4.6533, -74.0836)


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


class FakeFleetGateway:
    def __init__(self, *, clock: Callable[[], datetime] = _utcnow, vehicles: int = 24) -> None:
        self._lock = threading.Lock()
        self._clock = clock
        now = clock()
        self._resources = [
            Resource(id=1000, name="Flota simulada"),
            Resource(id=1001, name="Apoyo"),
        ]
        self._units: dict[int, Unit] = {}
        for index in range(vehicles):
            unit_id = 100 + index
            # Deterministic spread: a third moving, a third stopped, a third without signal.
            kind = index % 3
            age = timedelta(minutes=2 if kind < 2 else 600 + index)
            speed = 30.0 + index if kind == 0 else 0.0
            angle = index * 2 * math.pi / max(vehicles, 1)
            position = Position(
                latitude=round(_BOGOTA[0] + 0.05 * math.sin(angle), 6),
                longitude=round(_BOGOTA[1] + 0.05 * math.cos(angle), 6),
                recorded_at=now - age,
                speed_kmh=speed,
                course_deg=(index * 37) % 360,
                altitude_m=2600.0,
                satellites=9,
            )
            fields = (CustomField(id=1, name="Placa", value=f"SIM{index:03d}"),)
            self._units[unit_id] = Unit(
                id=unit_id,
                name=f"Vehículo simulado {index + 1:02d}",
                last_message_at=position.recorded_at,
                position=position,
                custom_fields=fields,
            )
        self._drivers: dict[tuple[int, int], Driver] = {}
        for index in range(10):
            unit_id = 100 + index if index < 8 else None
            driver = Driver(
                resource_id=1000,
                id=index + 1,
                name=f"Conductor simulado {index + 1:02d}",
                code=f"C{index + 1:03d}",
                phone=f"+57300000{index:04d}",
                unit_id=unit_id,
            )
            self._drivers[(driver.resource_id, driver.id)] = driver
        self._passengers: dict[tuple[int, int], Passenger] = {}
        for index in range(15):
            passenger = Passenger(
                resource_id=1000,
                id=index + 1,
                name=f"Pasajero simulado {index + 1:02d}",
                code=f"P{index + 1:03d}",
                phone=None,
                unit_id=100 + (index % 6) if index < 12 else None,
                custom_fields={"Empresa": "Simulada"} if index % 2 == 0 else {},
            )
            self._passengers[(passenger.resource_id, passenger.id)] = passenger
        self._next_id = 10_000

    def _new_id(self) -> int:
        self._next_id += 1
        return self._next_id

    def close(self) -> None:
        return None

    def refresh(self) -> None:
        return None  # in-memory data is always current

    # ----- units -------------------------------------------------------------------------
    def list_units(self) -> Sequence[Unit]:
        with self._lock:
            return list(self._units.values())

    def get_unit(self, unit_id: int) -> Unit:
        with self._lock:
            return self._unit(unit_id)

    def _unit(self, unit_id: int) -> Unit:
        unit = self._units.get(unit_id)
        if unit is None:
            raise NotFoundError("El vehículo no existe o no es accesible.")
        return unit

    # ----- resources ---------------------------------------------------------------------
    def list_resources(self) -> Sequence[Resource]:
        return list(self._resources)

    def _require_resource(self, resource_id: int) -> None:
        if not any(r.id == resource_id for r in self._resources):
            raise NotFoundError("El recurso de Wialon no existe o no es accesible.")

    # ----- drivers -----------------------------------------------------------------------
    def list_drivers(self) -> Sequence[Driver]:
        with self._lock:
            return list(self._drivers.values())

    def _driver(self, resource_id: int, driver_id: int) -> Driver:
        driver = self._drivers.get((resource_id, driver_id))
        if driver is None:
            raise NotFoundError("El conductor no existe en Wialon o no es accesible.")
        return driver

    def _check_unique_code(
        self,
        items: Sequence[Driver | Passenger],
        code: str | None,
        resource_id: int,
        own_id: int | None,
    ) -> None:
        if not code:
            return
        for item in items:
            same = item.resource_id == resource_id and item.id != own_id
            if same and (item.code or "").lower() == code.lower():
                raise ConflictError("Ya existe un elemento con ese valor único en Wialon.")

    def create_driver(self, resource_id: int, data: DriverInput) -> Driver:
        with self._lock:
            self._require_resource(resource_id)
            self._check_unique_code(list(self._drivers.values()), data.code, resource_id, None)
            driver = Driver(
                resource_id=resource_id,
                id=self._new_id(),
                name=data.name,
                code=data.code,
                phone=data.phone,
                description=data.description,
            )
            self._drivers[(resource_id, driver.id)] = driver
            return driver

    def update_driver(self, resource_id: int, driver_id: int, data: DriverInput) -> Driver:
        with self._lock:
            current = self._driver(resource_id, driver_id)
            self._check_unique_code(list(self._drivers.values()), data.code, resource_id, driver_id)
            updated = replace(
                current,
                name=data.name,
                code=data.code,
                phone=data.phone,
                description=data.description,
            )
            self._drivers[(resource_id, driver_id)] = updated
            return updated

    def delete_driver(self, resource_id: int, driver_id: int) -> None:
        with self._lock:
            self._driver(resource_id, driver_id)
            del self._drivers[(resource_id, driver_id)]

    def bind_driver(self, resource_id: int, driver_id: int, unit_id: int) -> None:
        with self._lock:
            current = self._driver(resource_id, driver_id)
            self._unit(unit_id)
            self._drivers[(resource_id, driver_id)] = replace(current, unit_id=unit_id)

    def unbind_driver(self, resource_id: int, driver_id: int) -> None:
        with self._lock:
            current = self._driver(resource_id, driver_id)
            if current.unit_id is None:
                raise ConflictError("El conductor no está vinculado a ningún vehículo.")
            self._drivers[(resource_id, driver_id)] = replace(current, unit_id=None)

    # ----- passengers --------------------------------------------------------------------
    def list_passengers(self) -> Sequence[Passenger]:
        with self._lock:
            return list(self._passengers.values())

    def _passenger(self, resource_id: int, passenger_id: int) -> Passenger:
        passenger = self._passengers.get((resource_id, passenger_id))
        if passenger is None:
            raise NotFoundError("El pasajero no existe en Wialon o no es accesible.")
        return passenger

    def create_passenger(self, resource_id: int, data: PassengerInput) -> Passenger:
        with self._lock:
            self._require_resource(resource_id)
            self._check_unique_code(list(self._passengers.values()), data.code, resource_id, None)
            passenger = Passenger(
                resource_id=resource_id,
                id=self._new_id(),
                name=data.name,
                code=data.code,
                phone=data.phone,
                custom_fields=dict(data.custom_fields),
            )
            self._passengers[(resource_id, passenger.id)] = passenger
            return passenger

    def update_passenger(
        self, resource_id: int, passenger_id: int, data: PassengerInput
    ) -> Passenger:
        with self._lock:
            current = self._passenger(resource_id, passenger_id)
            self._check_unique_code(
                list(self._passengers.values()), data.code, resource_id, passenger_id
            )
            updated = replace(
                current,
                name=data.name,
                code=data.code,
                phone=data.phone,
                custom_fields=dict(data.custom_fields),
            )
            self._passengers[(resource_id, passenger_id)] = updated
            return updated

    def delete_passenger(self, resource_id: int, passenger_id: int) -> None:
        with self._lock:
            self._passenger(resource_id, passenger_id)
            del self._passengers[(resource_id, passenger_id)]

    def bind_passenger(self, resource_id: int, passenger_id: int, unit_id: int) -> None:
        with self._lock:
            current = self._passenger(resource_id, passenger_id)
            self._unit(unit_id)
            self._passengers[(resource_id, passenger_id)] = replace(current, unit_id=unit_id)

    def unbind_passenger(self, resource_id: int, passenger_id: int) -> None:
        with self._lock:
            current = self._passenger(resource_id, passenger_id)
            if current.unit_id is None:
                raise ConflictError("El pasajero no está asignado a ningún vehículo.")
            self._passengers[(resource_id, passenger_id)] = replace(current, unit_id=None)

    # ----- unit custom fields -----------------------------------------------------------
    def create_unit_custom_field(self, unit_id: int, name: str, value: str) -> CustomField:
        with self._lock:
            unit = self._unit(unit_id)
            field = CustomField(
                id=max((f.id for f in unit.custom_fields), default=0) + 1, name=name, value=value
            )
            self._units[unit_id] = replace(unit, custom_fields=(*unit.custom_fields, field))
            return field

    def update_unit_custom_field(
        self, unit_id: int, field_id: int, name: str, value: str
    ) -> CustomField:
        with self._lock:
            unit = self._unit(unit_id)
            if not any(f.id == field_id for f in unit.custom_fields):
                raise NotFoundError("El campo personalizado no existe en este vehículo.")
            field = CustomField(id=field_id, name=name, value=value)
            fields = tuple(field if f.id == field_id else f for f in unit.custom_fields)
            self._units[unit_id] = replace(unit, custom_fields=fields)
            return field

    def delete_unit_custom_field(self, unit_id: int, field_id: int) -> None:
        with self._lock:
            unit = self._unit(unit_id)
            if not any(f.id == field_id for f in unit.custom_fields):
                raise NotFoundError("El campo personalizado no existe en este vehículo.")
            fields = tuple(f for f in unit.custom_fields if f.id != field_id)
            self._units[unit_id] = replace(unit, custom_fields=fields)

    # ----- history -----------------------------------------------------------------------
    def load_track(
        self, unit_id: int, time_from: datetime, time_to: datetime, *, max_points: int
    ) -> Track:
        unit = self.get_unit(unit_id)
        base = unit.position
        if base is None:
            return Track(unit_id=unit_id, points=())
        step = timedelta(minutes=1)
        total = max(0, int((time_to - time_from) / step) + 1)
        points = []
        for i in range(min(total, max_points)):
            angle = i / 30
            points.append(
                TrackPoint(
                    recorded_at=time_from + i * step,
                    latitude=round(base.latitude + 0.01 * math.sin(angle), 6),
                    longitude=round(base.longitude + 0.01 * math.cos(angle) + i * 0.0002, 6),
                    speed_kmh=float(20 + (i * 7) % 50),
                    course_deg=(i * 11) % 360,
                )
            )
        return Track(unit_id=unit_id, points=tuple(points), truncated=total > max_points)
