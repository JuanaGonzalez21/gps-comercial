"""CSV exports of vehicles, drivers and passengers (RF-25).

They reuse the list use cases, so an export contains exactly what the list shows with the same
filters (and nothing a role could not read). Output: RFC 4180 CSV, UTF-8 with BOM (Excel detects
the encoding), Spanish headers, ISO-8601 UTC timestamps.

CSV injection (SEG-03, OWASP): spreadsheet programs execute cells that start with = + - @, tab or
carriage return. Text cells get a leading apostrophe so they are shown as text. Numbers formatted
by us (coordinates, speeds, ids) cannot carry a formula and are written untouched, so negative
longitudes stay numeric.
"""

import csv
import io
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.domain.fleet import VehicleStatus
from app.services.audit_service import AuditSink
from app.services.driver_service import DriverService
from app.services.passenger_service import PassengerService
from app.services.vehicle_service import VehicleService

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")
STATUS_LABELS = {
    VehicleStatus.MOVING: "En movimiento",
    VehicleStatus.STOPPED: "Detenido",
    VehicleStatus.NO_SIGNAL: "Sin señal",
}


def safe_cell(value: object) -> object:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Sí" if value else "No"
    if isinstance(value, int | float):
        return value
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    text = str(value)
    return "'" + text if text.startswith(FORMULA_PREFIXES) else text


def render_csv(headers: Sequence[str], rows: Iterable[Sequence[object]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)  # comma, CRLF line ends, quotes only where needed
    writer.writerow([safe_cell(h) for h in headers])
    writer.writerows([safe_cell(v) for v in row] for row in rows)
    return ("﻿" + buffer.getvalue()).encode("utf-8")


@dataclass(frozen=True, slots=True)
class CsvExport:
    filename: str
    content: bytes
    rows: int


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ExportService:
    def __init__(
        self,
        vehicles: VehicleService,
        drivers: DriverService,
        passengers: PassengerService,
        audit: AuditSink,
        *,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._vehicles = vehicles
        self._drivers = drivers
        self._passengers = passengers
        self._audit = audit
        self._clock = clock

    def vehicles(
        self,
        *,
        search: str | None = None,
        status: VehicleStatus | None = None,
        has_driver: bool | None = None,
        sort: str = "name",
    ) -> CsvExport:
        views = self._vehicles.list_all(
            search=search, status=status, has_driver=has_driver, sort=sort
        )
        headers = [
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
        rows = []
        for view in views:
            position = view.unit.position
            rows.append(
                [
                    view.unit.id,
                    view.unit.name,
                    STATUS_LABELS[view.status],
                    view.unit.last_message_at,
                    position.latitude if position else None,
                    position.longitude if position else None,
                    position.speed_kmh if position else None,
                    position.course_deg if position else None,
                    view.driver.name if view.driver else None,
                    view.driver.phone if view.driver else None,
                    len(view.passengers),
                ]
            )
        filters = {"search": search, "status": status, "has_driver": has_driver, "sort": sort}
        return self._export("vehicles", "vehiculos", headers, rows, filters)

    def drivers(
        self, *, search: str | None = None, assigned: bool | None = None, sort: str = "name"
    ) -> CsvExport:
        views = self._drivers.list_all(search=search, assigned=assigned, sort=sort)
        headers = [
            "ID recurso",
            "ID",
            "Nombre",
            "Código",
            "Teléfono",
            "Descripción",
            "ID vehículo",
            "Vehículo",
        ]
        rows = [
            [
                v.driver.resource_id,
                v.driver.id,
                v.driver.name,
                v.driver.code,
                v.driver.phone,
                v.driver.description,
                v.vehicle.id if v.vehicle else None,
                v.vehicle.name if v.vehicle else None,
            ]
            for v in views
        ]
        filters = {"search": search, "assigned": assigned, "sort": sort}
        return self._export("drivers", "conductores", headers, rows, filters)

    def passengers(
        self,
        *,
        search: str | None = None,
        assigned: bool | None = None,
        vehicle_id: int | None = None,
        sort: str = "name",
    ) -> CsvExport:
        views = self._passengers.list_all(
            search=search, assigned=assigned, vehicle_id=vehicle_id, sort=sort
        )
        headers = [
            "ID recurso",
            "ID",
            "Nombre",
            "Código",
            "Teléfono",
            "ID vehículo",
            "Vehículo",
            "Campos personalizados",
        ]
        rows = [
            [
                v.passenger.resource_id,
                v.passenger.id,
                v.passenger.name,
                v.passenger.code,
                v.passenger.phone,
                v.vehicle.id if v.vehicle else None,
                v.vehicle.name if v.vehicle else None,
                "; ".join(f"{key}: {value}" for key, value in v.custom_fields) or None,
            ]
            for v in views
        ]
        filters = {
            "search": search,
            "assigned": assigned,
            "vehicle_id": vehicle_id,
            "sort": sort,
        }
        return self._export("passengers", "pasajeros", headers, rows, filters)

    def _export(
        self,
        entity: str,
        file_stem: str,
        headers: Sequence[str],
        rows: Sequence[Sequence[object]],
        filters: dict[str, Any],
    ) -> CsvExport:
        content = render_csv(headers, rows)
        self._audit.record(
            "export.generated",
            entity_type="export",
            entity_id=entity,
            details={
                "entity": entity,
                "rows": len(rows),
                "filters": {k: v for k, v in filters.items() if v is not None},
            },
        )
        stamp = self._clock().astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
        return CsvExport(filename=f"{file_stem}_{stamp}.csv", content=content, rows=len(rows))
