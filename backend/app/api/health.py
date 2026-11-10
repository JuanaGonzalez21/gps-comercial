"""Liveness endpoint.

It only proves the process is up and answering. It deliberately does not call Wialon,
touch the database or return any configuration value.
"""

from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


# Uptime monitors (useful to keep the free instance warm) often probe with HEAD.
@router.head("/health", include_in_schema=False)
def health_head() -> Response:
    return Response(status_code=200)
