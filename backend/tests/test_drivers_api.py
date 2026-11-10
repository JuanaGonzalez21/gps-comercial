"""RF-16..RF-18: driver CRUD and binding over the simulated fleet (no network).

Simulated data: resource 1000, drivers 1..10 (codes C001..C010), 1..8 bound to units 100..107.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.errors import UpstreamUnavailableError
from app.infrastructure.db.models import AuditLog

DRIVERS = "/api/v1/drivers"

T0 = datetime(2026, 11, 10, 15, 0, tzinfo=UTC)


def _audit(session_factory, action: str) -> list[AuditLog]:
    with session_factory() as db:
        return db.query(AuditLog).filter_by(action=action).order_by(AuditLog.id).all()


def _set_created_at(session_factory, action: str, times: dict[str, datetime]) -> None:
    """Pins the audit dates so the order does not depend on how fast the requests ran."""
    with session_factory() as db:
        for entry in db.query(AuditLog).filter_by(action=action):
            if entry.entity_id in times:
                entry.occurred_at = times[entry.entity_id]
        db.commit()


def test_list_search_filters_sort_and_paging(login_as) -> None:
    client = login_as("viewer")
    body = client.get(DRIVERS).json()
    assert body["total"] == 10 and body["pages"] == 1
    first = body["items"][0]
    assert first == {
        "resource_id": 1000,
        "id": 1,
        "name": "Conductor simulado 01",
        "code": "C001",
        "phone": "+573000000000",
        "description": None,
        "vehicle": {"id": 100, "name": "Vehículo simulado 01"},
    }
    assert client.get(DRIVERS, params={"assigned": True}).json()["total"] == 8
    unassigned = client.get(DRIVERS, params={"assigned": False}).json()["items"]
    assert [d["id"] for d in unassigned] == [9, 10]
    assert all(d["vehicle"] is None for d in unassigned)
    assert [d["code"] for d in client.get(DRIVERS, params={"search": "c003"}).json()["items"]] == [
        "C003"
    ]
    by_phone = client.get(DRIVERS, params={"search": "0000004"}).json()["items"]
    assert [d["id"] for d in by_phone] == [5]
    descending = client.get(DRIVERS, params={"sort": "-name"}).json()["items"]
    assert descending[0]["name"] == "Conductor simulado 10"
    paged = client.get(DRIVERS, params={"page": 4, "page_size": 3}).json()
    assert paged["pages"] == 4 and len(paged["items"]) == 1


def test_detail_and_not_found(login_as) -> None:
    client = login_as("viewer")
    assert client.get(f"{DRIVERS}/1000/2").json()["code"] == "C002"
    for path in (f"{DRIVERS}/1000/999", f"{DRIVERS}/1001/1"):
        response = client.get(path)
        assert response.status_code == 404 and response.json()["code"] == "not_found"


def test_create_uses_default_resource_trims_and_audits(login_as, fleet, session_factory) -> None:
    client = login_as("operator")
    response = client.post(
        DRIVERS, json={"name": "  Ana Pérez  ", "code": "  ", "phone": " +57 (300) 123-4567 "}
    )
    assert response.status_code == 201, response.text
    driver = response.json()
    assert driver["resource_id"] == 1000  # first resource of the platform
    assert driver["name"] == "Ana Pérez"
    assert driver["code"] is None and driver["description"] is None
    assert driver["phone"] == "+57 (300) 123-4567"
    assert driver["vehicle"] is None
    assert any(d.id == driver["id"] for d in fleet.list_drivers())  # really persisted remotely
    [entry] = _audit(session_factory, "driver.created")
    assert entry.outcome == "success"
    assert entry.entity_type == "driver"
    assert entry.entity_id == f"1000:{driver['id']}"
    assert entry.details == {"name": "Ana Pérez", "resource_id": 1000}


def test_create_in_explicit_resource_allows_code_used_elsewhere(login_as) -> None:
    client = login_as("operator")
    response = client.post(DRIVERS, json={"name": "Apoyo", "code": "C001", "resource_id": 1001})
    assert response.status_code == 201
    assert response.json()["resource_id"] == 1001


@pytest.mark.parametrize(
    ("payload", "field", "message"),
    [
        ({"name": "   "}, "name", "Este campo es obligatorio."),
        ({}, "name", "Este campo es obligatorio."),
        ({"name": "x" * 51}, "name", "Debe tener como máximo 50 caracteres."),
        ({"name": "Ana", "code": "c" * 31}, "code", "Debe tener como máximo 30 caracteres."),
        ({"name": "Ana", "phone": "abc123"}, "phone", None),
        ({"name": "Ana", "phone": "+57 3"}, "phone", None),
        ({"name": "Ana", "description": "d" * 256}, "description", None),
        ({"name": "Ana", "resource_id": 0}, "resource_id", None),
    ],
)
def test_validation_errors(login_as, fleet, payload, field, message) -> None:
    client = login_as("operator")
    before = len(fleet.list_drivers())
    response = client.post(DRIVERS, json=payload)
    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [e["field"] for e in errors] == [field]
    if message:
        assert errors[0]["message"] == message
    assert len(fleet.list_drivers()) == before  # nothing reached the gateway


def test_duplicate_code_is_rejected_before_calling_wialon(
    login_as, fleet, session_factory, monkeypatch
) -> None:
    client = login_as("operator")
    calls = []
    monkeypatch.setattr(fleet, "create_driver", lambda *args: calls.append(args))
    response = client.post(DRIVERS, json={"name": "Copia", "code": "c001"})
    assert response.status_code == 409
    assert "C001".lower() in response.json()["detail"].lower()
    assert calls == []
    [entry] = _audit(session_factory, "driver.created")
    assert entry.outcome == "failure" and entry.details["code"] == "conflict"


def test_unknown_resource_is_404_and_audited_as_failure(login_as, session_factory) -> None:
    client = login_as("operator")
    response = client.post(DRIVERS, json={"name": "Ana", "resource_id": 4242})
    assert response.status_code == 404
    [entry] = _audit(session_factory, "driver.created")
    assert entry.outcome == "failure"
    assert entry.details == {"name": "Ana", "resource_id": 4242, "code": "not_found"}


def test_gateway_failure_is_audited_and_reraised(
    login_as, fleet, session_factory, monkeypatch
) -> None:
    client = login_as("operator")

    def unavailable(*_args):
        raise UpstreamUnavailableError("Wialon no responde.", retry_after_seconds=5)

    monkeypatch.setattr(fleet, "update_driver", unavailable)
    response = client.put(f"{DRIVERS}/1000/1", json={"name": "Nuevo nombre"})
    assert response.status_code == 503
    assert response.json()["code"] == "upstream_unavailable"
    assert response.headers["retry-after"] == "5"
    [entry] = _audit(session_factory, "driver.updated")
    assert entry.outcome == "failure"
    assert entry.entity_id == "1000:1"
    assert entry.details["code"] == "upstream_unavailable"


def test_update_keeps_binding_and_audits_changed_fields(login_as, session_factory) -> None:
    client = login_as("operator")
    response = client.put(
        f"{DRIVERS}/1000/1",
        json={"name": "Conductor simulado 01", "code": "C001", "phone": "3001112233"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "3001112233"
    assert body["vehicle"] == {"id": 100, "name": "Vehículo simulado 01"}
    [entry] = _audit(session_factory, "driver.updated")
    assert entry.details["changed_fields"] == ["phone"]


def test_update_rejects_code_of_another_driver_but_keeps_own(login_as) -> None:
    client = login_as("operator")
    assert client.put(f"{DRIVERS}/1000/1", json={"name": "A", "code": "C002"}).status_code == 409
    assert client.put(f"{DRIVERS}/1000/1", json={"name": "A", "code": "c001"}).status_code == 200
    assert client.put(f"{DRIVERS}/1000/999", json={"name": "A"}).status_code == 404


def test_delete(login_as, session_factory) -> None:
    client = login_as("operator")
    assert client.delete(f"{DRIVERS}/1000/10").status_code == 204
    assert client.get(f"{DRIVERS}/1000/10").status_code == 404
    assert client.delete(f"{DRIVERS}/1000/10").status_code == 404
    entries = _audit(session_factory, "driver.deleted")
    assert [e.outcome for e in entries] == ["success", "failure"]
    assert entries[0].details == {"name": "Conductor simulado 10"}


def test_assign_unbound_driver_shows_on_vehicle(login_as, session_factory) -> None:
    client = login_as("operator")
    response = client.put(f"{DRIVERS}/1000/9/assignment", json={"unit_id": 120})
    assert response.status_code == 200
    assert response.json()["vehicle"] == {"id": 120, "name": "Vehículo simulado 21"}
    assert client.get("/api/v1/vehicles/120").json()["driver"]["id"] == 9
    [entry] = _audit(session_factory, "driver.assigned")
    assert entry.details == {"unit_id": 120, "unit_name": "Vehículo simulado 21"}


def test_reassign_unbinds_previous_unit_first(login_as, fleet, session_factory) -> None:
    client = login_as("operator")
    calls: list[str] = []
    original_unbind, original_bind = fleet.unbind_driver, fleet.bind_driver
    fleet.unbind_driver = lambda *a: (calls.append("unbind"), original_unbind(*a))[1]
    fleet.bind_driver = lambda *a: (calls.append("bind"), original_bind(*a))[1]

    response = client.put(f"{DRIVERS}/1000/1/assignment", json={"unit_id": 121})
    assert response.status_code == 200
    assert response.json()["vehicle"]["id"] == 121
    assert calls == ["unbind", "bind"]
    assert client.get("/api/v1/vehicles/100").json()["driver"] is None
    [entry] = _audit(session_factory, "driver.assigned")
    assert entry.details["previous_unit_id"] == 100


@pytest.mark.parametrize(
    ("path", "unit_id", "status"),
    [
        (f"{DRIVERS}/1000/1/assignment", 100, 409),  # already bound to that vehicle
        (f"{DRIVERS}/1000/1/assignment", 999, 404),  # unknown vehicle
        (f"{DRIVERS}/1000/999/assignment", 100, 404),  # unknown driver
    ],
)
def test_assignment_errors(login_as, path, unit_id, status) -> None:
    client = login_as("operator")
    response = client.put(path, json={"unit_id": unit_id})
    assert response.status_code == status


def test_assignment_body_is_validated(login_as) -> None:
    client = login_as("operator")
    response = client.put(f"{DRIVERS}/1000/9/assignment", json={"unit_id": "x"})
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "unit_id"


def test_unassign_and_unassign_twice(login_as, session_factory) -> None:
    client = login_as("operator")
    response = client.delete(f"{DRIVERS}/1000/2/assignment")
    assert response.status_code == 200 and response.json()["vehicle"] is None
    again = client.delete(f"{DRIVERS}/1000/2/assignment")
    assert again.status_code == 409
    entries = _audit(session_factory, "driver.unassigned")
    assert [(e.outcome, e.details.get("unit_id")) for e in entries] == [
        ("success", 101),
        ("failure", None),
    ]


def test_sort_newest_first_uses_audit_dates_across_resources(login_as, session_factory) -> None:
    client = login_as("operator")
    first = client.post(DRIVERS, json={"name": "Primero", "resource_id": 1000}).json()
    second = client.post(DRIVERS, json={"name": "Segundo", "resource_id": 1001}).json()
    _set_created_at(
        session_factory,
        "driver.created",
        {f"1000:{first['id']}": T0, f"1001:{second['id']}": T0 + timedelta(minutes=1)},
    )
    items = client.get(DRIVERS, params={"sort": "-created"}).json()["items"]
    # Created here: audit date, newest first, even when the newest has the lower Wialon id.
    assert [(d["resource_id"], d["id"]) for d in items[:2]] == [
        (1001, second["id"]),
        (1000, first["id"]),
    ]
    # Created elsewhere (the simulated seed): Wialon id order, newest first.
    assert [d["id"] for d in items[2:]] == list(range(10, 0, -1))
    export = client.get("/api/v1/exports/drivers.csv", params={"sort": "-created"})
    assert export.status_code == 200
    assert ",Segundo," in export.text.splitlines()[1]  # first data row
    assert client.get(DRIVERS, params={"sort": "created"}).status_code == 422
