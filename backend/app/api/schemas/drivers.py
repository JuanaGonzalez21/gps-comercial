"""Driver contracts (RF-16..RF-18)."""

from pydantic import BaseModel, Field

from app.api.schemas.assignments import VehicleRefOut
from app.api.schemas.fields import EntityName, OptionalCode, OptionalDescription, OptionalPhone
from app.domain.fleet import DriverInput
from app.services.driver_service import DriverView


class DriverOut(BaseModel):
    resource_id: int
    id: int
    name: str
    code: str | None
    phone: str | None
    description: str | None
    vehicle: VehicleRefOut | None

    @classmethod
    def from_view(cls, view: DriverView) -> "DriverOut":
        driver = view.driver
        return cls(
            resource_id=driver.resource_id,
            id=driver.id,
            name=driver.name,
            code=driver.code,
            phone=driver.phone,
            description=driver.description,
            vehicle=VehicleRefOut.from_ref(view.vehicle),
        )


class DriverUpdateIn(BaseModel):
    name: EntityName
    code: OptionalCode = None
    phone: OptionalPhone = None
    description: OptionalDescription = None

    def to_domain(self) -> DriverInput:
        return DriverInput(
            name=self.name, code=self.code, phone=self.phone, description=self.description
        )


class DriverCreateIn(DriverUpdateIn):
    resource_id: int | None = Field(
        default=None,
        ge=1,
        description="Recurso de Wialon; si falta se usa WIALON_DEFAULT_RESOURCE_ID o el primero.",
    )
