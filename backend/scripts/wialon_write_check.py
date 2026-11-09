"""Write verification against the real Wialon account, using ONLY our own test data.

Usage (from backend/):  uv run python scripts/wialon_write_check.py

Creates a driver and a passenger named "ZZ-PRUEBA-GPS-COMERCIAL ...", edits them, binds them to a
vehicle that currently has NO driver and unbinds them, creates/edits/deletes a test custom field on
that vehicle, and finally deletes everything it created (also on failure). Existing third-party data
is only read. It prints step results, never the token, session id or personal data.
"""

import sys
import time
from collections.abc import Callable

from app.core.config import Settings
from app.domain.fleet import DriverInput, PassengerInput
from app.infrastructure.wialon.client import WialonClient
from app.infrastructure.wialon.gateway import WialonFleetGateway

PREFIX = "ZZ-PRUEBA-GPS-COMERCIAL"
results: list[tuple[str, bool]] = []


def step(name: str, check: Callable[[], bool]) -> bool:
    try:
        ok = bool(check())
    except Exception as exc:  # noqa: BLE001 - report and continue to cleanup
        print(f"  [FALLO] {name}: {type(exc).__name__}: {getattr(exc, 'detail', exc)}")
        results.append((name, False))
        return False
    print(f"  [{'OK' if ok else 'FALLO'}] {name}")
    results.append((name, ok))
    return ok


def main() -> int:
    settings = Settings()
    client = WialonClient(
        base_url=str(settings.wialon_base_url),
        token=settings.wialon_token.get_secret_value(),
        timeout_seconds=settings.wialon_timeout_seconds,
    )
    gw = WialonFleetGateway(client, cache_ttl_seconds=0)  # no cache: every check re-reads Wialon
    stamp = time.strftime("%Y%m%d%H%M%S")
    created_driver = created_passenger = created_field = None
    try:
        resources = gw.list_resources()
        drivers = gw.list_drivers()
        resource_id = max(resources, key=lambda r: sum(d.resource_id == r.id for d in drivers)).id
        bound_units = {d.unit_id for d in drivers if d.unit_id}
        units = [u for u in gw.list_units() if u.id not in bound_units]
        target = units[0]
        before_fields = {(f.id, f.name, f.value) for f in target.custom_fields}
        print(f"Recurso de prueba: {resource_id} | vehículo sin conductor elegido: {target.id}")

        print("Conductor:")
        created_driver = gw.create_driver(
            resource_id,
            DriverInput(
                name=f"{PREFIX} conductor {stamp}",
                code=f"ZZ{stamp}",
                phone="+573000000000",
                description="Creado por prueba",
            ),
        )
        step("crear", lambda: any(d.id == created_driver.id for d in gw.list_drivers()))
        gw.update_driver(
            resource_id,
            created_driver.id,
            DriverInput(
                name=f"{PREFIX} conductor editado",
                code=f"ZZ{stamp}",
                phone="+573000000001",
                description="Editado por prueba",
            ),
        )
        step(
            "editar (nombre y teléfono reflejados)",
            lambda: any(
                d.id == created_driver.id
                and d.name.endswith("editado")
                and d.phone == "+573000000001"
                for d in gw.list_drivers()
            ),
        )
        gw.bind_driver(resource_id, created_driver.id, target.id)
        step(
            "vincular a vehículo",
            lambda: any(
                d.id == created_driver.id and d.unit_id == target.id for d in gw.list_drivers()
            ),
        )
        gw.unbind_driver(resource_id, created_driver.id)
        step(
            "desvincular",
            lambda: any(d.id == created_driver.id and d.unit_id is None for d in gw.list_drivers()),
        )

        print("Pasajero:")
        created_passenger = gw.create_passenger(
            resource_id,
            PassengerInput(
                name=f"{PREFIX} pasajero {stamp}",
                code=f"ZP{stamp}",
                custom_fields={"Empresa": "Prueba", "Turno": "Noche"},
            ),
        )
        step(
            "crear con campos personalizados",
            lambda: any(
                p.id == created_passenger.id
                and dict(p.custom_fields) == {"Empresa": "Prueba", "Turno": "Noche"}
                for p in gw.list_passengers()
            ),
        )
        gw.update_passenger(
            resource_id,
            created_passenger.id,
            PassengerInput(
                name=f"{PREFIX} pasajero editado",
                code=f"ZP{stamp}",
                custom_fields={"Empresa": "Prueba", "Turno": "Día"},
            ),
        )
        step(
            "editar sin perder campos",
            lambda: any(
                p.id == created_passenger.id
                and p.name.endswith("editado")
                and dict(p.custom_fields) == {"Empresa": "Prueba", "Turno": "Día"}
                for p in gw.list_passengers()
            ),
        )
        gw.update_passenger(
            resource_id,
            created_passenger.id,
            PassengerInput(
                name=f"{PREFIX} pasajero editado",
                code=f"ZP{stamp}",
                custom_fields={"Empresa": "Prueba"},
            ),
        )
        step(
            "eliminar un campo conservando el otro",
            lambda: any(
                p.id == created_passenger.id and dict(p.custom_fields) == {"Empresa": "Prueba"}
                for p in gw.list_passengers()
            ),
        )
        gw.bind_passenger(resource_id, created_passenger.id, target.id)
        step(
            "asignar a vehículo",
            lambda: any(
                p.id == created_passenger.id and p.unit_id == target.id
                for p in gw.list_passengers()
            ),
        )
        gw.unbind_passenger(resource_id, created_passenger.id)
        step(
            "desasignar",
            lambda: any(
                p.id == created_passenger.id and p.unit_id is None for p in gw.list_passengers()
            ),
        )

        print("Campo personalizado de vehículo:")
        created_field = gw.create_unit_custom_field(target.id, f"{PREFIX} campo", "1")
        step(
            "crear",
            lambda: any(f.id == created_field.id for f in gw.get_unit(target.id).custom_fields),
        )
        gw.update_unit_custom_field(target.id, created_field.id, f"{PREFIX} campo", "2")
        step(
            "editar",
            lambda: any(
                f.id == created_field.id and f.value == "2"
                for f in gw.get_unit(target.id).custom_fields
            ),
        )
        gw.delete_unit_custom_field(target.id, created_field.id)
        created_field = None
        step(
            "eliminar y dejar los campos originales intactos",
            lambda: (
                {(f.id, f.name, f.value) for f in gw.get_unit(target.id).custom_fields}
                == before_fields
            ),
        )
    finally:
        print("Limpieza:")
        if created_field is not None:
            step(
                "borrar campo de prueba",
                lambda: gw.delete_unit_custom_field(target.id, created_field.id) is None,
            )
        if created_passenger is not None:
            gw.delete_passenger(created_passenger.resource_id, created_passenger.id)
            step(
                "borrar pasajero de prueba",
                lambda: all(p.id != created_passenger.id for p in gw.list_passengers()),
            )
        if created_driver is not None:
            gw.delete_driver(created_driver.resource_id, created_driver.id)
            step(
                "borrar conductor de prueba",
                lambda: all(d.id != created_driver.id for d in gw.list_drivers()),
            )
        leftovers = [d for d in gw.list_drivers() if d.name.startswith(PREFIX)]
        leftovers += [p for p in gw.list_passengers() if p.name.startswith(PREFIX)]
        step("sin restos de prueba en Wialon", lambda: not leftovers)
        gw.close()
    failed = [name for name, ok in results if not ok]
    print(f"\nResultado: {len(results) - len(failed)}/{len(results)} comprobaciones OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
