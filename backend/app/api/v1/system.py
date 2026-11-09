"""System information the UI needs to be honest about its data source."""

from fastapi import APIRouter, Depends

from app.api.deps import get_settings, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES
from app.api.schemas.vehicles import SystemInfoOut
from app.core.config import Settings
from app.domain.permissions import Permission

router = APIRouter(prefix="/system", tags=["system"], responses=PROBLEM_RESPONSES)


@router.get(
    "/info",
    response_model=SystemInfoOut,
    dependencies=[Depends(require_permission(Permission.DASHBOARD_READ))],
    summary="Origen de los datos de flota (Wialon real o simulado)",
)
def system_info(settings: Settings = Depends(get_settings)) -> SystemInfoOut:
    return SystemInfoOut(fleet_source=settings.fleet_gateway, environment=settings.app_env)
