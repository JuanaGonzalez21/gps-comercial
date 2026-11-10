"""Dashboard KPIs (RF-23), computed from the same views the vehicle list uses."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.domain.fleet import VehicleStatus
from app.domain.ports import FleetGateway
from app.services.vehicle_service import VehicleService


@dataclass(frozen=True, slots=True)
class DashboardSummary:
    vehicles_total: int
    vehicles_by_status: dict[VehicleStatus, int]
    vehicles_with_driver: int
    vehicles_without_driver: int
    drivers_total: int
    passengers_total: int
    generated_at: datetime


def _utcnow() -> datetime:
    return datetime.now(UTC)


class DashboardService:
    def __init__(
        self,
        vehicles: VehicleService,
        gateway: FleetGateway,
        *,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._vehicles = vehicles
        self._gateway = gateway
        self._clock = clock

    def summary(self) -> DashboardSummary:
        views = self._vehicles.list_all()
        by_status = dict.fromkeys(VehicleStatus, 0)  # every status present, even with 0
        for view in views:
            by_status[view.status] += 1
        with_driver = sum(1 for view in views if view.driver is not None)
        return DashboardSummary(
            vehicles_total=len(views),
            vehicles_by_status=by_status,
            vehicles_with_driver=with_driver,
            vehicles_without_driver=len(views) - with_driver,
            drivers_total=len(self._gateway.list_drivers()),
            passengers_total=len(self._gateway.list_passengers()),
            generated_at=self._clock(),
        )
