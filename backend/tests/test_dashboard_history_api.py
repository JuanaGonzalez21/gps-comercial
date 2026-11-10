"""RF-23 dashboard KPIs and RF-24 route history over the simulated fleet."""

from datetime import UTC, datetime, timedelta

import pytest

START = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def test_dashboard_summary(login_as) -> None:
    client = login_as("viewer")
    body = client.get("/api/v1/dashboard/summary").json()
    assert body["vehicles_total"] == 24
    assert body["vehicles_by_status"] == {"moving": 8, "stopped": 8, "no_signal": 8}
    assert body["vehicles_with_driver"] == 8 and body["vehicles_without_driver"] == 16
    assert body["drivers_total"] == 10 and body["passengers_total"] == 15
    assert body["generated_at"].endswith("Z")


def test_dashboard_follows_remote_changes(login_as) -> None:
    client = login_as("operator")
    client.put("/api/v1/drivers/1000/9/assignment", json={"unit_id": 120})
    client.delete("/api/v1/passengers/1000/15")
    body = client.get("/api/v1/dashboard/summary").json()
    assert body["vehicles_with_driver"] == 9 and body["passengers_total"] == 14


def test_short_track_is_returned_complete(login_as) -> None:
    client = login_as("viewer")
    end = START + timedelta(hours=2)
    response = client.get(
        "/api/v1/vehicles/100/track", params={"from": _iso(START), "to": _iso(end)}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["vehicle_id"] == 100
    assert body["from"] == "2026-11-02T12:00:00Z" and body["to"] == "2026-11-02T14:00:00Z"
    stats = body["stats"]
    assert stats["total_points"] == stats["returned_points"] == len(body["points"]) == 121
    assert stats["simplified"] is False and stats["truncated"] is False
    assert stats["duration_s"] == 7200
    assert stats["distance_km"] > 0
    assert stats["max_speed_kmh"] >= stats["avg_speed_kmh"] > 0
    point = body["points"][0]
    assert set(point) == {"recorded_at", "latitude", "longitude", "speed_kmh", "course_deg"}
    assert point["recorded_at"] == "2026-11-02T12:00:00Z"


def test_long_track_is_simplified_keeping_ends(login_as) -> None:
    client = login_as("viewer")
    end = START + timedelta(days=3)
    response = client.get(
        "/api/v1/vehicles/100/track",
        params={"from": _iso(START), "to": _iso(end), "max_points": 500},
    )
    body = response.json()
    stats = body["stats"]
    assert stats["total_points"] == 3 * 24 * 60 + 1
    assert stats["simplified"] is True
    assert 2 <= stats["returned_points"] == len(body["points"]) <= 500
    assert body["points"][0]["recorded_at"] == _iso(START)
    assert body["points"][-1]["recorded_at"] == _iso(end)
    times = [p["recorded_at"] for p in body["points"]]
    assert times == sorted(times)
    # Statistics describe the whole route, not the simplified drawing.
    assert stats["duration_s"] == 3 * 86_400


def test_offsets_are_normalized_to_utc(login_as) -> None:
    client = login_as("viewer")
    response = client.get(
        "/api/v1/vehicles/100/track",
        params={"from": "2026-11-02T07:00:00-05:00", "to": "2026-11-02T08:00:00-05:00"},
    )
    assert response.json()["from"] == "2026-11-02T12:00:00Z"


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"from": "2026-11-02T12:00:00Z", "to": "2026-11-02T12:00:00Z"}, "to"),
        ({"from": "2026-11-02T12:00:00Z", "to": "2026-11-01T12:00:00Z"}, "to"),
        ({"from": "2026-11-01T00:00:00Z", "to": "2026-11-08T00:00:01Z"}, "to"),
        ({"from": "2026-11-02T12:00:00", "to": "2026-11-02T13:00:00Z"}, "from"),
        ({"from": "ayer", "to": "2026-11-02T13:00:00Z"}, "from"),
        ({"to": "2026-11-02T13:00:00Z"}, "from"),
        (
            {"from": "2026-11-02T12:00:00Z", "to": "2026-11-02T13:00:00Z", "max_points": 99},
            "max_points",
        ),
        (
            {"from": "2026-11-02T12:00:00Z", "to": "2026-11-02T13:00:00Z", "max_points": 5001},
            "max_points",
        ),
    ],
)
def test_track_validation(login_as, params, field) -> None:
    client = login_as("viewer")
    response = client.get("/api/v1/vehicles/100/track", params=params)
    assert response.status_code == 422
    assert [e["field"] for e in response.json()["errors"]] == [field]


def test_exactly_seven_days_is_allowed_and_unknown_vehicle_is_404(login_as) -> None:
    client = login_as("viewer")
    week = {"from": _iso(START), "to": _iso(START + timedelta(days=7))}
    assert client.get("/api/v1/vehicles/100/track", params=week).status_code == 200
    missing = client.get("/api/v1/vehicles/999/track", params=week)
    assert missing.status_code == 404
