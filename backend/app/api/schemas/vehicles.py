"""Vehicle contracts and their mapping from domain views (no Wialon JSON ever reaches here)."""

from pydantic import BaseModel

from app.api.schemas.common import UtcDateTime
from app.domain.fleet import CustomField, Passenger, Position, VehicleStatus
from app.services.vehicle_service import VehicleView


class PositionOut(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: float | None
    course_deg: int | None
    altitude_m: float | None
    satellites: int | None
    recorded_at: UtcDateTime

    @classmethod
    def from_domain(cls, position: Position) -> "PositionOut":
        return cls(
            latitude=position.latitude,
            longitude=position.longitude,
            speed_kmh=position.speed_kmh,
            course_deg=position.course_deg,
            altitude_m=position.altitude_m,
            satellites=position.satellites,
            recorded_at=position.recorded_at,
        )


class DriverRefOut(BaseModel):
    resource_id: int
    id: int
    name: str
    phone: str | None


class PassengerRefOut(BaseModel):
    resource_id: int
    id: int
    name: str
    phone: str | None

    @classmethod
    def from_domain(cls, passenger: Passenger) -> "PassengerRefOut":
        return cls(
            resource_id=passenger.resource_id,
            id=passenger.id,
            name=passenger.name,
            phone=passenger.phone,
        )


class CustomFieldOut(BaseModel):
    id: int
    name: str
    value: str

    @classmethod
    def from_domain(cls, field: CustomField) -> "CustomFieldOut":
        return cls(id=field.id, name=field.name, value=field.value)


class VehicleSummaryOut(BaseModel):
    id: int
    name: str
    status: VehicleStatus
    last_message_at: UtcDateTime | None
    position: PositionOut | None
    driver: DriverRefOut | None
    passenger_count: int

    @classmethod
    def from_view(cls, view: VehicleView) -> "VehicleSummaryOut":
        unit = view.unit
        driver = view.driver
        return cls(
            id=unit.id,
            name=unit.name,
            status=view.status,
            last_message_at=unit.last_message_at,
            position=PositionOut.from_domain(unit.position) if unit.position else None,
            driver=(
                DriverRefOut(
                    resource_id=driver.resource_id,
                    id=driver.id,
                    name=driver.name,
                    phone=driver.phone,
                )
                if driver
                else None
            ),
            passenger_count=len(view.passengers),
        )


class VehicleDetailOut(VehicleSummaryOut):
    custom_fields: list[CustomFieldOut]
    passengers: list[PassengerRefOut]

    @classmethod
    def from_view(cls, view: VehicleView) -> "VehicleDetailOut":
        summary = VehicleSummaryOut.from_view(view)
        return cls(
            **summary.model_dump(),
            custom_fields=[CustomFieldOut.from_domain(f) for f in view.unit.custom_fields],
            passengers=[PassengerRefOut.from_domain(p) for p in view.passengers],
        )


class VehicleMarkerOut(BaseModel):
    """Compact shape for the map: only what markers and popups need (keeps polling cheap)."""

    id: int
    name: str
    status: VehicleStatus
    latitude: float
    longitude: float
    speed_kmh: float | None
    course_deg: int | None
    last_message_at: UtcDateTime | None
    driver_name: str | None

    @classmethod
    def from_view(cls, view: VehicleView) -> "VehicleMarkerOut":
        position = view.unit.position
        assert position is not None  # noqa: S101 - the service only returns positioned views
        return cls(
            id=view.unit.id,
            name=view.unit.name,
            status=view.status,
            latitude=position.latitude,
            longitude=position.longitude,
            speed_kmh=position.speed_kmh,
            course_deg=position.course_deg,
            last_message_at=view.unit.last_message_at,
            driver_name=view.driver.name if view.driver else None,
        )


class VehiclePositionsOut(BaseModel):
    items: list[VehicleMarkerOut]
    generated_at: UtcDateTime


class SystemInfoOut(BaseModel):
    fleet_source: str
    environment: str
