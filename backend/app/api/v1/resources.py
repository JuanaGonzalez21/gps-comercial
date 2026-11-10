"""Wialon resources, to choose where drivers and passengers are created."""

from fastapi import APIRouter, Depends

from app.api.deps import get_resource_service, require_permission
from app.api.schemas.assignments import ResourceOut
from app.api.schemas.common import PROBLEM_RESPONSES
from app.domain.permissions import Permission
from app.services.resource_service import ResourceService

router = APIRouter(prefix="/resources", tags=["resources"], responses=PROBLEM_RESPONSES)


@router.get(
    "",
    response_model=list[ResourceOut],
    dependencies=[Depends(require_permission(Permission.DRIVERS_READ))],
    summary="Recursos de Wialon disponibles (contenedores de conductores y pasajeros)",
)
def list_resources(service: ResourceService = Depends(get_resource_service)) -> list[ResourceOut]:
    return [ResourceOut.from_domain(resource) for resource in service.list_all()]
