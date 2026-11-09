"""Wialon adapter with a mocked transport (httpx2.MockTransport): no network, no real token."""

import json
from datetime import UTC, datetime
from urllib.parse import parse_qs

import httpx2
import pytest

from app.domain import errors as domain
from app.domain.fleet import DriverInput, PassengerInput
from app.infrastructure.wialon.client import WialonClient
from app.infrastructure.wialon.gateway import WialonFleetGateway

TOKEN = "test-token-not-real"
URL = "https://hst-api.wialon.com/wialon/ajax.html"
NOW_TS = 1_762_700_000

UNITS = {
    "totalItemsCount": 3,
    "items": [
        {
            "id": 1,
            "nm": "Camión 1",
            "pos": {"t": NOW_TS, "y": 4.6, "x": -74.1, "s": 42, "c": 370, "z": 2600, "sc": 9},
            "lmsg": {"t": NOW_TS},
            "flds": {"1": {"id": 1, "n": "Placa", "v": "ABC123"}},
        },
        {
            "id": 2,
            "nm": "Sin GPS",
            "pos": {"t": NOW_TS, "y": 0, "x": 0, "s": 0, "c": 0},
            "lmsg": {"t": NOW_TS},
        },
        {"id": "roto", "nm": None},  # invalid item must be skipped, not break the list
    ],
}
RESOURCES = {
    "totalItemsCount": 1,
    "items": [
        {
            "id": 77,
            "nm": "Recurso",
            "drvrs": {
                "1": {
                    "id": 5,
                    "n": "Ana",
                    "c": "A1",
                    "p": "+57300",
                    "ds": "",
                    "bu": 1,
                    "jp": {"licencia": "B2"},
                    "ej": {"apps": []},
                    "pwd": "x",
                    "ck": 3,
                    "r": 1.5,
                    "f": 4,
                }
            },
            "tags": {
                "9": {
                    "id": 9,
                    "n": "Luis",
                    "c": "L9",
                    "p": "",
                    "bu": 0,
                    "jp": {"Empresa": "ACME", "Turno": "Noche"},
                    "ck": 0,
                    "r": 0,
                    "tz": 134,
                }
            },
        }
    ],
}


