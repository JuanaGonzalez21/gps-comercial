"""Route history (RF-24): load messages for a range, simplify them and compute statistics.

Volume control: the range is limited to 7 days, Wialon is asked for at most RAW_POINTS_LIMIT
messages (`truncated` tells the UI when the platform had more) and the answer is simplified with
RDP down to `max_points`, so the map and the playback stay fluid.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.domain.errors import FieldError, InvalidInputError
from app.domain.fleet import TrackPoint
from app.domain.ports import FleetGateway
from app.domain.track import TrackStats, simplify, track_stats

MAX_RANGE = timedelta(days=7)
RAW_POINTS_LIMIT = 20_000
MIN_POINTS, MAX_POINTS, DEFAULT_POINTS = 100, 5_000, 2_000


@dataclass(frozen=True, slots=True)
class TrackResult:
    vehicle_id: int
    time_from: datetime
    time_to: datetime
    points: tuple[TrackPoint, ...]
    stats: TrackStats


def _invalid(field: str, message: str) -> InvalidInputError:
    return InvalidInputError(message, field_errors=[FieldError(field, message)])


class HistoryService:
    def __init__(self, gateway: FleetGateway) -> None:
        self._gateway = gateway

    def track(
        self,
        vehicle_id: int,
        time_from: datetime,
        time_to: datetime,
        *,
        max_points: int = DEFAULT_POINTS,
    ) -> TrackResult:
        if time_from.tzinfo is None or time_to.tzinfo is None:
            raise _invalid("from", "Las fechas deben incluir la zona horaria.")
        start, end = time_from.astimezone(UTC), time_to.astimezone(UTC)
        if start >= end:
            raise _invalid("to", "La fecha final debe ser posterior a la inicial.")
        if end - start > MAX_RANGE:
            raise _invalid("to", "El rango máximo de consulta es de 7 días.")
        if not MIN_POINTS <= max_points <= MAX_POINTS:
            raise _invalid("max_points", f"Debe estar entre {MIN_POINTS} y {MAX_POINTS} puntos.")

        track = self._gateway.load_track(vehicle_id, start, end, max_points=RAW_POINTS_LIMIT)
        raw = sorted(
            (p for p in track.points if start <= p.recorded_at <= end),
            key=lambda p: p.recorded_at,
        )
        points = simplify(raw, max_points)
        stats = track_stats(raw, returned_points=len(points), truncated=track.truncated)
        return TrackResult(
            vehicle_id=vehicle_id, time_from=start, time_to=end, points=points, stats=stats
        )
