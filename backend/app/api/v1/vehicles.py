"""Vehicle endpoints: paginated list, map positions and detail (RF-10, RF-11, RF-12, RF-13)."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_vehicle_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.api.schemas.vehicles import (
    VehicleDetailOut,
    VehicleMarkerOut,
    VehiclePositionsOut,
    VehicleSummaryOut,
)
from app.domain.fleet import VehicleStatus
from app.domain.permissions import Permission
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["vehicles"], responses=PROBLEM_RESPONSES)

VehicleSort = Literal["name", "-name", "status", "-status", "last_message_at", "-last_message_at"]
_can_read = require_permission(Permission.VEHICLES_READ)


@router.get(
    "",
    response_model=Page[VehicleSummaryOut],
    dependencies=[Depends(_can_read)],
    summary="Listar vehículos (búsqueda, filtros y paginación en servidor)",
)
def list_vehicles(
    search: str | None = Query(default=None, max_length=100),
    status: VehicleStatus | None = None,
    has_driver: bool | None = None,
    sort: VehicleSort = "name",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: VehicleService = Depends(get_vehicle_service),
) -> Page[VehicleSummaryOut]:
    result = service.search(
        search=search,
        status=status,
        has_driver=has_driver,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    items = [VehicleSummaryOut.from_view(view) for view in result.items]
    return Page.build(items, total=result.total, page=page, page_size=page_size)


@router.get(
    "/positions",
    response_model=VehiclePositionsOut,
    dependencies=[Depends(_can_read)],
    summary="Posiciones actuales de todos los vehículos (mapa)",
)
def vehicle_positions(
    search: str | None = Query(default=None, max_length=100),
    status: VehicleStatus | None = None,
    service: VehicleService = Depends(get_vehicle_service),
) -> VehiclePositionsOut:
    views = service.positions(search=search, status=status)
    return VehiclePositionsOut(
        items=[VehicleMarkerOut.from_view(view) for view in views],
        generated_at=datetime.now(UTC),
    )


@router.get(
    "/{vehicle_id}",
    response_model=VehicleDetailOut,
    dependencies=[Depends(_can_read)],
    summary="Detalle de un vehículo con conductor, pasajeros y campos personalizados",
)
def vehicle_detail(
    vehicle_id: int, service: VehicleService = Depends(get_vehicle_service)
) -> VehicleDetailOut:
    return VehicleDetailOut.from_view(service.get(vehicle_id))
