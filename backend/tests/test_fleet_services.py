"""TST-01: fleet use cases tested directly with the simulated gateway and an in-memory audit."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.domain.errors import ConflictError, NotFoundError, UpstreamError
from app.domain.fleet import DriverInput, PassengerInput
from app.domain.vehicle_status import ThresholdStatusPolicy
from app.infrastructure.fake_fleet.gateway import FakeFleetGateway
from app.services.audit_service import audit_failures
from app.services.common import sort_key
from app.services.dashboard_service import DashboardService
from app.services.driver_service import DriverService
from app.services.export_service import ExportService
from app.services.history_service import HistoryService
from app.services.passenger_service import PassengerService
from app.services.resource_service import ResourceService
from app.services.vehicle_service import VehicleService

NOW = datetime(2026, 11, 9, 20, 0, tzinfo=UTC)


@dataclass
class RecordingAudit:
    entries: list[dict[str, Any]] = field(default_factory=list)

    def record(self, action: str, **kwargs: Any) -> None:
        self.entries.append({"action": action, "outcome": "success", **kwargs})


@pytest.fixture
def gateway() -> FakeFleetGateway:
    return FakeFleetGateway(clock=lambda: NOW)


@pytest.fixture
def audit() -> RecordingAudit:
    return RecordingAudit()


def _passengers(gateway, audit) -> PassengerService:
    return PassengerService(gateway, audit, ResourceService(gateway))


def test_custom_field_rename_keeps_order_and_every_other_field(gateway, audit, monkeypatch):
    service = _passengers(gateway, audit)
    service.add_custom_field(1000, 1, "Turno", "Noche")
    service.add_custom_field(1000, 1, "Ruta", "Norte")
    sent: list[PassengerInput] = []
    original = gateway.update_passenger
    monkeypatch.setattr(
        gateway, "update_passenger", lambda r, p, d: (sent.append(d), original(r, p, d))[1]
    )
    key, value = service.update_custom_field(1000, 1, "Turno", value="Día", new_key="Jornada")
    assert (key, value) == ("Jornada", "Día")
    assert list(sent[0].custom_fields.items()) == [
        ("Empresa", "Simulada"),
        ("Jornada", "Día"),
        ("Ruta", "Norte"),
    ]
    assert (sent[0].name, sent[0].code, sent[0].phone) == ("Pasajero simulado 01", "P001", None)
    assert audit.entries[-1]["details"] == {
        "key": "Turno",
        "new_key": "Jornada",
        "value_changed": True,
    }


def test_custom_fields_are_listed_in_spanish_alphabetical_order(gateway, audit):
    service = _passengers(gateway, audit)
    for key in ("zona", "Área", "Barrio"):
        service.add_custom_field(1000, 2, key, "x")
    assert [k for k, _ in service.custom_fields(1000, 2)] == ["Área", "Barrio", "zona"]
    assert sort_key("Álvaro") < sort_key("Beatriz")


def test_failed_rule_is_audited_and_nothing_written(gateway, audit):
    service = _passengers(gateway, audit)
    before = list(gateway.list_passengers())
    with pytest.raises(NotFoundError):
        service.delete_custom_field(1000, 1, "NoExiste")
    assert gateway.list_passengers() == before
    assert audit.entries == [
        {
            "action": "passenger.custom_field.deleted",
            "outcome": "failure",
            "entity_type": "passenger",
            "entity_id": "1000:1",
            "details": {"key": "NoExiste", "code": "not_found"},
        }
    ]


def test_audit_failures_reraises_original_error(audit):
    error = UpstreamError("Wialon no pudo completar la operación.")
    with pytest.raises(UpstreamError) as raised:
        with audit_failures(audit, "x.y", entity_type="t", entity_id=1, details={"a": 1}):
            raise error
    assert raised.value is error
    assert audit.entries[0]["details"] == {"a": 1, "code": "upstream_error"}


def test_unexpected_errors_are_not_swallowed_nor_audited(audit):
    with pytest.raises(RuntimeError):
        with audit_failures(audit, "x.y", entity_type="t", entity_id=1):
            raise RuntimeError("bug")
    assert audit.entries == []


def test_resource_resolution(gateway):
    assert ResourceService(gateway).resolve(None) == 1000  # first listed
    assert ResourceService(gateway, default_resource_id=1001).resolve(None) == 1001
    assert ResourceService(gateway, default_resource_id=1001).resolve(1000) == 1000

    class NoResources:
        def list_resources(self):
            return []

    with pytest.raises(ConflictError):
        ResourceService(NoResources()).resolve(None)  # type: ignore[arg-type]


def test_driver_created_in_configured_default_resource(gateway, audit):
    service = DriverService(gateway, audit, ResourceService(gateway, default_resource_id=1001))
    view = service.create(DriverInput(name="Ana", code="C001"))
    assert view.driver.resource_id == 1001
    assert audit.entries[-1]["entity_id"] == f"1001:{view.driver.id}"


def test_driver_bound_to_invisible_unit_is_still_reported(gateway, audit, monkeypatch):
    service = DriverService(gateway, audit, ResourceService(gateway))
    monkeypatch.setattr(gateway, "list_units", lambda: [])
    view = service.get(1000, 1)
    assert view.vehicle is not None and view.vehicle.id == 100
    assert view.vehicle.name == "Unidad 100"


def _vehicles(gateway) -> VehicleService:
    policy = ThresholdStatusPolicy(moving_speed_kmh=5, no_signal_after=timedelta(minutes=60))
    return VehicleService(gateway, policy, clock=lambda: NOW)


def test_dashboard_counts(gateway):
    summary = DashboardService(_vehicles(gateway), gateway, clock=lambda: NOW).summary()
    assert summary.vehicles_total == 24
    assert sum(summary.vehicles_by_status.values()) == 24
    assert summary.vehicles_with_driver + summary.vehicles_without_driver == 24
    assert summary.generated_at == NOW


def test_export_filename_is_dated_and_audited(gateway, audit):
    resources = ResourceService(gateway)
    service = ExportService(
        _vehicles(gateway),
        DriverService(gateway, audit, resources),
        PassengerService(gateway, audit, resources),
        audit,
        clock=lambda: NOW,
    )
    export = service.passengers(assigned=False)
    assert export.filename == "pasajeros_20261109T200000Z.csv"
    assert export.rows == 3
    assert audit.entries[-1]["details"] == {
        "entity": "passengers",
        "rows": 3,
        "filters": {"assigned": False, "sort": "name"},
    }


def test_history_asks_gateway_for_raw_limit_and_filters_range(gateway, monkeypatch):
    calls = []
    original = gateway.load_track

    def spy(unit_id, time_from, time_to, *, max_points):
        calls.append(max_points)
        return original(unit_id, time_from, time_to, max_points=max_points)

    monkeypatch.setattr(gateway, "load_track", spy)
    result = HistoryService(gateway).track(100, NOW - timedelta(hours=1), NOW, max_points=100)
    assert calls == [20_000]
    assert result.stats.total_points == 61 and result.stats.returned_points <= 100
    assert all(NOW - timedelta(hours=1) <= p.recorded_at <= NOW for p in result.points)
