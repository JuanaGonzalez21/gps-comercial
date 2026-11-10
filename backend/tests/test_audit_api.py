"""RF-26: the audit log is readable by the Admin with filters and paging."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from tests.conftest import login


def _admin_with_history(client: TestClient, make_user) -> None:
    admin = make_user("admin")
    login(client, "nadie@example.com", "Mala-Clave-123!")  # failed login, unknown e-mail
    assert login(client, admin.email).status_code == 200
    client.post("/api/v1/drivers", json={"name": "Conductor auditado"})


def test_lists_newest_first_with_expected_shape(client, make_user) -> None:
    _admin_with_history(client, make_user)
    body = client.get("/api/v1/audit-logs").json()
    actions = [item["action"] for item in body["items"]]
    assert actions[:3] == ["driver.created", "auth.login_succeeded", "auth.login_failed"]
    first = body["items"][0]
    assert set(first) == {
        "id",
        "occurred_at",
        "actor_email",
        "action",
        "entity_type",
        "entity_id",
        "outcome",
        "ip_address",
        "details",
    }
    assert first["occurred_at"].endswith("Z")
    assert first["entity_id"].startswith("1000:")


def test_filters_by_action_actor_outcome_and_dates(client, make_user) -> None:
    _admin_with_history(client, make_user)
    failed = client.get("/api/v1/audit-logs", params={"outcome": "failure"}).json()
    assert [i["action"] for i in failed["items"]] == ["auth.login_failed"]
    assert failed["items"][0]["actor_email"] == "nadie@example.com"

    by_prefix = client.get("/api/v1/audit-logs", params={"action": "auth."}).json()
    assert {i["action"] for i in by_prefix["items"]} == {
        "auth.login_failed",
        "auth.login_succeeded",
    }
    by_actor = client.get("/api/v1/audit-logs", params={"actor": "NADIE"}).json()
    assert by_actor["total"] == 1

    now = datetime.now(UTC)
    future = client.get(
        "/api/v1/audit-logs", params={"date_from": (now + timedelta(hours=1)).isoformat()}
    ).json()
    assert future["total"] == 0
    window = client.get(
        "/api/v1/audit-logs",
        params={
            "date_from": (now - timedelta(hours=1)).isoformat(),
            "date_to": (now + timedelta(hours=1)).isoformat(),
            "page_size": 1,
        },
    ).json()
    assert window["total"] >= 3 and len(window["items"]) == 1


def test_rejects_naive_dates_and_inverted_ranges(client, make_user) -> None:
    _admin_with_history(client, make_user)
    naive = client.get("/api/v1/audit-logs", params={"date_from": "2026-11-09T10:00:00"})
    assert naive.status_code == 422
    assert naive.json()["errors"][0]["field"] == "date_from"
    inverted = client.get(
        "/api/v1/audit-logs",
        params={"date_from": "2026-11-09T10:00:00Z", "date_to": "2026-11-08T10:00:00Z"},
    )
    assert inverted.status_code == 422
    assert inverted.json()["errors"][0]["field"] == "date_to"
    bad_outcome = client.get("/api/v1/audit-logs", params={"outcome": "maybe"})
    assert bad_outcome.status_code == 422
