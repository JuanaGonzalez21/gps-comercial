"""WialonFleetGateway: Adapter that implements the FleetGateway port on top of Wialon.

Reads are cached for a short TTL (INT-06) and invalidated after every write. Updates re-send the
complete remote object: Wialon's update services may erase optional fields that are omitted, so we
read the current driver/tag, change only the edited attributes and send everything back.
"""

import json
import logging
import threading
import time
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

from app.domain.errors import (
    ConflictError,
    NotFoundError,
    UpstreamError,
    UpstreamUnavailableError,
)
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
from app.infrastructure.wialon import mappers
from app.infrastructure.wialon.client import UNCERTAIN_WRITE, WialonClient
from app.infrastructure.wialon.errors import NO_MESSAGES
from app.infrastructure.wialon.schemas import RawMessages, RawSearchResult

logger = logging.getLogger("app.wialon.gateway")

UNIT_FLAGS = 0x1 | 0x8 | 0x400  # base, custom fields, last message and position
RESOURCE_FLAGS = 0x1 | 0x100 | 0x200000  # base, drivers, tags (passengers)
MESSAGES_WITH_DATA_MASK = 0xFF00  # flags=0 with this mask = "all messages with data"
# Wialon applies bind/unbind asynchronously (~1-2 s, verified against the real account), so we
# re-read until the new state is visible before answering.
BINDING_CONFIRM_ATTEMPTS = 8
BINDING_CONFIRM_INTERVAL_SECONDS = 0.75
BINDING_CONFIRM_MAX_SECONDS = 8.0
BINDING_NOT_CONFIRMED = (
    "Wialon recibió el cambio de asignación pero todavía no lo refleja. "
    "Revisa el estado en unos segundos antes de volver a intentarlo."
)
# An unbind stamped in the same second as the previous bind is not applied by Wialon (verified).
MIN_SECONDS_BETWEEN_BINDINGS = 2.0


class _TtlCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float]) -> None:
        self._ttl = ttl_seconds
        self._clock = clock
        self._values: dict[str, tuple[float, Any]] = {}
        # Bumped by invalidate(): a load that started before an invalidation is not stored,
        # otherwise a slow read in flight during a write would re-cache the pre-write state.
        self._generations: dict[str, int] = {"units": 0, "resources": 0}
        self._locks: dict[str, threading.Lock] = {
            "units": threading.Lock(),
            "resources": threading.Lock(),
        }

    def get_or_load(self, key: str, loader: Callable[[], Any]) -> Any:
        cached = self._values.get(key)
        if cached and self._clock() < cached[0]:
            return cached[1]
        with self._locks[key]:  # one upstream call per key even under concurrent requests
            cached = self._values.get(key)
            if cached and self._clock() < cached[0]:
                return cached[1]
            generation = self._generations[key]
            value = loader()
            if self._generations[key] == generation:
                self._values[key] = (self._clock() + self._ttl, value)
            return value

    def invalidate(self, *keys: str) -> None:
        for key in keys or tuple(self._generations):
            self._generations[key] += 1
            self._values.pop(key, None)


def _search_params(items_type: str, flags: int) -> dict[str, Any]:
    return {
        "spec": {
            "itemsType": items_type,
            "propName": "sys_name",
            "propValueMask": "*",
            "sortType": "sys_name",
        },
        "force": 1,
        "flags": flags,
        "from": 0,
        "to": 0,
    }


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except ValueError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _created_object(body: Any, what: str) -> dict[str, Any]:
    """update_* services answer [id, {object}] on create/update and [id, null] on delete."""
    if isinstance(body, list) and len(body) == 2 and isinstance(body[1], dict):
        return body[1]
    # The write was sent and Wialon answered something else: the change may have been applied.
    raise UpstreamUnavailableError(
        f"Wialon respondió de forma inesperada al guardar {what}. {UNCERTAIN_WRITE}"
    )


