"""Driver endpoints (RF-16, RF-17, RF-18). Data lives in Wialon; ids are scoped by resource."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_driver_service, require_permission
from app.api.schemas.assignments import AssignmentIn
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.api.schemas.drivers import DriverCreateIn, DriverOut, DriverUpdateIn
from app.domain.permissions import Permission
from app.services.driver_service import DriverService

router = APIRouter(prefix="/drivers", tags=["drivers"], responses=PROBLEM_RESPONSES)

# "-created": recently added first (see services.common.newest_first_key).
DriverSort = Literal["name", "-name", "-created"]
_can_read = require_permission(Permission.DRIVERS_READ)
_can_write = require_permission(Permission.DRIVERS_WRITE)
_can_assign = require_permission(Permission.ASSIGNMENTS_WRITE)


@router.get(
    "",
    response_model=Page[DriverOut],
    dependencies=[Depends(_can_read)],
    summary="Listar conductores (búsqueda por nombre, código o teléfono; filtro de asignación)",
)
def list_drivers(
    search: str | None = Query(default=None, max_length=100),
    assigned: bool | None = None,
    sort: DriverSort = "name",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: DriverService = Depends(get_driver_service),
) -> Page[DriverOut]:
    result = service.search(
        search=search, assigned=assigned, sort=sort, page=page, page_size=page_size
    )
    items = [DriverOut.from_view(view) for view in result.items]
    return Page.build(items, total=result.total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=DriverOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_can_write)],
    summary="Crear un conductor en Wialon",
)
def create_driver(
    body: DriverCreateIn, service: DriverService = Depends(get_driver_service)
) -> DriverOut:
    return DriverOut.from_view(service.create(body.to_domain(), resource_id=body.resource_id))


@router.get(
    "/{resource_id}/{driver_id}",
    response_model=DriverOut,
    dependencies=[Depends(_can_read)],
    summary="Detalle de un conductor",
)
def get_driver(
    resource_id: int, driver_id: int, service: DriverService = Depends(get_driver_service)
) -> DriverOut:
    return DriverOut.from_view(service.get(resource_id, driver_id))


@router.put(
    "/{resource_id}/{driver_id}",
    response_model=DriverOut,
    dependencies=[Depends(_can_write)],
    summary="Editar un conductor (conserva los demás atributos que guarda Wialon)",
)
def update_driver(
    resource_id: int,
    driver_id: int,
    body: DriverUpdateIn,
    service: DriverService = Depends(get_driver_service),
) -> DriverOut:
    return DriverOut.from_view(service.update(resource_id, driver_id, body.to_domain()))


@router.delete(
    "/{resource_id}/{driver_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_can_write)],
    summary="Eliminar un conductor de Wialon",
)
def delete_driver(
    resource_id: int, driver_id: int, service: DriverService = Depends(get_driver_service)
) -> Response:
    service.delete(resource_id, driver_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{resource_id}/{driver_id}/assignment",
    response_model=DriverOut,
    dependencies=[Depends(_can_assign)],
    summary="Vincular el conductor a un vehículo (reasigna si ya tenía otro)",
)
def assign_driver(
    resource_id: int,
    driver_id: int,
    body: AssignmentIn,
    service: DriverService = Depends(get_driver_service),
) -> DriverOut:
    return DriverOut.from_view(service.assign(resource_id, driver_id, body.unit_id))


@router.delete(
    "/{resource_id}/{driver_id}/assignment",
    response_model=DriverOut,
    dependencies=[Depends(_can_assign)],
    summary="Desvincular el conductor de su vehículo",
)
def unassign_driver(
    resource_id: int, driver_id: int, service: DriverService = Depends(get_driver_service)
) -> DriverOut:
    return DriverOut.from_view(service.unassign(resource_id, driver_id))
