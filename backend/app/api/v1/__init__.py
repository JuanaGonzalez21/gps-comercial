"""Business API, versioned under /api/v1. Feature routers are included here as they are built."""

from fastapi import APIRouter

api_v1_router = APIRouter(prefix="/api/v1")
