"""RF-25 / SEG-03: CSV exports with the list filters, BOM, Spanish headers and no CSV injection."""

import csv
import io
import re

import pytest

from app.infrastructure.db.models import AuditLog
from app.services.export_service import render_csv, safe_cell


def _rows(response) -> list[list[str]]:
    assert response.content.startswith(b"\xef\xbb\xbf")  # UTF-8 BOM for Excel
    return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ('=HYPERLINK("http://x")', '\'=HYPERLINK("http://x")'),
        ("+573001234567", "'+573001234567"),
        ("-2+3", "'-2+3"),
        ("@SUM(A1)", "'@SUM(A1)"),
        ("\tcmd", "'\tcmd"),
        ("\rcmd", "'\rcmd"),
        ("Bogotá D.C.", "Bogotá D.C."),
        ("a=b", "a=b"),
        (-74.0836, -74.0836),  # numbers we format are never formulas
        (7, 7),
        (None, ""),
        (True, "Sí"),
    ],
)
def test_safe_cell(value, expected) -> None:
    assert safe_cell(value) == expected


def test_render_csv_quotes_and_line_endings() -> None:
    content = render_csv(["Nombre", "Nota"], [["Pérez, Ana", 'dice "hola"\nfin']])
    text = content.decode("utf-8-sig")
    assert text == 'Nombre,Nota\r\n"Pérez, Ana","dice ""hola""\nfin"\r\n'


def test_vehicles_csv(login_as, session_factory) -> None:
    client = login_as("operator")
    response = client.get("/api/v1/exports/vehicles.csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    disposition = response.headers["content-disposition"]
    assert re.fullmatch(r'attachment; filename="vehiculos_\d{8}T\d{6}Z\.csv"', disposition)
    rows = _rows(response)
    assert rows[0] == [
        "ID",
        "Nombre",
        "Estado",
        "Último mensaje (UTC)",
        "Latitud",
        "Longitud",
        "Velocidad (km/h)",
        "Rumbo (grados)",
        "Conductor",
        "Teléfono del conductor",
        "Pasajeros asignados",
    ]
    assert len(rows) == 25
    first = dict(zip(rows[0], rows[1], strict=True))
    assert first["ID"] == "100" and first["Estado"] == "En movimiento"
    assert first["Último mensaje (UTC)"].endswith("Z")
    assert float(first["Longitud"]) < 0  # still numeric: not prefixed
    assert first["Teléfono del conductor"] == "'+573000000000"  # text starting with + is
    assert first["Pasajeros asignados"] == "2"
    with session_factory() as db:
        entry = db.query(AuditLog).filter_by(action="export.generated").one()
        assert entry.details == {"entity": "vehicles", "rows": 24, "filters": {"sort": "name"}}


def test_vehicles_csv_honours_list_filters(login_as) -> None:
    client = login_as("operator")
    moving = _rows(client.get("/api/v1/exports/vehicles.csv", params={"status": "moving"}))
    assert len(moving) == 9 and {r[2] for r in moving[1:]} == {"En movimiento"}
    without_driver = _rows(
        client.get("/api/v1/exports/vehicles.csv", params={"has_driver": False, "sort": "-name"})
    )
    assert len(without_driver) == 17
    assert without_driver[1][1] == "Vehículo simulado 24"
    assert client.get("/api/v1/exports/vehicles.csv", params={"status": "x"}).status_code == 422


def test_drivers_csv(login_as) -> None:
    client = login_as("admin")
    rows = _rows(client.get("/api/v1/exports/drivers.csv", params={"assigned": False}))
    assert rows[0][:3] == ["ID recurso", "ID", "Nombre"]
    assert [r[1] for r in rows[1:]] == ["9", "10"]
    assert rows[1][6:] == ["", ""]  # no vehicle


def test_passengers_csv_neutralizes_injection_from_wialon_data(login_as) -> None:
    client = login_as("operator")
    created = client.post(
        "/api/v1/passengers",
        json={
            "name": '=HYPERLINK("http://evil.example","clic")',
            "code": "@x",
            "custom_fields": [{"key": "+cmd", "value": "-1"}],
        },
    )
    assert created.status_code == 201
    response = client.get("/api/v1/exports/passengers.csv", params={"search": "hyperlink"})
    rows = _rows(response)
    assert len(rows) == 2
    record = dict(zip(rows[0], rows[1], strict=True))
    assert record["Nombre"] == '\'=HYPERLINK("http://evil.example","clic")'
    assert record["Código"] == "'@x"
    assert record["Campos personalizados"] == "'+cmd: -1"
    on_vehicle = _rows(client.get("/api/v1/exports/passengers.csv", params={"vehicle_id": 100}))
    assert [r[1] for r in on_vehicle[1:]] == ["1", "7"]
    assert on_vehicle[1][-1] == "Empresa: Simulada"
