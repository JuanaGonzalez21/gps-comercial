"""Vehicle use cases: list (server-side search/filter/sort/paging), map positions and detail."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

from app.domain.fleet import Driver, Passenger, Unit, VehicleStatus
from app.domain.ports import FleetGateway
from app.domain.vehicle_status import StatusPolicy
from app.services.common import sort_key

SORT_FIELDS = ("name", "status", "last_message_at")
_STATUS_ORDER = {VehicleStatus.MOVING: 0, VehicleStatus.STOPPED: 1, VehicleStatus.NO_SIGNAL: 2}


@dataclass(frozen=True, slots=True)
class VehicleView:
    unit: Unit
    status: VehicleStatus
    driver: Driver | None
    passengers: tuple[Passenger, ...]


@dataclass(frozen=True, slots=True)
class VehiclePage:
    items: Sequence[VehicleView]
    total: int


def _utcnow() -> datetime:
    return datetime.now(UTC)


class VehicleService:
    def __init__(
        self,
        gateway: FleetGateway,
        policy: StatusPolicy,
        *,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._gateway = gateway
        self._policy = policy
        self._clock = clock

    def _views(self) -> list[VehicleView]:
        now = self._clock()
        drivers_by_unit: dict[int, Driver] = {}
        for driver in sorted(self._gateway.list_drivers(), key=lambda d: d.name.lower()):
            if driver.unit_id is not None:
                drivers_by_unit.setdefault(driver.unit_id, driver)
        passengers_by_unit: dict[int, list[Passenger]] = {}
        for passenger in self._gateway.list_passengers():
            if passenger.unit_id is not None:
                passengers_by_unit.setdefault(passenger.unit_id, []).append(passenger)
        return [
            VehicleView(
                unit=unit,
                status=self._policy.classify(unit, now),
                driver=drivers_by_unit.get(unit.id),
                passengers=tuple(
                    sorted(passengers_by_unit.get(unit.id, []), key=lambda p: p.name.lower())
                ),
            )
            for unit in self._gateway.list_units()
        ]

    @staticmethod
    def _filter(
        views: list[VehicleView],
        *,
        search: str | None,
        status: VehicleStatus | None,
        has_driver: bool | None,
    ) -> list[VehicleView]:
        term = (search or "").strip().lower()
        result = []
        for view in views:
            if status is not None and view.status != status:
                continue
            if has_driver is not None and (view.driver is not None) != has_driver:
                continue
            if term:
                haystack = view.unit.name.lower()
                if view.driver is not None:
                    haystack += " " + view.driver.name.lower()
                if term not in haystack:
                    continue
            result.append(view)
        return result

    @staticmethod
    def _sort(views: list[VehicleView], sort: str) -> list[VehicleView]:
        descending = sort.startswith("-")
        field = sort.lstrip("-")
        by_name = sorted(views, key=lambda v: (sort_key(v.unit.name), v.unit.id))
        if field == "status":
            return sorted(by_name, key=lambda v: _STATUS_ORDER[v.status], reverse=descending)
        if field == "last_message_at":
            with_time = [v for v in by_name if v.unit.last_message_at is not None]
            without_time = [v for v in by_name if v.unit.last_message_at is None]
            with_time.sort(key=lambda v: v.unit.last_message_at, reverse=descending)  # type: ignore[arg-type,return-value]
            return with_time + without_time  # missing timestamps always last
        return list(reversed(by_name)) if descending else by_name

    def list_all(
        self,
        *,
        search: str | None = None,
        status: VehicleStatus | None = None,
        has_driver: bool | None = None,
        sort: str = "name",
    ) -> list[VehicleView]:
        """Every vehicle matching the filters, sorted (dashboard and CSV export use it unpaged)."""
        views = self._filter(self._views(), search=search, status=status, has_driver=has_driver)
        return self._sort(views, sort)

    def search(
        self,
        *,
        search: str | None = None,
        status: VehicleStatus | None = None,
        has_driver: bool | None = None,
        sort: str = "name",
        page: int = 1,
        page_size: int = 20,
    ) -> VehiclePage:
        views = self.list_all(search=search, status=status, has_driver=has_driver, sort=sort)
        start = (page - 1) * page_size
        return VehiclePage(items=views[start : start + page_size], total=len(views))

    def positions(
        self, *, search: str | None = None, status: VehicleStatus | None = None
    ) -> list[VehicleView]:
        views = self._filter(self._views(), search=search, status=status, has_driver=None)
        return [v for v in self._sort(views, "name") if v.unit.position is not None]

    def get(self, unit_id: int) -> VehicleView:
        unit = self._gateway.get_unit(unit_id)  # raises NotFoundError
        for view in self._views():
            if view.unit.id == unit.id:
                return view
        return VehicleView(
            unit=unit, status=self._policy.classify(unit, self._clock()), driver=None, passengers=()
        )
