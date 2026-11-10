"""RF-19, RF-22: vehicle custom fields. Simulated unit 100 has field 1 "Placa" = "SIM000"."""

import pytest

from app.domain.errors import UpstreamError
from app.infrastructure.db.models import AuditLog

BASE = "/api/v1/vehicles/100/custom-fields"


def _actions(session_factory) -> list[tuple[str, str, dict]]:
    with session_factory() as db:
        entries = (
            db.query(AuditLog)
            .filter(AuditLog.action.like("vehicle.custom_field.%"))
            .order_by(AuditLog.id)
        )
        return [(e.action, e.outcome, e.details) for e in entries]


def test_list_create_update_delete(login_as, fleet, session_factory) -> None:
    client = login_as("operator")
    assert client.get(BASE).json() == [{"id": 1, "name": "Placa", "value": "SIM000"}]

    created = client.post(BASE, json={"name": " Color ", "value": " Rojo "})
    assert created.status_code == 201
    field = created.json()
    assert field["name"] == "Color" and field["value"] == "Rojo"

    updated = client.put(f"{BASE}/{field['id']}", json={"name": "Color", "value": "Azul"})
    assert updated.status_code == 200 and updated.json()["value"] == "Azul"
    assert [f.value for f in fleet.get_unit(100).custom_fields] == ["SIM000", "Azul"]

    assert client.delete(f"{BASE}/{field['id']}").status_code == 204
    assert client.get(BASE).json() == [{"id": 1, "name": "Placa", "value": "SIM000"}]
    assert client.delete(f"{BASE}/{field['id']}").status_code == 404

    assert _actions(session_factory) == [
        ("vehicle.custom_field.created", "success", {"name": "Color", "field_id": field["id"]}),
        (
            "vehicle.custom_field.updated",
            "success",
            {"field_id": field["id"], "name": "Color", "changed_fields": ["value"]},
        ),
        ("vehicle.custom_field.deleted", "success", {"field_id": field["id"], "name": "Color"}),
        (
            "vehicle.custom_field.deleted",
            "failure",
            {"field_id": field["id"], "code": "not_found"},
        ),
    ]


def test_expected_value_detects_concurrent_edit(login_as, fleet) -> None:
    client = login_as("operator")
    ok = client.put(
        f"{BASE}/1", json={"name": "Placa", "value": "ABC123", "expected_value": "SIM000"}
    )
    assert ok.status_code == 200
    # Someone changes it in Wialon while another user still has "ABC123" on screen.
    fleet.update_unit_custom_field(100, 1, "Placa", "XYZ999")
    stale = client.put(
        f"{BASE}/1", json={"name": "Placa", "value": "DEF456", "expected_value": "ABC123"}
    )
    assert stale.status_code == 409 and stale.json()["code"] == "conflict"
    assert fleet.get_unit(100).custom_fields[0].value == "XYZ999"  # nothing overwritten
    forced = client.put(f"{BASE}/1", json={"name": "Placa", "value": "DEF456"})
    assert forced.status_code == 200


def test_duplicate_name_is_conflict(login_as) -> None:
    client = login_as("operator")
    assert client.post(BASE, json={"name": "placa", "value": "x"}).status_code == 409
    other = client.post(BASE, json={"name": "Color", "value": "Rojo"}).json()
    rename = client.put(f"{BASE}/{other['id']}", json={"name": "PLACA", "value": "Rojo"})
    assert rename.status_code == 409
    own = client.put(f"{BASE}/1", json={"name": "PLACA", "value": "SIM000"})
    assert own.status_code == 200  # renaming a field to a variant of its own name is fine


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"name": "", "value": "x"}, "name"),
        ({"name": "n" * 51, "value": "x"}, "name"),
        ({"name": "Color", "value": "v" * 256}, "value"),
        ({"value": "x"}, "name"),
    ],
)
def test_validation(login_as, payload, field) -> None:
    client = login_as("operator")
    response = client.post(BASE, json=payload)
    assert response.status_code == 422
    assert [e["field"] for e in response.json()["errors"]] == [field]


def test_unknown_vehicle_or_field(login_as) -> None:
    client = login_as("operator")
    assert client.get("/api/v1/vehicles/999/custom-fields").status_code == 404
    assert (
        client.post(
            "/api/v1/vehicles/999/custom-fields", json={"name": "a", "value": "b"}
        ).status_code
        == 404
    )
    assert client.put(f"{BASE}/77", json={"name": "a", "value": "b"}).status_code == 404


def test_upstream_error_is_audited(login_as, fleet, session_factory, monkeypatch) -> None:
    client = login_as("operator")

    def rejected(*_args):
        raise UpstreamError("Wialon no pudo completar la operación.")

    monkeypatch.setattr(fleet, "create_unit_custom_field", rejected)
    response = client.post(BASE, json={"name": "Color", "value": "Rojo"})
    assert response.status_code == 502 and response.json()["code"] == "upstream_error"
    assert _actions(session_factory) == [
        ("vehicle.custom_field.created", "failure", {"name": "Color", "code": "upstream_error"})
    ]
