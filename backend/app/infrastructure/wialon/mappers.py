"""Mappers: validated Wialon payloads -> domain models (DTO/Mapper pattern, section 4.4).

Conversions: UNIX seconds -> aware UTC datetimes; coordinates validated (range, not 0,0); speed kept
in km/h (Wialon's unit); course normalised to 0-359; empty strings -> None.
"""

import logging
import math
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from app.domain.fleet import CustomField, Driver, Passenger, Position, Resource, TrackPoint, Unit
from app.infrastructure.wialon.schemas import (
    RawCustomField,
    RawDriver,
    RawMessage,
    RawPosition,
    RawResource,
    RawTag,
    RawUnit,
)

logger = logging.getLogger("app.wialon.mappers")

# Wialon timestamps are UNIX seconds; anything outside this window is treated as missing.
_MIN_TS = 946_684_800  # 2000-01-01
_MAX_TS = 4_102_444_800  # 2100-01-01


def to_utc(timestamp: int | None) -> datetime | None:
    if not timestamp or not _MIN_TS <= timestamp <= _MAX_TS:
        return None
    return datetime.fromtimestamp(timestamp, UTC)


def _text(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _valid_coordinates(latitude: float | None, longitude: float | None) -> bool:
    if latitude is None or longitude is None:
        return False
    if not (math.isfinite(latitude) and math.isfinite(longitude)):
        return False
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return False
    return not (latitude == 0 and longitude == 0)  # "null island": a device without a fix


def map_position(raw: RawPosition | None) -> Position | None:
    if raw is None or not _valid_coordinates(raw.y, raw.x):
        return None
    recorded_at = to_utc(raw.t)
    if recorded_at is None:
        return None
    speed = raw.s if raw.s is not None and raw.s >= 0 and math.isfinite(raw.s) else None
    course = int(raw.c) % 360 if raw.c is not None and math.isfinite(raw.c) else None
    altitude = raw.z if raw.z is not None and math.isfinite(raw.z) else None
    satellites = raw.sc if raw.sc is not None and raw.sc >= 0 else None
    return Position(
        latitude=float(raw.y),  # type: ignore[arg-type]  # validated above
        longitude=float(raw.x),  # type: ignore[arg-type]
        recorded_at=recorded_at,
        speed_kmh=float(speed) if speed is not None else None,
        course_deg=course,
        altitude_m=altitude,
        satellites=satellites,
    )


def _custom_fields(raw: RawUnit) -> tuple[CustomField, ...]:
    values = raw.flds.values() if isinstance(raw.flds, dict) else (raw.flds or [])
    fields = [CustomField(id=f.id, name=f.n, value=f.v) for f in values]
    return tuple(sorted(fields, key=lambda f: f.id))


def map_unit(item: dict[str, Any]) -> Unit | None:
    try:
        raw = RawUnit.model_validate(item)
    except ValidationError:
        logger.warning("wialon_unit_invalid", extra={"unit_id": item.get("id")})
        return None
    position = map_position(raw.pos)
    last_message_at = to_utc(raw.lmsg.t) if raw.lmsg else None
    if last_message_at is None and position is not None:
        last_message_at = position.recorded_at
    return Unit(
        id=raw.id,
        name=raw.nm.strip() or f"Unidad {raw.id}",
        last_message_at=last_message_at,
        position=position,
        custom_fields=_custom_fields(raw),
    )


def map_custom_field(raw: dict[str, Any]) -> CustomField:
    field = RawCustomField.model_validate(raw)
    return CustomField(id=field.id, name=field.n, value=field.v)


def map_resource(item: dict[str, Any]) -> RawResource | None:
    try:
        return RawResource.model_validate(item)
    except ValidationError:
        logger.warning("wialon_resource_invalid", extra={"resource_id": item.get("id")})
        return None


def to_resource(raw: RawResource) -> Resource:
    return Resource(id=raw.id, name=raw.nm.strip() or f"Recurso {raw.id}")


def _entries(container: dict[str, dict[str, object]] | list[object] | None) -> list[dict]:
    if isinstance(container, dict):
        return [value for value in container.values() if isinstance(value, dict)]
    return []


def map_drivers(raw: RawResource) -> list[Driver]:
    drivers = []
    for entry in _entries(raw.drvrs):
        try:
            d = RawDriver.model_validate(entry)
        except ValidationError:
            logger.warning("wialon_driver_invalid", extra={"resource_id": raw.id})
            continue
        drivers.append(
            Driver(
                resource_id=raw.id,
                id=d.id,
                name=d.n.strip() or f"Conductor {d.id}",
                code=_text(d.c),
                phone=_text(d.p),
                description=_text(d.ds),
                unit_id=d.bu or None,
            )
        )
    return drivers


def map_passengers(raw: RawResource) -> list[Passenger]:
    passengers = []
    for entry in _entries(raw.tags):
        try:
            t = RawTag.model_validate(entry)
        except ValidationError:
            logger.warning("wialon_tag_invalid", extra={"resource_id": raw.id})
            continue
        custom = t.jp if isinstance(t.jp, dict) else {}
        passengers.append(
            Passenger(
                resource_id=raw.id,
                id=t.id,
                name=t.n.strip() or f"Pasajero {t.id}",
                code=_text(t.c),
                phone=_text(t.p),
                unit_id=t.bu or None,
                custom_fields=dict(custom),
            )
        )
    return passengers


def map_track_point(item: dict[str, Any]) -> TrackPoint | None:
    try:
        message = RawMessage.model_validate(item)
    except ValidationError:
        return None
    if message.pos is None:
        return None
    # In history messages the time lives on the message, not inside "pos".
    raw_position = message.pos if message.pos.t else message.pos.model_copy(update={"t": message.t})
    position = map_position(raw_position)
    if position is None:
        return None
    return TrackPoint(
        recorded_at=position.recorded_at,
        latitude=position.latitude,
        longitude=position.longitude,
        speed_kmh=position.speed_kmh,
        course_deg=position.course_deg,
    )
