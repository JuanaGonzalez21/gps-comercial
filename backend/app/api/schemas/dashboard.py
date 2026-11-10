"""Dashboard contract (RF-23)."""

from pydantic import BaseModel

from app.api.schemas.common import UtcDateTime
from app.services.dashboard_service import DashboardSummary


class VehiclesByStatusOut(BaseModel):
    moving: int
    stopped: int
    no_signal: int


class DashboardSummaryOut(BaseModel):
    vehicles_total: int
    vehicles_by_status: VehiclesByStatusOut
    vehicles_with_driver: int
    vehicles_without_driver: int
    drivers_total: int
    passengers_total: int
    generated_at: UtcDateTime

    @classmethod
    def from_summary(cls, summary: DashboardSummary) -> "DashboardSummaryOut":
        by_status = {status.value: count for status, count in summary.vehicles_by_status.items()}
        return cls(
            vehicles_total=summary.vehicles_total,
            vehicles_by_status=VehiclesByStatusOut(**by_status),
            vehicles_with_driver=summary.vehicles_with_driver,
            vehicles_without_driver=summary.vehicles_without_driver,
            drivers_total=summary.drivers_total,
            passengers_total=summary.passengers_total,
            generated_at=summary.generated_at,
        )
