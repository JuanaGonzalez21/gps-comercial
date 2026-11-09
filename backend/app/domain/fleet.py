"""Fleet domain models.

These are our own models, independent of Wialon's JSON. Adapters (app/infrastructure/wialon) map
raw responses into them; the API layer maps them into HTTP schemas. Datetimes are aware UTC.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class VehicleStatus(StrEnum):
    MOVING = "moving"
    STOPPED = "stopped"
    NO_SIGNAL = "no_signal"


@dataclass(frozen=True, slots=True, kw_only=True)
class Position:
    latitude: float
    longitude: float
    recorded_at: datetime
    speed_kmh: float | None = None
    course_deg: int | None = None
    altitude_m: float | None = None
    satellites: int | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class CustomField:
    """A custom field of a unit (Wialon `flds`)."""

    id: int
    name: str
    value: str


@dataclass(frozen=True, slots=True, kw_only=True)
class Unit:
    """A vehicle as reported by the fleet platform, before any derived status is computed."""

    id: int
    name: str
    last_message_at: datetime | None = None
    position: Position | None = None
    custom_fields: tuple[CustomField, ...] = ()


@dataclass(frozen=True, slots=True, kw_only=True)
class Resource:
    """Wialon container that owns drivers and passengers (tags)."""

    id: int
    name: str


@dataclass(frozen=True, slots=True, kw_only=True)
class Driver:
    resource_id: int
    id: int
    name: str
    code: str | None = None
    phone: str | None = None
    description: str | None = None
    unit_id: int | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Passenger:
    """A passenger. Wialon calls them tags; they live inside a resource and have no description."""

    resource_id: int
    id: int
    name: str
    code: str | None = None
    phone: str | None = None
    unit_id: int | None = None
    custom_fields: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True, kw_only=True)
class DriverInput:
    """Editable driver attributes. Remote attributes not listed here must be preserved on update."""

    name: str
    code: str | None = None
    phone: str | None = None
    description: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class PassengerInput:
    """Editable passenger attributes.

    `custom_fields` is the complete desired set: services merge single-field changes before calling
    the gateway, and the gateway preserves every remote attribute not represented here.
    """

    name: str
    code: str | None = None
    phone: str | None = None
    custom_fields: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True, kw_only=True)
class TrackPoint:
    recorded_at: datetime
    latitude: float
    longitude: float
    speed_kmh: float | None = None
    course_deg: int | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class Track:
    unit_id: int
    points: tuple[TrackPoint, ...]
    # True when the platform had more messages than the gateway was allowed to load.
    truncated: bool = False
