from datetime import UTC, datetime, timedelta

import pytest

from app.domain.fleet import Position, Unit, VehicleStatus
from app.domain.vehicle_status import ThresholdStatusPolicy

NOW = datetime(2026, 11, 9, 20, 0, tzinfo=UTC)
POLICY = ThresholdStatusPolicy(moving_speed_kmh=5, no_signal_after=timedelta(minutes=60))


def unit(*, age_minutes: float | None, speed: float | None) -> Unit:
    if age_minutes is None:
        return Unit(id=1, name="U")
    at = NOW - timedelta(minutes=age_minutes)
    position = Position(latitude=4.6, longitude=-74.1, recorded_at=at, speed_kmh=speed)
    return Unit(id=1, name="U", last_message_at=at, position=position)


@pytest.mark.parametrize(
    ("age", "speed", "expected"),
    [
        (None, None, VehicleStatus.NO_SIGNAL),  # never reported
        (61, 80, VehicleStatus.NO_SIGNAL),  # stale data wins over speed
        (60, 80, VehicleStatus.MOVING),  # exactly at the threshold is still fresh
        (1, 5, VehicleStatus.MOVING),  # threshold speed counts as moving
        (1, 4.9, VehicleStatus.STOPPED),
        (1, None, VehicleStatus.STOPPED),  # missing speed treated as 0
    ],
)
def test_status_rules(age: float | None, speed: float | None, expected: VehicleStatus) -> None:
    assert POLICY.classify(unit(age_minutes=age, speed=speed), NOW) == expected
