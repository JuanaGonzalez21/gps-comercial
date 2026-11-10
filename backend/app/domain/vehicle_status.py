"""Derived vehicle status (section 4.4). Strategy: the rules can change without touching callers.

Rules of ThresholdStatusPolicy (thresholds from settings, documented in docs/api-contract.md):
1. No valid position or no last message -> NO_SIGNAL.
2. Last message older than `no_signal_after` -> NO_SIGNAL.
3. Speed >= `moving_speed_kmh` -> MOVING.
4. Otherwise -> STOPPED.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.domain.fleet import Unit, VehicleStatus


class StatusPolicy(Protocol):
    def classify(self, unit: Unit, now: datetime) -> VehicleStatus: ...


@dataclass(frozen=True, slots=True)
class ThresholdStatusPolicy:
    moving_speed_kmh: float
    no_signal_after: timedelta

    def classify(self, unit: Unit, now: datetime) -> VehicleStatus:
        if unit.position is None or unit.last_message_at is None:
            return VehicleStatus.NO_SIGNAL
        if now - unit.last_message_at > self.no_signal_after:
            return VehicleStatus.NO_SIGNAL
        speed = unit.position.speed_kmh or 0.0
        if speed >= self.moving_speed_kmh:
            return VehicleStatus.MOVING
        return VehicleStatus.STOPPED
