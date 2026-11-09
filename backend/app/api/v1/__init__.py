"""Business API, versioned under /api/v1. Every router is registered here."""

from fastapi import APIRouter, Depends

from app.api.deps import csrf_protect
from app.api.v1 import auth, system, vehicles

# CSRF/Origin protection applies to every state-changing request of the API.
api_v1_router = APIRouter(prefix="/api/v1", dependencies=[Depends(csrf_protect)])
api_v1_router.include_router(auth.router)
api_v1_router.include_router(vehicles.router)
api_v1_router.include_router(system.router)
