"""Passenger contracts (RF-08, RF-09, RF-27, RF-28). Wialon tags have no description."""

from pydantic import BaseModel, Field, field_validator

from app.api.schemas.assignments import VehicleRefOut
from app.api.schemas.fields import (
    CustomFieldKey,
    CustomFieldValue,
    EntityName,
    OptionalCode,
    OptionalPhone,
)
from app.domain.fleet import PassengerInput
from app.services.passenger_service import PassengerView

MAX_CUSTOM_FIELDS = 50


class PassengerCustomFieldOut(BaseModel):
    key: str
    value: str


class PassengerCustomFieldIn(BaseModel):
    key: CustomFieldKey
    value: CustomFieldValue


class PassengerCustomFieldUpdateIn(BaseModel):
    value: CustomFieldValue
    new_key: CustomFieldKey | None = Field(
        default=None, description="Nueva clave si se quiere renombrar el campo."
    )


class PassengerOut(BaseModel):
    resource_id: int
    id: int
    name: str
    code: str | None
    phone: str | None
    vehicle: VehicleRefOut | None
    custom_fields: list[PassengerCustomFieldOut]

    @classmethod
    def from_view(cls, view: PassengerView) -> "PassengerOut":
        passenger = view.passenger
        return cls(
            resource_id=passenger.resource_id,
            id=passenger.id,
            name=passenger.name,
            code=passenger.code,
            phone=passenger.phone,
            vehicle=VehicleRefOut.from_ref(view.vehicle),
            custom_fields=[
                PassengerCustomFieldOut(key=key, value=value) for key, value in view.custom_fields
            ],
        )


class PassengerUpdateIn(BaseModel):
    """Basic data only: the passenger's custom fields are kept as they are in Wialon."""

    name: EntityName
    code: OptionalCode = None
    phone: OptionalPhone = None


class PassengerCreateIn(PassengerUpdateIn):
    resource_id: int | None = Field(
        default=None,
        ge=1,
        description="Recurso de Wialon; si falta se usa WIALON_DEFAULT_RESOURCE_ID o el primero.",
    )
    custom_fields: list[PassengerCustomFieldIn] = Field(
        default_factory=list, max_length=MAX_CUSTOM_FIELDS
    )

    @field_validator("custom_fields")
    @classmethod
    def unique_keys(cls, fields: list[PassengerCustomFieldIn]) -> list[PassengerCustomFieldIn]:
        seen: set[str] = set()
        for field in fields:
            folded = field.key.casefold()
            if folded in seen:
                raise ValueError(f"La clave «{field.key}» está repetida.")
            seen.add(folded)
        return fields

    def to_domain(self) -> PassengerInput:
        return PassengerInput(
            name=self.name,
            code=self.code,
            phone=self.phone,
            custom_fields={field.key: field.value for field in self.custom_fields},
        )
