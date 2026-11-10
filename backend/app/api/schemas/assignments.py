"""Shared fleet references: resources, the bound vehicle and assignment requests."""

from pydantic import BaseModel, Field

from app.domain.fleet import Resource
from app.services.common import VehicleRef


class ResourceOut(BaseModel):
    id: int
    name: str

    @classmethod
    def from_domain(cls, resource: Resource) -> "ResourceOut":
        return cls(id=resource.id, name=resource.name)


class VehicleRefOut(BaseModel):
    id: int
    name: str

    @classmethod
    def from_ref(cls, ref: VehicleRef | None) -> "VehicleRefOut | None":
        return cls(id=ref.id, name=ref.name) if ref else None


class AssignmentIn(BaseModel):
    unit_id: int = Field(ge=1, description="ID del vehículo (unidad de Wialon).")
