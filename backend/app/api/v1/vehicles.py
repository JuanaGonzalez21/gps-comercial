"""Vehicle endpoints: paginated list, map positions, detail and route history
(RF-10, RF-11, RF-12, RF-13, RF-24)."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime

from app.api.deps import get_history_service, get_vehicle_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.api.schemas.history import TrackOut
from app.api.schemas.vehicles import (
    VehicleDetailOut,
    VehicleMarkerOut,
    VehiclePositionsOut,
    VehicleSummaryOut,
)
from app.domain.fleet import VehicleStatus
from app.domain.permissions import Permission
from app.services.history_service import (
    DEFAULT_POINTS,
    MAX_POINTS,
    MIN_POINTS,
    HistoryService,
)
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


@router.get(
    "/{vehicle_id}/track",
    response_model=TrackOut,
    dependencies=[Depends(require_permission(Permission.HISTORY_READ))],
    summary="Recorrido de un vehículo en un rango (máx. 7 días), simplificado con RDP",
)
def vehicle_track(
    vehicle_id: int,
    time_from: AwareDatetime = Query(alias="from", description="Inicio, ISO-8601 con zona"),
    time_to: AwareDatetime = Query(alias="to", description="Fin, ISO-8601 con zona"),
    max_points: int = Query(
        default=DEFAULT_POINTS,
        ge=MIN_POINTS,
        le=MAX_POINTS,
        description="Máximo de puntos devueltos tras simplificar",
    ),
    service: HistoryService = Depends(get_history_service),
) -> TrackOut:
    return TrackOut.from_result(
        service.track(vehicle_id, time_from, time_to, max_points=max_points)
    )