class WialonFleetGateway:
    def __init__(
        self,
        client: WialonClient,
        *,
        cache_ttl_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._cache = _TtlCache(cache_ttl_seconds, clock)
        self._clock = clock
        self._sleep = sleep
        self._messages_lock = threading.Lock()  # loaded messages live in the shared session

    def close(self) -> None:
        self._client.close()

    def refresh(self) -> None:
        self._cache.invalidate()

    # ----- raw reads ---------------------------------------------------------------------
    def _raw_units(self) -> list[dict[str, Any]]:
        def load() -> list[dict[str, Any]]:
            body = self._client.call(
                "core/search_items", _search_params("avl_unit", UNIT_FLAGS), read_only=True
            )
            return RawSearchResult.model_validate(body).items

        return self._cache.get_or_load("units", load)

    def _raw_resources(self) -> list[dict[str, Any]]:
        def load() -> list[dict[str, Any]]:
            body = self._client.call(
                "core/search_items",
                _search_params("avl_resource", RESOURCE_FLAGS),
                read_only=True,
            )
            return RawSearchResult.model_validate(body).items

        return self._cache.get_or_load("resources", load)

    def _parsed_resources(self) -> list[Any]:
        return [r for r in map(mappers.map_resource, self._raw_resources()) if r is not None]

    def _raw_entry(self, resource_id: int, key: str, entry_id: int, label: str) -> dict[str, Any]:
        for resource in self._raw_resources():
            if resource.get("id") != resource_id:
                continue
            container = resource.get(key)
            entries = container.values() if isinstance(container, dict) else []
            for entry in entries:
                if isinstance(entry, dict) and entry.get("id") == entry_id:
                    return entry
            break
        raise NotFoundError(f"El {label} no existe en Wialon o no es accesible.")

    def _confirm_binding(
        self, resource_id: int, key: str, entry_id: int, label: str, expected_unit: int | None
    ) -> None:
        # Propagation took ~2 s against the real account, but nothing guarantees it: when the new
        # state is not visible within the limits we answer "pending confirmation", never success.
        deadline = self._clock() + BINDING_CONFIRM_MAX_SECONDS
        for attempt in range(BINDING_CONFIRM_ATTEMPTS):
            self._cache.invalidate("resources")
            entry = self._raw_entry(resource_id, key, entry_id, label)
            if (entry.get("bu") or None) == expected_unit:
                return
            if attempt == BINDING_CONFIRM_ATTEMPTS - 1 or self._clock() >= deadline:
                break
            self._sleep(BINDING_CONFIRM_INTERVAL_SECONDS)
        logger.warning("wialon_binding_not_confirmed", extra={"kind": key, "entry_id": entry_id})
        raise UpstreamUnavailableError(BINDING_NOT_CONFIRMED, retry_after_seconds=10)

    def _respect_last_binding_time(self, entry: dict[str, Any]) -> None:
        last_change = entry.get("bt") or 0  # UNIX time of the last bind/unbind
        wait = last_change + MIN_SECONDS_BETWEEN_BINDINGS - time.time()
        if 0 < wait <= MIN_SECONDS_BETWEEN_BINDINGS:
            self._sleep(wait)

    def _require_resource(self, resource_id: int) -> None:
        if not any(r.id == resource_id for r in self.list_resources()):
            raise NotFoundError("El recurso de Wialon no existe o no es accesible.")

    # ----- units -------------------------------------------------------------------------
    def list_units(self) -> Sequence[Unit]:
        return [u for u in map(mappers.map_unit, self._raw_units()) if u is not None]

    def get_unit(self, unit_id: int) -> Unit:
        for unit in self.list_units():
            if unit.id == unit_id:
                return unit
        raise NotFoundError("El vehículo no existe o no es accesible.")

    # ----- resources, drivers, passengers -----------------------------------------------
    def list_resources(self) -> Sequence[Resource]:
        return [mappers.to_resource(r) for r in self._parsed_resources()]

    def list_drivers(self) -> Sequence[Driver]:
        return [d for r in self._parsed_resources() for d in mappers.map_drivers(r)]

    def list_passengers(self) -> Sequence[Passenger]:
        return [p for r in self._parsed_resources() for p in mappers.map_passengers(r)]

    def _write(self, svc: str, params: dict[str, Any], *, invalidate: tuple[str, ...]) -> Any:
        try:
            return self._client.call(svc, params, read_only=False)
        finally:
            # Even a failed write may have been partially applied: never serve stale data.
            self._cache.invalidate(*invalidate)

    def create_driver(self, resource_id: int, data: DriverInput) -> Driver:
        self._require_resource(resource_id)
        params = {
            "itemId": resource_id,
            "id": 0,
            "callMode": "create",
            "ej": {},
            "c": data.code or "",
            "ck": 0,
            "ds": data.description or "",
            "n": data.name,
            "p": data.phone or "",
            "r": 0,
            "f": 0,
            "pwd": "",
            "jp": {},
        }
        body = self._write("resource/update_driver", params, invalidate=("resources",))
        return self._driver_from_object(resource_id, _created_object(body, "el conductor"))

    def update_driver(self, resource_id: int, driver_id: int, data: DriverInput) -> Driver:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "drvrs", driver_id, "conductor")
        params = {
            "itemId": resource_id,
            "id": driver_id,
            "callMode": "update",
            # Preserved as they are in Wialon (omitting them could erase them):
            "ej": _json_object(current.get("ej")),
            "ck": current.get("ck", 0),
            "r": current.get("r", 0),
            "f": current.get("f", 0),
            "pwd": current.get("pwd", ""),
            "jp": _json_object(current.get("jp")),
            # Edited attributes:
            "n": data.name,
            "c": data.code or "",
            "ds": data.description or "",
            "p": data.phone or "",
        }
        body = self._write("resource/update_driver", params, invalidate=("resources",))
        return self._driver_from_object(resource_id, _created_object(body, "el conductor"))

    def delete_driver(self, resource_id: int, driver_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        self._raw_entry(resource_id, "drvrs", driver_id, "conductor")
        params = {"itemId": resource_id, "id": driver_id, "callMode": "delete"}
        self._write("resource/update_driver", params, invalidate=("resources",))

    def bind_driver(self, resource_id: int, driver_id: int, unit_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "drvrs", driver_id, "conductor")
        self.get_unit(unit_id)
        self._respect_last_binding_time(current)
        params = {
            "resourceId": resource_id,
            "unitId": unit_id,
            "driverId": driver_id,
            "time": 0,
            "mode": 1,
        }
        self._write("resource/bind_unit_driver", params, invalidate=("resources",))
        self._confirm_binding(resource_id, "drvrs", driver_id, "conductor", unit_id)

    def unbind_driver(self, resource_id: int, driver_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "drvrs", driver_id, "conductor")
        unit_id = current.get("bu") or 0
        if not unit_id:
            raise ConflictError("El conductor no está vinculado a ningún vehículo.")
        self._respect_last_binding_time(current)
        params = {
            "resourceId": resource_id,
            "unitId": unit_id,
            "driverId": driver_id,
            "time": 0,
            "mode": 0,
        }
        self._write("resource/bind_unit_driver", params, invalidate=("resources",))
        self._confirm_binding(resource_id, "drvrs", driver_id, "conductor", None)

    def create_passenger(self, resource_id: int, data: PassengerInput) -> Passenger:
        self._require_resource(resource_id)
        params = {
            "itemId": resource_id,
            "id": 0,
            "callMode": "create",
            "c": data.code or "",
            "ck": 0,
            "n": data.name,
            "p": data.phone or "",
            "r": 0,
            "jp": dict(data.custom_fields),
        }
        body = self._write("resource/update_tag", params, invalidate=("resources",))
        return self._passenger_from_object(resource_id, _created_object(body, "el pasajero"))

    def update_passenger(
        self, resource_id: int, passenger_id: int, data: PassengerInput
    ) -> Passenger:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "tags", passenger_id, "pasajero")
        params: dict[str, Any] = {
            "itemId": resource_id,
            "id": passenger_id,
            "callMode": "update",
            "ck": current.get("ck", 0),
            "r": current.get("r", 0),
            "n": data.name,
            "c": data.code or "",
            "p": data.phone or "",
            # Complete desired set, already merged by the service with the current fields.
            "jp": dict(data.custom_fields),
        }
        if "tz" in current:
            params["tz"] = current["tz"]
        body = self._write("resource/update_tag", params, invalidate=("resources",))
        return self._passenger_from_object(resource_id, _created_object(body, "el pasajero"))

    def delete_passenger(self, resource_id: int, passenger_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        self._raw_entry(resource_id, "tags", passenger_id, "pasajero")
        params = {"itemId": resource_id, "id": passenger_id, "callMode": "delete"}
        self._write("resource/update_tag", params, invalidate=("resources",))

    def bind_passenger(self, resource_id: int, passenger_id: int, unit_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "tags", passenger_id, "pasajero")
        self.get_unit(unit_id)
        self._respect_last_binding_time(current)
        params = {
            "resourceId": resource_id,
            "unitId": unit_id,
            "tagId": passenger_id,
            "time": 0,
            "mode": 1,
        }
        self._write("resource/bind_unit_tag", params, invalidate=("resources",))
        self._confirm_binding(resource_id, "tags", passenger_id, "pasajero", unit_id)

    def unbind_passenger(self, resource_id: int, passenger_id: int) -> None:
        self._cache.invalidate("resources")  # merge onto the current remote state
        current = self._raw_entry(resource_id, "tags", passenger_id, "pasajero")
        unit_id = current.get("bu") or 0
        if not unit_id:
            raise ConflictError("El pasajero no está asignado a ningún vehículo.")
        self._respect_last_binding_time(current)
        params = {
            "resourceId": resource_id,
            "unitId": unit_id,
            "tagId": passenger_id,
            "time": 0,
            "mode": 0,
        }
        self._write("resource/bind_unit_tag", params, invalidate=("resources",))
        self._confirm_binding(resource_id, "tags", passenger_id, "pasajero", None)

    def _driver_from_object(self, resource_id: int, obj: dict[str, Any]) -> Driver:
        raw = mappers.map_resource({"id": resource_id, "nm": "", "drvrs": {"0": obj}})
        drivers = mappers.map_drivers(raw) if raw else []
        if not drivers:
            raise UpstreamError("Wialon devolvió un conductor inválido.")
        return drivers[0]

    def _passenger_from_object(self, resource_id: int, obj: dict[str, Any]) -> Passenger:
        raw = mappers.map_resource({"id": resource_id, "nm": "", "tags": {"0": obj}})
        passengers = mappers.map_passengers(raw) if raw else []
        if not passengers:
            raise UpstreamError("Wialon devolvió un pasajero inválido.")
        return passengers[0]

    # ----- unit custom fields -----------------------------------------------------------
    def create_unit_custom_field(self, unit_id: int, name: str, value: str) -> CustomField:
        self.get_unit(unit_id)
        params = {"itemId": unit_id, "id": 0, "callMode": "create", "n": name, "v": value}
        body = self._write("item/update_custom_field", params, invalidate=("units",))
        return mappers.map_custom_field(_created_object(body, "el campo"))

    def update_unit_custom_field(
        self, unit_id: int, field_id: int, name: str, value: str
    ) -> CustomField:
        self._require_unit_field(unit_id, field_id)
        params = {"itemId": unit_id, "id": field_id, "callMode": "update", "n": name, "v": value}
        body = self._write("item/update_custom_field", params, invalidate=("units",))
        return mappers.map_custom_field(_created_object(body, "el campo"))

    def delete_unit_custom_field(self, unit_id: int, field_id: int) -> None:
        self._require_unit_field(unit_id, field_id)
        params = {"itemId": unit_id, "id": field_id, "callMode": "delete"}
        self._write("item/update_custom_field", params, invalidate=("units",))

    def _require_unit_field(self, unit_id: int, field_id: int) -> None:
        self._cache.invalidate("units")
        unit = self.get_unit(unit_id)
        if not any(f.id == field_id for f in unit.custom_fields):
            raise NotFoundError("El campo personalizado no existe en este vehículo.")

    # ----- history -----------------------------------------------------------------------
    def load_track(
        self, unit_id: int, time_from: datetime, time_to: datetime, *, max_points: int
    ) -> Track:
        self.get_unit(unit_id)
        params = {
            "itemId": unit_id,
            "timeFrom": int(time_from.timestamp()),
            "timeTo": int(time_to.timestamp()),
            "flags": 0,
            "flagsMask": MESSAGES_WITH_DATA_MASK,
            "loadCount": max_points,
        }
        with self._messages_lock:
            try:
                body = self._client.call(
                    "messages/load_interval",
                    params,
                    read_only=True,
                    accept_errors=frozenset({NO_MESSAGES}),
                )
            finally:
                try:
                    self._client.call("messages/unload", {}, read_only=True)
                except Exception:  # noqa: BLE001 - cleanup must never hide the real result
                    logger.info("wialon_messages_unload_failed")
        if isinstance(body, dict) and body.get("error") == NO_MESSAGES:
            return Track(unit_id=unit_id, points=(), truncated=False)
        result = RawMessages.model_validate(body)
        points = [p for p in map(mappers.map_track_point, result.messages) if p is not None]
        points.sort(key=lambda p: p.recorded_at)
        return Track(
            unit_id=unit_id,
            points=tuple(points),
            truncated=result.count > len(result.messages),
        )
