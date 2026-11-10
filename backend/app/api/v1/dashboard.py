"""Dashboard KPIs (RF-23)."""

from fastapi import APIRouter, Depends

from app.api.deps import get_dashboard_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES
from app.api.schemas.dashboard import DashboardSummaryOut
from app.domain.permissions import Permission
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"], responses=PROBLEM_RESPONSES)


@router.get(
    "/summary",
    response_model=DashboardSummaryOut,
    dependencies=[Depends(require_permission(Permission.DASHBOARD_READ))],
    summary="Indicadores de la flota (estado, conductores y pasajeros)",
)
def dashboard_summary(
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardSummaryOut:
    return DashboardSummaryOut.from_summary(service.summary())
