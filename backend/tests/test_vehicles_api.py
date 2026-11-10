"""Vehicle endpoints over the simulated fleet (no network)."""

from app.domain.fleet import VehicleStatus


def test_list_is_paginated_server_side(login_as) -> None:
    client = login_as("viewer")
    body = client.get("/api/v1/vehicles", params={"page": 2, "page_size": 10}).json()
    assert body["total"] == 24
    assert body["page"] == 2 and body["page_size"] == 10 and body["pages"] == 3
    assert len(body["items"]) == 10


def test_status_filter_and_search(login_as) -> None:
    client = login_as("viewer")
    moving = client.get("/api/v1/vehicles", params={"status": "moving", "page_size": 100}).json()
    assert moving["total"] == 8
    assert {v["status"] for v in moving["items"]} == {VehicleStatus.MOVING}
    found = client.get("/api/v1/vehicles", params={"search": "simulado 03"}).json()
    assert [v["name"] for v in found["items"]] == ["Vehículo simulado 03"]


def test_driver_shown_when_bound(login_as) -> None:
    client = login_as("viewer")
    items = client.get("/api/v1/vehicles", params={"page_size": 100}).json()["items"]
    first = next(v for v in items if v["id"] == 100)
    assert first["driver"]["name"] == "Conductor simulado 01"
    unbound = next(v for v in items if v["id"] == 120)
    assert unbound["driver"] is None


def test_timestamps_are_iso_utc(login_as) -> None:
    client = login_as("viewer")
    item = client.get("/api/v1/vehicles").json()["items"][0]
    assert item["last_message_at"].endswith("Z")
    assert item["position"]["recorded_at"].endswith("Z")


def test_positions_include_every_vehicle_independent_of_paging(login_as) -> None:
    client = login_as("viewer")
    body = client.get("/api/v1/vehicles/positions").json()
    assert len(body["items"]) == 24
    assert set(body["items"][0]) == {
        "id",
        "name",
        "status",
        "latitude",
        "longitude",
        "speed_kmh",
        "course_deg",
        "last_message_at",
        "driver_name",
    }


def test_detail_and_not_found(login_as) -> None:
    client = login_as("viewer")
    detail = client.get("/api/v1/vehicles/100").json()
    assert detail["custom_fields"][0]["name"] == "Placa"
    assert len(detail["passengers"]) >= 1
    missing = client.get("/api/v1/vehicles/999999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_invalid_query_returns_problem_details(login_as) -> None:
    client = login_as("viewer")
    response = client.get("/api/v1/vehicles", params={"page_size": 1000, "status": "flying"})
    assert response.status_code == 422
    fields = {e["field"] for e in response.json()["errors"]}
    assert fields == {"page_size", "status"}


def test_security_headers_present(login_as) -> None:
    client = login_as("viewer")
    response = client.get("/api/v1/vehicles")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-request-id"]


def test_system_info_reveals_simulated_source(login_as) -> None:
    client = login_as("viewer")
    assert client.get("/api/v1/system/info").json()["fleet_source"] == "fake"
