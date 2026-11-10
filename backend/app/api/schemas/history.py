"""Route history contract (RF-24)."""

from pydantic import BaseModel, Field

from app.api.schemas.common import UtcDateTime
from app.domain.fleet import TrackPoint
from app.services.history_service import TrackResult


class TrackPointOut(BaseModel):
    recorded_at: UtcDateTime
    latitude: float
    longitude: float
    speed_kmh: float | None
    course_deg: int | None

    @classmethod
    def from_domain(cls, point: TrackPoint) -> "TrackPointOut":
        return cls(
            recorded_at=point.recorded_at,
            latitude=point.latitude,
            longitude=point.longitude,
            speed_kmh=point.speed_kmh,
            course_deg=point.course_deg,
        )


class TrackStatsOut(BaseModel):
    total_points: int = Field(description="Mensajes con posición válida recibidos de Wialon.")
    returned_points: int = Field(description="Puntos devueltos tras simplificar (RDP).")
    simplified: bool
    truncated: bool = Field(description="Wialon tenía más mensajes de los que se cargaron.")
    distance_km: float
    max_speed_kmh: float | None
    avg_speed_kmh: float | None = Field(description="Media de las velocidades reportadas.")
    duration_s: int


class TrackOut(BaseModel):
    vehicle_id: int
    # "from" is a Python keyword: the attribute is time_from, the JSON key is "from".
    time_from: UtcDateTime = Field(serialization_alias="from")
    time_to: UtcDateTime = Field(serialization_alias="to")
    points: list[TrackPointOut]
    stats: TrackStatsOut

    @classmethod
    def from_result(cls, result: TrackResult) -> "TrackOut":
        stats = result.stats
        return cls(
            vehicle_id=result.vehicle_id,
            time_from=result.time_from,
            time_to=result.time_to,
            points=[TrackPointOut.from_domain(p) for p in result.points],
            stats=TrackStatsOut(
                total_points=stats.total_points,
                returned_points=stats.returned_points,
                simplified=stats.simplified,
                truncated=stats.truncated,
                distance_km=stats.distance_km,
                max_speed_kmh=stats.max_speed_kmh,
                avg_speed_kmh=stats.avg_speed_kmh,
                duration_s=stats.duration_s,
            ),
        )
