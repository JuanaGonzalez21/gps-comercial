"""Ports: interfaces the domain needs from the outside world.

`FleetGateway` is implemented by the Wialon adapter (app/infrastructure/wialon/gateway.py) and by
an in-memory fake (app/infrastructure/fake_fleet/gateway.py) used in tests and local demo mode.
Services depend on this Protocol only, so the telemetry platform can be swapped or mocked
(Dependency Inversion).

Every method raises app.domain.errors subclasses: NotFoundError, ConflictError, InvalidInputError,
UpstreamError, UpstreamForbiddenError, UpstreamUnavailableError or UpstreamNotConfiguredError.
"""

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from app.domain.fleet import (
    CustomField,
    Driver,
    DriverInput,
    Passenger,
    PassengerInput,
    Resource,
    Track,
    Unit,
)


class FleetGateway(Protocol):
    # --- Units (vehicles) ---
    def list_units(self) -> Sequence[Unit]: ...

    def get_unit(self, unit_id: int) -> Unit: ...

    # --- Resources ---
    def list_resources(self) -> Sequence[Resource]: ...

    # --- Drivers ---
    def list_drivers(self) -> Sequence[Driver]: ...

    def create_driver(self, resource_id: int, data: DriverInput) -> Driver: ...

    def update_driver(self, resource_id: int, driver_id: int, data: DriverInput) -> Driver: ...

    def delete_driver(self, resource_id: int, driver_id: int) -> None: ...

    def bind_driver(self, resource_id: int, driver_id: int, unit_id: int) -> None: ...

    def unbind_driver(self, resource_id: int, driver_id: int) -> None: ...

    # --- Passengers (Wialon tags) ---
    def list_passengers(self) -> Sequence[Passenger]: ...

    def create_passenger(self, resource_id: int, data: PassengerInput) -> Passenger: ...

    def update_passenger(
        self, resource_id: int, passenger_id: int, data: PassengerInput
    ) -> Passenger: ...

    def delete_passenger(self, resource_id: int, passenger_id: int) -> None: ...

    def bind_passenger(self, resource_id: int, passenger_id: int, unit_id: int) -> None: ...

    def unbind_passenger(self, resource_id: int, passenger_id: int) -> None: ...

    # --- Unit custom fields ---
    def create_unit_custom_field(self, unit_id: int, name: str, value: str) -> CustomField: ...

    def update_unit_custom_field(
        self, unit_id: int, field_id: int, name: str, value: str
    ) -> CustomField: ...

    def delete_unit_custom_field(self, unit_id: int, field_id: int) -> None: ...

    # --- History ---
    def load_track(
        self, unit_id: int, time_from: datetime, time_to: datetime, *, max_points: int
    ) -> Track: ...
