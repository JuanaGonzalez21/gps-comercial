"""CSV exports (RF-25). Each one needs `exports:csv` AND the read permission of its entity, so an
export can never reveal data the role could not list."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_export_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES
from app.domain.fleet import VehicleStatus
from app.domain.permissions import Permission
from app.services.export_service import CsvExport, ExportService

router = APIRouter(prefix="/exports", tags=["exports"], responses=PROBLEM_RESPONSES)

_can_export = require_permission(Permission.EXPORTS_CSV)
_CSV_RESPONSE: dict[int | str, dict[str, object]] = {
    200: {"content": {"text/csv": {}}, "description": "CSV UTF-8 con BOM"}
}
VehicleSort = Literal["name", "-name", "status", "-status", "last_message_at", "-last_message_at"]
NameSort = Literal["name", "-name"]


def _csv(export: CsvExport) -> Response:
    return Response(
        content=export.content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{export.filename}"'},
    )


@router.get(
    "/vehicles.csv",
    response_class=Response,
    responses=_CSV_RESPONSE,
    dependencies=[Depends(_can_export), Depends(require_permission(Permission.VEHICLES_READ))],
    summary="Exportar vehículos a CSV (mismos filtros que el listado)",
)
def export_vehicles(
    search: str | None = Query(default=None, max_length=100),
    status: VehicleStatus | None = None,
    has_driver: bool | None = None,
    sort: VehicleSort = "name",
    service: ExportService = Depends(get_export_service),
) -> Response:
    return _csv(service.vehicles(search=search, status=status, has_driver=has_driver, sort=sort))


@router.get(
    "/drivers.csv",
    response_class=Response,
    responses=_CSV_RESPONSE,
    dependencies=[Depends(_can_export), Depends(require_permission(Permission.DRIVERS_READ))],
    summary="Exportar conductores a CSV (mismos filtros que el listado)",
)
def export_drivers(
    search: str | None = Query(default=None, max_length=100),
    assigned: bool | None = None,
    sort: NameSort = "name",
    service: ExportService = Depends(get_export_service),
) -> Response:
    return _csv(service.drivers(search=search, assigned=assigned, sort=sort))


@router.get(
    "/passengers.csv",
    response_class=Response,
    responses=_CSV_RESPONSE,
    dependencies=[
        Depends(_can_export),
        Depends(require_permission(Permission.PASSENGERS_READ)),
    ],
    summary="Exportar pasajeros a CSV (mismos filtros que el listado)",
)
def export_passengers(
    search: str | None = Query(default=None, max_length=100),
    assigned: bool | None = None,
    vehicle_id: int | None = Query(default=None, ge=1),
    sort: NameSort = "name",
    service: ExportService = Depends(get_export_service),
) -> Response:
    return _csv(
        service.passengers(search=search, assigned=assigned, vehicle_id=vehicle_id, sort=sort)
    )
