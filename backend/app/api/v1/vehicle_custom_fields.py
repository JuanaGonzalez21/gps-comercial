"""Vehicle custom fields (RF-19, RF-20, RF-22), stored in Wialon."""

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_vehicle_custom_field_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES
from app.api.schemas.vehicles import CustomFieldIn, CustomFieldOut, CustomFieldUpdateIn
from app.domain.permissions import Permission
from app.services.vehicle_custom_field_service import VehicleCustomFieldService

router = APIRouter(prefix="/vehicles", tags=["vehicles"], responses=PROBLEM_RESPONSES)

_can_read = require_permission(Permission.VEHICLES_READ)
_can_write = require_permission(Permission.VEHICLE_CUSTOM_FIELDS_WRITE)


@router.get(
    "/{vehicle_id}/custom-fields",
    response_model=list[CustomFieldOut],
    dependencies=[Depends(_can_read)],
    summary="Campos personalizados del vehículo",
)
def list_custom_fields(
    vehicle_id: int,
    service: VehicleCustomFieldService = Depends(get_vehicle_custom_field_service),
) -> list[CustomFieldOut]:
    return [CustomFieldOut.from_domain(field) for field in service.list_fields(vehicle_id)]


@router.post(
    "/{vehicle_id}/custom-fields",
    response_model=CustomFieldOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_can_write)],
    summary="Crear un campo personalizado en el vehículo",
)
def create_custom_field(
    vehicle_id: int,
    body: CustomFieldIn,
    service: VehicleCustomFieldService = Depends(get_vehicle_custom_field_service),
) -> CustomFieldOut:
    return CustomFieldOut.from_domain(service.create(vehicle_id, body.name, body.value))


@router.put(
    "/{vehicle_id}/custom-fields/{field_id}",
    response_model=CustomFieldOut,
    dependencies=[Depends(_can_write)],
    summary="Editar un campo personalizado (409 si cambió en Wialon mientras se editaba)",
)
def update_custom_field(
    vehicle_id: int,
    field_id: int,
    body: CustomFieldUpdateIn,
    service: VehicleCustomFieldService = Depends(get_vehicle_custom_field_service),
) -> CustomFieldOut:
    field = service.update(
        vehicle_id, field_id, body.name, body.value, expected_value=body.expected_value
    )
    return CustomFieldOut.from_domain(field)


@router.delete(
    "/{vehicle_id}/custom-fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_can_write)],
    summary="Eliminar un campo personalizado del vehículo",
)
def delete_custom_field(
    vehicle_id: int,
    field_id: int,
    service: VehicleCustomFieldService = Depends(get_vehicle_custom_field_service),
) -> Response:
    service.delete(vehicle_id, field_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
