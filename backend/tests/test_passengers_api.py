"""RF-08, RF-09, RF-27, RF-28: passengers (Wialon tags) and their custom fields.

Simulated data: resource 1000, passengers 1..15; 1..12 bound to units 100..105 (id 1 and 7 on 100);
odd ids carry {"Empresa": "Simulada"}.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.fleet import PassengerInput
from app.infrastructure.db.models import AuditLog

PASSENGERS = "/api/v1/passengers"

T0 = datetime(2026, 11, 10, 15, 0, tzinfo=UTC)


def _fields(fleet, passenger_id: int, resource_id: int = 1000) -> dict[str, str]:
    for passenger in fleet.list_passengers():
        if passenger.resource_id == resource_id and passenger.id == passenger_id:
            return dict(passenger.custom_fields)
    raise AssertionError("passenger not found")


@pytest.fixture
def spy_updates(fleet, monkeypatch) -> list[PassengerInput]:
    """Records every PassengerInput the service sends to the gateway."""
    sent: list[PassengerInput] = []
    original = fleet.update_passenger

    def spy(resource_id: int, passenger_id: int, data: PassengerInput):
        sent.append(data)
        return original(resource_id, passenger_id, data)

    monkeypatch.setattr(fleet, "update_passenger", spy)
    return sent


def _set_created_at(session_factory, action: str, times: dict[str, datetime]) -> None:
    """Pins the audit dates so the order does not depend on how fast the requests ran."""
    with session_factory() as db:
        for entry in db.query(AuditLog).filter_by(action=action):
            if entry.entity_id in times:
                entry.occurred_at = times[entry.entity_id]
        db.commit()


def test_list_filters_and_shape(login_as) -> None:
    client = login_as("viewer")
    body = client.get(PASSENGERS).json()
    assert body["total"] == 15
    assert body["items"][0] == {
        "resource_id": 1000,
        "id": 1,
        "name": "Pasajero simulado 01",
        "code": "P001",
        "phone": None,
        "vehicle": {"id": 100, "name": "Vehículo simulado 01"},
        "custom_fields": [{"key": "Empresa", "value": "Simulada"}],
    }
    assert client.get(PASSENGERS, params={"assigned": True}).json()["total"] == 12
    assert client.get(PASSENGERS, params={"assigned": False}).json()["total"] == 3
    on_100 = client.get(PASSENGERS, params={"vehicle_id": 100}).json()["items"]
    assert [p["id"] for p in on_100] == [1, 7]
    found = client.get(PASSENGERS, params={"search": "p015"}).json()["items"]
    assert [p["id"] for p in found] == [15]
    page = client.get(PASSENGERS, params={"sort": "-name", "page": 2, "page_size": 10}).json()
    assert page["pages"] == 2 and page["items"][-1]["name"] == "Pasajero simulado 01"
    bad = client.get(PASSENGERS, params={"vehicle_id": 0, "sort": "code"})
    assert bad.status_code == 422
    assert {e["field"] for e in bad.json()["errors"]} == {"vehicle_id", "sort"}


def test_create_with_custom_fields(login_as, fleet, session_factory) -> None:
    client = login_as("operator")
    response = client.post(
        PASSENGERS,
        json={
            "name": " Laura ",
            "code": "L-1",
            "custom_fields": [{"key": " Turno ", "value": " Noche "}, {"key": "Área", "value": ""}],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Laura" and body["resource_id"] == 1000 and body["vehicle"] is None
    assert body["custom_fields"] == [
        {"key": "Área", "value": ""},
        {"key": "Turno", "value": "Noche"},
    ]
    assert _fields(fleet, body["id"]) == {"Turno": "Noche", "Área": ""}
    with session_factory() as db:
        entry = db.query(AuditLog).filter_by(action="passenger.created").one()
        assert entry.details["custom_field_keys"] == ["Turno", "Área"]


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"name": ""}, "name"),
        ({"name": "Ana", "phone": "12"}, "phone"),
        ({"name": "Ana", "custom_fields": [{"key": " ", "value": "x"}]}, "custom_fields.0.key"),
        (
            {"name": "Ana", "custom_fields": [{"key": "k" * 51, "value": "x"}]},
            "custom_fields.0.key",
        ),
        (
            {"name": "Ana", "custom_fields": [{"key": "a", "value": "v" * 256}]},
            "custom_fields.0.value",
        ),
        (
            {
                "name": "Ana",
                "custom_fields": [{"key": "Turno", "value": "1"}, {"key": "turno", "value": "2"}],
            },
            "custom_fields",
        ),
    ],
)
def test_create_validation(login_as, payload, field) -> None:
    client = login_as("operator")
    response = client.post(PASSENGERS, json=payload)
    assert response.status_code == 422
    assert [e["field"] for e in response.json()["errors"]] == [field]


def test_duplicate_code_in_resource_is_409(login_as) -> None:
    client = login_as("operator")
    assert client.post(PASSENGERS, json={"name": "X", "code": "p001"}).status_code == 409
    assert client.put(f"{PASSENGERS}/1000/2", json={"name": "X", "code": "P001"}).status_code == 409


def test_basic_update_keeps_every_custom_field(login_as, fleet, spy_updates) -> None:
    client = login_as("operator")
    assert (
        client.post(
            f"{PASSENGERS}/1000/1/custom-fields", json={"key": "Turno", "value": "Noche"}
        ).status_code
        == 201
    )
    response = client.put(
        f"{PASSENGERS}/1000/1", json={"name": "Pasajera renombrada", "phone": "+57 301 000 0000"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Pasajera renombrada" and body["code"] is None
    assert body["custom_fields"] == [
        {"key": "Empresa", "value": "Simulada"},
        {"key": "Turno", "value": "Noche"},
    ]
    assert body["vehicle"]["id"] == 100  # binding untouched
    # The gateway received the COMPLETE field set, not only the edited attributes (RF-27).
    assert dict(spy_updates[-1].custom_fields) == {"Empresa": "Simulada", "Turno": "Noche"}
    assert _fields(fleet, 1) == {"Empresa": "Simulada", "Turno": "Noche"}


def test_put_ignores_custom_fields_in_body(login_as, fleet) -> None:
    client = login_as("operator")
    response = client.put(
        f"{PASSENGERS}/1000/1", json={"name": "Otro", "custom_fields": [{"key": "x", "value": "y"}]}
    )
    assert response.status_code == 200
    assert _fields(fleet, 1) == {"Empresa": "Simulada"}


def test_custom_field_crud_preserves_other_fields(
    login_as, fleet, spy_updates, session_factory
) -> None:
    client = login_as("operator")
    base = f"{PASSENGERS}/1000/1/custom-fields"
    assert client.get(base).json() == [{"key": "Empresa", "value": "Simulada"}]

    created = client.post(base, json={"key": "Turno", "value": "Noche"})
    assert created.status_code == 201 and created.json() == {"key": "Turno", "value": "Noche"}
    assert dict(spy_updates[-1].custom_fields) == {"Empresa": "Simulada", "Turno": "Noche"}

    assert client.post(base, json={"key": "empresa", "value": "x"}).status_code == 409

    edited = client.put(f"{base}/Empresa", json={"value": "GPS Control"})
    assert edited.status_code == 200 and edited.json() == {"key": "Empresa", "value": "GPS Control"}
    assert _fields(fleet, 1) == {"Empresa": "GPS Control", "Turno": "Noche"}

    renamed = client.put(f"{base}/Empresa", json={"value": "GPS Control", "new_key": "Compañía"})
    assert renamed.json() == {"key": "Compañía", "value": "GPS Control"}
    assert _fields(fleet, 1) == {"Compañía": "GPS Control", "Turno": "Noche"}
    assert (
        client.put(f"{base}/Compañía", json={"value": "x", "new_key": "turno"}).status_code == 409
    )
    assert client.put(f"{base}/NoExiste", json={"value": "x"}).status_code == 404

    assert client.delete(f"{base}/Turno").status_code == 204
    assert _fields(fleet, 1) == {"Compañía": "GPS Control"}
    assert client.delete(f"{base}/Turno").status_code == 404
    # Basic data was re-sent unchanged with every field operation.
    assert {(d.name, d.code) for d in spy_updates} == {("Pasajero simulado 01", "P001")}

    with session_factory() as db:
        outcomes = [
            (e.action, e.outcome)
            for e in db.query(AuditLog)
            .filter(AuditLog.action.like("passenger.custom_field.%"))
            .order_by(AuditLog.id)
        ]
    assert outcomes == [
        ("passenger.custom_field.created", "success"),
        ("passenger.custom_field.created", "failure"),
        ("passenger.custom_field.updated", "success"),
        ("passenger.custom_field.updated", "success"),
        ("passenger.custom_field.updated", "failure"),
        ("passenger.custom_field.updated", "failure"),
        ("passenger.custom_field.deleted", "success"),
        ("passenger.custom_field.deleted", "failure"),
    ]


def test_custom_field_key_with_slash_and_spaces(login_as, fleet) -> None:
    client = login_as("operator")
    base = f"{PASSENGERS}/1000/2/custom-fields"
    assert client.post(base, json={"key": "Fecha/hora alta", "value": "1"}).status_code == 201
    response = client.put(f"{base}/Fecha%2Fhora%20alta", json={"value": "2"})
    assert response.status_code == 200
    assert _fields(fleet, 2) == {"Fecha/hora alta": "2"}


def test_custom_field_validation_and_unknown_passenger(login_as) -> None:
    client = login_as("operator")
    base = f"{PASSENGERS}/1000/1/custom-fields"
    response = client.post(base, json={"key": "", "value": "x"})
    assert response.status_code == 422 and response.json()["errors"][0]["field"] == "key"
    long_value = client.put(f"{base}/Empresa", json={"value": "v" * 256})
    assert long_value.json()["errors"][0]["field"] == "value"
    assert client.get(f"{PASSENGERS}/1000/999/custom-fields").status_code == 404
    assert (
        client.post(
            f"{PASSENGERS}/1000/999/custom-fields", json={"key": "a", "value": "b"}
        ).status_code
        == 404
    )


def test_assign_reassign_and_unassign(login_as, session_factory) -> None:
    client = login_as("operator")
    assigned = client.put(f"{PASSENGERS}/1000/13/assignment", json={"unit_id": 110})
    assert assigned.status_code == 200
    assert assigned.json()["vehicle"] == {"id": 110, "name": "Vehículo simulado 11"}
    detail = client.get("/api/v1/vehicles/110").json()
    assert [p["id"] for p in detail["passengers"]] == [13]  # RF-09: listed on the vehicle

    assert client.put(f"{PASSENGERS}/1000/13/assignment", json={"unit_id": 110}).status_code == 409
    moved = client.put(f"{PASSENGERS}/1000/13/assignment", json={"unit_id": 111})
    assert moved.json()["vehicle"]["id"] == 111
    assert client.get("/api/v1/vehicles/110").json()["passengers"] == []

    unassigned = client.delete(f"{PASSENGERS}/1000/13/assignment")
    assert unassigned.status_code == 200 and unassigned.json()["vehicle"] is None
    assert client.delete(f"{PASSENGERS}/1000/13/assignment").status_code == 409
    with session_factory() as db:
        moves = db.query(AuditLog).filter_by(action="passenger.assigned").order_by(AuditLog.id)
        assert [(e.outcome, (e.details or {}).get("previous_unit_id")) for e in moves] == [
            ("success", None),
            ("failure", None),
            ("success", 110),
        ]


@pytest.mark.parametrize(
    ("path", "unit_id"),
    [(f"{PASSENGERS}/1000/13/assignment", 999), (f"{PASSENGERS}/1000/999/assignment", 100)],
)
def test_assignment_to_unknown_vehicle_or_passenger(login_as, path, unit_id) -> None:
    client = login_as("operator")
    assert client.put(path, json={"unit_id": unit_id}).status_code == 404


def test_delete(login_as, session_factory) -> None:
    client = login_as("operator")
    assert client.delete(f"{PASSENGERS}/1000/15").status_code == 204
    assert client.get(f"{PASSENGERS}/1000/15").status_code == 404
    with session_factory() as db:
        entry = db.query(AuditLog).filter_by(action="passenger.deleted").one()
        assert entry.entity_id == "1000:15" and entry.details == {"name": "Pasajero simulado 15"}


def test_sort_newest_first_uses_audit_dates_across_resources(login_as, session_factory) -> None:
    client = login_as("operator")
    first = client.post(PASSENGERS, json={"name": "Primera", "resource_id": 1000}).json()
    second = client.post(PASSENGERS, json={"name": "Segunda", "resource_id": 1001}).json()
    _set_created_at(
        session_factory,
        "passenger.created",
        {f"1000:{first['id']}": T0, f"1001:{second['id']}": T0 + timedelta(minutes=1)},
    )
    items = client.get(PASSENGERS, params={"sort": "-created", "page_size": 50}).json()["items"]
    assert [(p["resource_id"], p["id"]) for p in items[:2]] == [
        (1001, second["id"]),
        (1000, first["id"]),
    ]
    assert [p["id"] for p in items[2:]] == list(range(15, 0, -1))
    export = client.get("/api/v1/exports/passengers.csv", params={"sort": "-created"})
    assert export.status_code == 200
