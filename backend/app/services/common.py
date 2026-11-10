"""Small helpers shared by the fleet use cases: in-memory paging, search and vehicle references.

Fleet entities live in Wialon (read through the gateway's short TTL cache), so filtering, sorting
and paging happen here, in the backend, never in the browser (RF-10, RF-28).
"""

import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

from app.domain.ports import FleetGateway


def sort_key(text: str) -> str:
    """Accent- and case-insensitive key, so "Álvaro" sorts next to "Alberto", not after "Zoe"."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()


@dataclass(frozen=True, slots=True)
class ResultPage[T]:
    items: Sequence[T]
    total: int


def paginate[T](items: Sequence[T], page: int, page_size: int) -> ResultPage[T]:
    start = (page - 1) * page_size
    return ResultPage(items=list(items[start : start + page_size]), total=len(items))


def matches(term: str | None, *values: str | None) -> bool:
    """Case-insensitive substring search over the given attributes (empty term matches all)."""
    needle = (term or "").strip().lower()
    if not needle:
        return True
    return any(needle in value.lower() for value in values if value)


@dataclass(frozen=True, slots=True)
class VehicleRef:
    id: int
    name: str


def vehicle_names(gateway: FleetGateway) -> dict[int, str]:
    return {unit.id: unit.name for unit in gateway.list_units()}


def vehicle_ref(unit_id: int | None, names: dict[int, str]) -> VehicleRef | None:
    if unit_id is None:
        return None
    # A binding to a unit this account cannot see is still a binding: show it, never hide it.
    return VehicleRef(id=unit_id, name=names.get(unit_id, f"Unidad {unit_id}"))


def entity_key(resource_id: int, entity_id: int) -> str:
    """Audit identifier of drivers and passengers: their ids are only unique inside a resource."""
    return f"{resource_id}:{entity_id}"


_NEVER = datetime.min.replace(tzinfo=UTC)

NEWEST_FIRST = "-created"


def newest_first_key(
    created: Mapping[str, datetime], resource_id: int, entity_id: int
) -> tuple[bool, datetime, int, int]:
    """Sort key (with reverse=True) for "recién agregados" in drivers and passengers.

    Wialon keeps no creation date for them, so the date comes from our audit log: what was created
    through this application goes first, newest first. Items created elsewhere (directly in Wialon,
    or before the audit log existed) follow by id, which Wialon assigns in increasing order inside
    each resource, so they are newest first within their resource.
    """
    when = created.get(entity_key(resource_id, entity_id))
    if when is not None and when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return (when is not None, when or _NEVER, entity_id, resource_id)


def changed_fields(before: dict[str, object], after: dict[str, object]) -> list[str]:
    return [name for name, value in after.items() if before.get(name) != value]
