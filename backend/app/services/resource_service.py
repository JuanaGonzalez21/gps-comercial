"""Wialon resources: the containers where drivers and passengers are created."""

from collections.abc import Sequence

from app.domain.errors import ConflictError
from app.domain.fleet import Resource
from app.domain.ports import FleetGateway


class ResourceService:
    def __init__(self, gateway: FleetGateway, *, default_resource_id: int | None = None) -> None:
        self._gateway = gateway
        self._default_resource_id = default_resource_id

    def list_all(self) -> Sequence[Resource]:
        # Platform order (Wialon sorts by name), so the first listed is also the default below.
        return list(self._gateway.list_resources())

    def resolve(self, resource_id: int | None) -> int:
        """Explicit choice, else WIALON_DEFAULT_RESOURCE_ID, else the first available resource.

        An explicit or configured id that does not exist is rejected by the gateway (404).
        """
        if resource_id is not None:
            return resource_id
        if self._default_resource_id is not None:
            return self._default_resource_id
        resources = self.list_all()
        if not resources:
            raise ConflictError(
                "La cuenta de Wialon no tiene recursos donde crear conductores o pasajeros."
            )
        return resources[0].id