class FakeWialon:
    """Records every call and answers from a script of handlers per service."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.logins = 0
        self.handlers: dict[str, object] = {
            "token/login": self._login,
            "core/search_items": self._search,
            "messages/unload": lambda params: {},
            "core/logout": lambda params: {"error": 0},
        }

    def _login(self, params: dict) -> dict:
        assert params == {"token": TOKEN}
        self.logins += 1
        return {"eid": f"sid-{self.logins}", "tm": NOW_TS, "user": {}}

    def _search(self, params: dict) -> dict:
        return UNITS if params["spec"]["itemsType"] == "avl_unit" else RESOURCES

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        svc, params = form["svc"], json.loads(form["params"])
        self.calls.append((svc, params))
        handler = self.handlers[svc]
        result = handler(params) if callable(handler) else handler
        if isinstance(result, Exception):
            raise result
        return httpx2.Response(200, json=result)


def make_gateway(fake: FakeWialon, *, token: str = TOKEN) -> WialonFleetGateway:
    client = WialonClient(
        base_url=URL,
        token=token,
        timeout_seconds=5,
        transport=httpx2.MockTransport(fake),
        sleep=lambda _s: None,
    )
    return WialonFleetGateway(client, cache_ttl_seconds=60)


def test_units_are_validated_and_mapped() -> None:
    gateway = make_gateway(FakeWialon())
    units = {u.id: u for u in gateway.list_units()}
    assert set(units) == {1, 2}  # the malformed item was skipped
    truck = units[1]
    assert truck.last_message_at == datetime.fromtimestamp(NOW_TS, UTC)
    assert truck.position.speed_kmh == 42.0
    assert truck.position.course_deg == 10  # 370 normalised to 0-359
    assert truck.custom_fields[0].name == "Placa"
    assert units[2].position is None  # (0, 0) is not a real fix


def test_reads_are_cached() -> None:
    fake = FakeWialon()
    gateway = make_gateway(fake)
    gateway.list_units()
    gateway.list_units()
    assert [svc for svc, _ in fake.calls].count("core/search_items") == 1
    assert fake.logins == 1


def test_invalid_session_triggers_single_relogin() -> None:
    fake = FakeWialon()
    answers = iter([{"error": 1}, UNITS])
    fake.handlers["core/search_items"] = lambda params: next(answers)
    gateway = make_gateway(fake)
    assert len(gateway.list_units()) == 2
    assert fake.logins == 2


def test_persistent_invalid_session_does_not_loop() -> None:
    fake = FakeWialon()
    fake.handlers["core/search_items"] = {"error": 1}
    with pytest.raises(domain.UpstreamUnavailableError):
        make_gateway(fake).list_units()
    assert fake.logins == 2  # one renewal, then give up


def test_reads_retry_on_transport_errors() -> None:
    fake = FakeWialon()
    answers = iter([httpx2.ReadTimeout("slow"), UNITS])
    fake.handlers["core/search_items"] = lambda params: next(answers)
    assert len(make_gateway(fake).list_units()) == 2


def test_writes_are_not_retried_after_timeout() -> None:
    fake = FakeWialon()
    fake.handlers["resource/update_driver"] = httpx2.ReadTimeout("slow")
    gateway = make_gateway(fake)
    with pytest.raises(domain.UpstreamUnavailableError) as raised:
        gateway.update_driver(77, 5, DriverInput(name="Ana María"))
    assert "No se pudo confirmar" in raised.value.detail
    assert [svc for svc, _ in fake.calls].count("resource/update_driver") == 1


def test_driver_update_preserves_untouched_remote_fields() -> None:
    fake = FakeWialon()
    sent = {}

    def update(params: dict) -> list:
        sent.update(params)
        return [5, {"id": 5, "n": params["n"], "c": params["c"], "p": params["p"], "bu": 1}]

    fake.handlers["resource/update_driver"] = update
    driver = make_gateway(fake).update_driver(77, 5, DriverInput(name="Ana María", code="A1"))
    assert driver.name == "Ana María"
    assert sent["jp"] == {"licencia": "B2"}
    assert (sent["ej"], sent["pwd"], sent["ck"], sent["r"], sent["f"]) == (
        {"apps": []},
        "x",
        3,
        1.5,
        4,
    )
    assert sent["callMode"] == "update"


def test_passenger_update_sends_complete_custom_fields_and_timezone() -> None:
    fake = FakeWialon()
    sent = {}

    def update(params: dict) -> list:
        sent.update(params)
        return [9, {"id": 9, "n": params["n"], "jp": params["jp"], "bu": 0}]

    fake.handlers["resource/update_tag"] = update
    custom = {"Empresa": "ACME", "Turno": "Día"}
    passenger = make_gateway(fake).update_passenger(
        77, 9, PassengerInput(name="Luis", code="L9", custom_fields=custom)
    )
    assert sent["jp"] == custom and sent["tz"] == 134
    assert passenger.custom_fields == custom


def test_unbind_uses_currently_bound_unit() -> None:
    fake = FakeWialon()
    fake.handlers["resource/bind_unit_driver"] = {}
    make_gateway(fake).unbind_driver(77, 5)
    svc, params = fake.calls[-1]
    assert svc == "resource/bind_unit_driver"
    assert params == {"resourceId": 77, "unitId": 1, "driverId": 5, "time": 0, "mode": 0}


def test_unbind_when_not_bound_is_a_conflict() -> None:
    with pytest.raises(domain.ConflictError):
        make_gateway(FakeWialon()).unbind_passenger(77, 9)


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        (7, domain.UpstreamForbiddenError),
        (1002, domain.ConflictError),
        (4, domain.InvalidInputError),
        (6, domain.UpstreamError),
    ],
)
def test_wialon_errors_are_translated(code: int, expected: type) -> None:
    fake = FakeWialon()
    fake.handlers["item/update_custom_field"] = {"error": code}
    with pytest.raises(expected):
        make_gateway(fake).create_unit_custom_field(1, "Color", "Rojo")


def test_missing_token_is_reported_as_not_configured() -> None:
    with pytest.raises(domain.UpstreamNotConfiguredError):
        make_gateway(FakeWialon(), token="").list_units()


def test_track_maps_messages_and_flags_truncation() -> None:
    fake = FakeWialon()
    fake.handlers["messages/load_interval"] = {
        "count": 5,
        "messages": [
            {"t": NOW_TS + 60, "pos": {"y": 4.61, "x": -74.1, "s": 30, "c": 90}},
            {"t": NOW_TS, "pos": {"y": 4.6, "x": -74.1, "s": 0, "c": 0}},
            {"t": NOW_TS + 120, "pos": None},
        ],
    }
    start = datetime.fromtimestamp(NOW_TS - 3600, UTC)
    track = make_gateway(fake).load_track(
        1, start, datetime.fromtimestamp(NOW_TS + 3600, UTC), max_points=3
    )
    assert [p.speed_kmh for p in track.points] == [0.0, 30.0]  # sorted, no position dropped
    assert track.truncated is True
    assert ("messages/unload", {}) in fake.calls


def test_track_without_messages_is_empty() -> None:
    fake = FakeWialon()
    fake.handlers["messages/load_interval"] = {"error": 1001}
    start = datetime.fromtimestamp(NOW_TS - 3600, UTC)
    track = make_gateway(fake).load_track(
        1, start, datetime.fromtimestamp(NOW_TS, UTC), max_points=10
    )
    assert track.points == ()


def test_token_and_session_never_logged(caplog) -> None:
    caplog.set_level("DEBUG")
    fake = FakeWialon()
    fake.handlers["core/search_items"] = {"error": 7}
    with pytest.raises(domain.UpstreamForbiddenError):
        make_gateway(fake).list_units()
    assert TOKEN not in caplog.text and "sid-1" not in caplog.text
