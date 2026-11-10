"""Passenger endpoints (RF-08, RF-09, RF-27, RF-28). Passengers are Wialon tags in a resource."""

from typing import Literal

from fastapi import APIRouter, Depends, Path, Query, Response, status

from app.api.deps import get_passenger_service, require_permission
from app.api.schemas.assignments import AssignmentIn
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.api.schemas.passengers import (
    PassengerCreateIn,
    PassengerCustomFieldIn,
    PassengerCustomFieldOut,
    PassengerCustomFieldUpdateIn,
    PassengerOut,
    PassengerUpdateIn,
)
from app.domain.permissions import Permission
from app.services.passenger_service import PassengerService

router = APIRouter(prefix="/passengers", tags=["passengers"], responses=PROBLEM_RESPONSES)

PassengerSort = Literal["name", "-name"]
_can_read = require_permission(Permission.PASSENGERS_READ)
_can_write = require_permission(Permission.PASSENGERS_WRITE)
_can_assign = require_permission(Permission.ASSIGNMENTS_WRITE)
# `:path` lets a key contain "/" (e.g. "Fecha/hora"), sent URL-encoded by the client.
_FIELD = "/{resource_id}/{passenger_id}/custom-fields/{key:path}"


@router.get(
    "",
    response_model=Page[PassengerOut],
    dependencies=[Depends(_can_read)],
    summary="Listar pasajeros (búsqueda, asignación, vehículo y paginación en servidor)",
)
def list_passengers(
    search: str | None = Query(default=None, max_length=100),
    assigned: bool | None = None,
    vehicle_id: int | None = Query(default=None, ge=1),
    sort: PassengerSort = "name",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: PassengerService = Depends(get_passenger_service),
) -> Page[PassengerOut]:
    result = service.search(
        search=search,
        assigned=assigned,
        vehicle_id=vehicle_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    items = [PassengerOut.from_view(view) for view in result.items]
    return Page.build(items, total=result.total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=PassengerOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_can_write)],
    summary="Crear un pasajero en Wialon (con campos personalizados opcionales)",
)
def create_passenger(
    body: PassengerCreateIn, service: PassengerService = Depends(get_passenger_service)
) -> PassengerOut:
    return PassengerOut.from_view(service.create(body.to_domain(), resource_id=body.resource_id))


@router.get(
    "/{resource_id}/{passenger_id}",
    response_model=PassengerOut,
    dependencies=[Depends(_can_read)],
    summary="Detalle de un pasajero",
)
def get_passenger(
    resource_id: int,
    passenger_id: int,
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerOut:
    return PassengerOut.from_view(service.get(resource_id, passenger_id))


@router.put(
    "/{resource_id}/{passenger_id}",
    response_model=PassengerOut,
    dependencies=[Depends(_can_write)],
    summary="Editar nombre, código y teléfono (conserva los campos personalizados)",
)
def update_passenger(
    resource_id: int,
    passenger_id: int,
    body: PassengerUpdateIn,
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerOut:
    view = service.update(
        resource_id, passenger_id, name=body.name, code=body.code, phone=body.phone
    )
    return PassengerOut.from_view(view)


@router.delete(
    "/{resource_id}/{passenger_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_can_write)],
    summary="Eliminar un pasajero de Wialon",
)
def delete_passenger(
    resource_id: int,
    passenger_id: int,
    service: PassengerService = Depends(get_passenger_service),
) -> Response:
    service.delete(resource_id, passenger_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/{resource_id}/{passenger_id}/assignment",
    response_model=PassengerOut,
    dependencies=[Depends(_can_assign)],
    summary="Asignar el pasajero a un vehículo (reasigna si ya tenía otro)",
)
def assign_passenger(
    resource_id: int,
    passenger_id: int,
    body: AssignmentIn,
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerOut:
    return PassengerOut.from_view(service.assign(resource_id, passenger_id, body.unit_id))


@router.delete(
    "/{resource_id}/{passenger_id}/assignment",
    response_model=PassengerOut,
    dependencies=[Depends(_can_assign)],
    summary="Desasignar el pasajero de su vehículo",
)
def unassign_passenger(
    resource_id: int,
    passenger_id: int,
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerOut:
    return PassengerOut.from_view(service.unassign(resource_id, passenger_id))


# ----- custom fields (Wialon `jp`): every write merges into the complete set ---------------
@router.get(
    "/{resource_id}/{passenger_id}/custom-fields",
    response_model=list[PassengerCustomFieldOut],
    dependencies=[Depends(_can_read)],
    summary="Campos personalizados del pasajero",
)
def list_custom_fields(
    resource_id: int,
    passenger_id: int,
    service: PassengerService = Depends(get_passenger_service),
) -> list[PassengerCustomFieldOut]:
    return [
        PassengerCustomFieldOut(key=key, value=value)
        for key, value in service.custom_fields(resource_id, passenger_id)
    ]


@router.post(
    "/{resource_id}/{passenger_id}/custom-fields",
    response_model=PassengerCustomFieldOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_can_write)],
    summary="Crear un campo personalizado (409 si la clave ya existe)",
)
def create_custom_field(
    resource_id: int,
    passenger_id: int,
    body: PassengerCustomFieldIn,
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerCustomFieldOut:
    key, value = service.add_custom_field(resource_id, passenger_id, body.key, body.value)
    return PassengerCustomFieldOut(key=key, value=value)


@router.put(
    _FIELD,
    response_model=PassengerCustomFieldOut,
    dependencies=[Depends(_can_write)],
    summary="Editar el valor de un campo o renombrarlo con new_key",
)
def update_custom_field(
    resource_id: int,
    passenger_id: int,
    body: PassengerCustomFieldUpdateIn,
    key: str = Path(max_length=200),
    service: PassengerService = Depends(get_passenger_service),
) -> PassengerCustomFieldOut:
    new_key, value = service.update_custom_field(
        resource_id, passenger_id, key, value=body.value, new_key=body.new_key
    )
    return PassengerCustomFieldOut(key=new_key, value=value)


@router.delete(
    _FIELD,
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_can_write)],
    summary="Eliminar un campo personalizado (los demás se conservan)",
)
def delete_custom_field(
    resource_id: int,
    passenger_id: int,
    key: str = Path(max_length=200),
    service: PassengerService = Depends(get_passenger_service),
) -> Response:
    service.delete_custom_field(resource_id, passenger_id, key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
