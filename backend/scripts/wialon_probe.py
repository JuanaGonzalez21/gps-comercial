"""Read-only probe of the configured Wialon account.

Usage (from backend/):  uv run python scripts/wialon_probe.py

It logs in with WIALON_TOKEN, lists units and resources and prints only counts, JSON keys and
access-right bitmasks, so the real data shape and the token's permissions can be checked before
writing the gateway. It never prints the token, the session id or personal data, and it performs
no write operation (only token/login, core/search_items and core/logout).
"""

import json
import sys
from collections import Counter
from typing import Any

import httpx2

from app.core.config import Settings

# Data flags (Wialon "core/search_items"). Confirmed against the real response by this probe.
UNIT_FLAGS = 0x1 | 0x8 | 0x400  # base, custom fields (flds), last message and position
RESOURCE_FLAGS = 0x1 | 0x100 | 0x200000  # base, drivers (drvrs), tags/passengers (tags)


def call(client: httpx2.Client, url: str, svc: str, params: dict[str, Any], sid: str | None) -> Any:
    data = {"svc": svc, "params": json.dumps(params)}
    if sid:
        data["sid"] = sid
    response = client.post(url, data=data)
    response.raise_for_status()
    body = response.json()
    # {"error": 0} means success (e.g. core/logout); any other code is a failure.
    if isinstance(body, dict) and body.get("error", 0) != 0:
        raise RuntimeError(f"{svc} -> Wialon error {body['error']} {body.get('reason', '')}")
    return body


def search(client: httpx2.Client, url: str, sid: str, items_type: str, flags: int) -> dict:
    spec = {
        "itemsType": items_type,
        "propName": "sys_name",
        "propValueMask": "*",
        "sortType": "sys_name",
    }
    params = {"spec": spec, "force": 1, "flags": flags, "from": 0, "to": 0}
    return call(client, url, "core/search_items", params, sid)


def main() -> int:
    settings = Settings()
    token = settings.wialon_token.get_secret_value()
    if not token:
        print("WIALON_TOKEN ausente: configúralo en backend/.env")
        return 1
    url = str(settings.wialon_base_url)

    with httpx2.Client(timeout=settings.wialon_timeout_seconds) as client:
        login = call(client, url, "token/login", {"token": token}, None)
        sid = login.get("eid")
        print("== token/login: OK" if sid else "== token/login: sin eid")
        print("   claves de la respuesta:", sorted(k for k in login if k not in {"eid", "token"}))
        user = login.get("user") or {}
        print("   claves de user:", sorted(user))
        print("   hora del servidor (tm) presente:", "tm" in login)
        try:
            units = search(client, url, sid, "avl_unit", UNIT_FLAGS)
            items = units.get("items") or []
            total = units.get("totalItemsCount")
            print(f"\n== Unidades: totalItemsCount={total} recibidas={len(items)}")
            print("   dataFlags devueltos:", hex(units.get("dataFlags", 0)))
            keys = Counter(k for item in items for k in item)
            print("   claves por unidad (frecuencia):", dict(sorted(keys.items())))
            with_pos = [i for i in items if i.get("pos")]
            with_lmsg = sum(1 for i in items if i.get("lmsg"))
            print("   con pos:", len(with_pos), "| con lmsg:", with_lmsg)
            if with_pos:
                print("   claves de pos:", sorted(with_pos[0]["pos"]))
            with_flds = sum(1 for i in items if i.get("flds"))
            print("   con campos personalizados (flds no vacío):", with_flds)
            sample_fld = next((i["flds"] for i in items if i.get("flds")), None)
            if sample_fld:
                print("   forma de un campo flds:", sorted(next(iter(sample_fld.values()))))
            print("   uacl distintos:", sorted({hex(i.get("uacl", 0)) for i in items}))

            resources = search(client, url, sid, "avl_resource", RESOURCE_FLAGS)
            ritems = resources.get("items") or []
            rtotal = resources.get("totalItemsCount")
            print(f"\n== Recursos: total={rtotal} recibidos={len(ritems)}")
            print("   dataFlags devueltos:", hex(resources.get("dataFlags", 0)))
            for r in ritems:
                drivers = r.get("drvrs") or {}
                tags = r.get("tags") or {}
                extra = sorted(k for k in r if k not in {"nm", "id", "cls", "mu", "uacl"})
                bound = sum(1 for d in drivers.values() if d.get("bu"))
                print(
                    f"   recurso id={r.get('id')} uacl={hex(r.get('uacl', 0))} "
                    f"conductores={len(drivers)} (vinculados={bound}) pasajeros(tags)={len(tags)} "
                    f"claves={extra}"
                )
            first_driver = next((d for r in ritems for d in (r.get("drvrs") or {}).values()), None)
            if first_driver:
                print("   claves de un conductor:", sorted(first_driver))
                print("   'bu' (unidad vinculada) presente:", "bu" in first_driver)
            first_tag = next((t for r in ritems for t in (r.get("tags") or {}).values()), None)
            if first_tag:
                print("   claves de un pasajero (tag):", sorted(first_tag))
                jp = first_tag.get("jp")
                print("   tipo de jp:", type(jp).__name__, "| claves jp:", len(jp) if jp else 0)
        finally:
            call(client, url, "core/logout", {}, sid)
            print("\n== core/logout: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
