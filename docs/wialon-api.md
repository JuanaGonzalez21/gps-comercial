# Wialon Remote API — referencia verificada para el gateway

Fuentes oficiales (consultadas el 2026-11-09):
- Referencia SDK: https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/apiref (marcada como "no longer supported";
  remite a https://help.wialon.com/en/api, que es la guía indicada por el enunciado).
- Páginas usadas: `format/unit`, `format/resource`, `format/messages`, `token/login`, `core/search_items`,
  `resource/update_driver`, `resource/update_tag`, `resource/bind_unit_driver`, `resource/bind_unit_tag`,
  `item/update_custom_field`, `messages/load_interval`, `messages/unload`, `errors/errors`,
  `core/check_items_billing` (tablas de flags de acceso), bajo `.../remoteapi/apiref/`.

Evidencia real: `backend/scripts/wialon_probe.py` (solo lectura: `token/login`, `core/search_items`, `core/logout`).
Ejecutado el 2026-11-09 con el token de `demoApps` en `backend/.env`; imprime solo conteos, claves y máscaras.

## 1. Formato de petición
- `POST https://hst-api.wialon.com/wialon/ajax.html` con formulario `svc=<servicio>`, `params=<JSON>`, `sid=<sesión>`.
  Usamos POST (el `sid` no viaja en la URL ni queda en logs de acceso).
- Respuesta de error: `{"error": <código>, "reason"?: <texto>}`. `{"error": 0}` es éxito (p. ej. `core/logout`).
- Teléfonos: `+` debe ir codificado como `%2B`; la codificación de formulario de httpx2 ya lo hace.

## 2. Sesión
- `token/login` `params={"token": <token>}` → `eid` (= `sid`), `user`, `tm` (hora del servidor), etc.
  Verificado: login correcto; la respuesta no se registra.
- "Si el servidor no recibe peticiones durante 5 minutos la sesión se destruye" (`token/login`).
  Estrategia: login perezoso, re-login si llevamos > 4 min sin uso, y ante error `1` (sesión inválida) o `1011`
  (IP cambiada o sesión expirada) un único re-login y un único reintento. Nunca bucles.
- `core/logout` al apagar el proceso (mejor esfuerzo).

## 3. Errores (`errors/errors`) y traducción propia
| Código | Significado | Traducción |
|---|---|---|
| 0 | éxito | — |
| 1, 1011 | sesión inválida / expirada | re-login + 1 reintento; si persiste `UpstreamUnavailableError` |
| 4 | entrada inválida | `InvalidInputError` ("Wialon rechazó los datos enviados") |
| 7 | acceso denegado | `UpstreamForbiddenError` |
| 8, 9 (en login) | credenciales/servidor de autorización | `UpstreamNotConfiguredError` (token inválido o vencido) |
| 10, 1003 | límite de peticiones concurrentes | `UpstreamUnavailableError` (lecturas: reintento con backoff) |
| 1001 | sin mensajes en el intervalo | recorrido vacío (no es error) |
| 1002 | ya existe un elemento con esa propiedad única | `ConflictError` |
| 1004, 1005 | límite de mensajes / tiempo de ejecución | `UpstreamError` con mensaje para acotar el rango |
| 2, 3, 5, 6, otros | error del servicio | `UpstreamError` |
Timeouts y errores de conexión → `UpstreamUnavailableError`. Sin token → `UpstreamNotConfiguredError`.

## 4. Búsqueda (`core/search_items`)
`params={"spec": {"itemsType": "avl_unit"|"avl_resource", "propName": "sys_name", "propValueMask": "*",
"sortType": "sys_name"}, "force": 1, "flags": <dec>, "from": 0, "to": 0}` → `{totalItemsCount, items: [...]}`.
Los flags se envían en decimal.

### Flags de unidad usados (`format/unit`)
| Flag | Claves | Verificado |
|---|---|---|
| `0x1` base | `id`, `nm`, `cls`, `mu`, `uacl` | sí |
| `0x8` campos personalizados | `flds: {"<n>": {id, n, v, ct, mt}}`, `fldsmax` | sí: 41 de 62 unidades con campos |
| `0x400` último mensaje y posición | `pos: {t, x, y, z, s, c, sc, f, lc}`, `lmsg` | sí: 61 de 62 con `pos` |
| `0x200000` estado de conexión | `netconn` | documentado; no usado aún |
`pos`: `t` tiempo UNIX UTC, `y` latitud, `x` longitud, `z` altitud, `s` velocidad (km/h), `c` rumbo (grados),
`sc` satélites.

### Flags de recurso usados (`format/resource`)
| Flag | Claves | Verificado |
|---|---|---|
| `0x1` base | `id`, `nm`, `uacl` | sí: 2 recursos |
| `0x100` conductores | `drvrs: {"<n>": {id, n, c, ds, p, jp, ej, pwd, r, ck, f, bu, pu, bt, pos, ...}}`, `drvrsmax` | sí: 16 conductores (12 con `bu` ≠ 0) |
| `0x200000` pasajeros (tags) | `tags: {"<id>": {id, n, c, p?, jp, r, ck, f, bu, pu, bt, tz, art, pos}}`, `tagsmax` | sí: 101 pasajeros |
Nota: `0x400000` NO son pasajeros sino la "lista de unidades de vinculación automática" (`tagrun`); el sondeo
inicial lo confirmó al recibir `tagrun` en vez de `tags`.

## 5. Permisos efectivos del token (máscaras `uacl`, tabla `core/check_items_billing`)
Recurso 27668776 y 29042796, `uacl=0x301fff30fff7`: ver y crear/editar/borrar conductores (`0x40000000`,
`0x80000000`), ver y crear/editar/borrar pasajeros (`0x800000000`, `0x1000000000`), ver/gestionar campos.
Unidades (4 máscaras distintas): ver, ver/gestionar campos personalizados (`0x20`, `0x40`), consultar mensajes
(`0x200`). Conclusión: todas las operaciones obligatorias están permitidas por la cuenta (verificado solo leyendo).

## 6. Conductores — `resource/update_driver`
`{"itemId": <recurso>, "id": <conductor, 0 al crear>, "callMode": "create"|"update"|"delete",
"ej", "c", "ck", "ds", "n", "p", "r", "f", "pwd", "jp": {<nombre>: <valor>}}` (todos "requeridos para create y update").
Respuesta: `[<id>, {objeto}]`; al borrar `[<id>, null]`.
Regla: en `update` leer el conductor actual y reenviar TODOS los campos editables (`ej`, `c`, `ck`, `ds`, `n`, `p`, `r`,
`f`, `pwd`, `jp`) cambiando solo los editados; omitir uno puede borrarlo.

## 7. Pasajeros — `resource/update_tag`
`{"itemId", "id", "callMode", "c", "ck", "n", "p", "r", "tz", "jp"}`. **No existe descripción (`ds`)** en tags.
Respuesta `[<id>, {objeto}]` / `[<id>, null]`. Regla: misma fusión completa; `jp` se envía completo
(cambiar o borrar una clave = enviar el diccionario entero sin esa clave).

## 8. Vinculaciones
- `resource/bind_unit_driver` `{"resourceId", "unitId", "driverId", "time": 0, "mode": 1|0}` → `{}`.
- `resource/bind_unit_tag` `{"resourceId", "unitId", "tagId", "time": 0, "mode": 1|0}` → `{}`.
- `time: 0` = hora actual; `mode: 0` desvincula (requiere la unidad actualmente vinculada, `bu`).
- La unidad vinculada se lee del propio objeto (`bu`), sin llamadas extra.

## 9. Campos personalizados de unidad — `item/update_custom_field`
`{"itemId": <unidad>, "id": <campo>, "callMode": "create"|"update"|"delete", "n": <nombre>, "v": <valor>}`;
el `id` se ignora al crear. Respuesta `[<id>, {id, n, v}]` / `[<id>, null]`.

## 10. Historial — `messages/load_interval` + `messages/unload`
`{"itemId": <unidad>, "timeFrom": <unix>, "timeTo": <unix>, "flags": 0, "flagsMask": 65280 (0xFF00), "loadCount": N}`
→ `{"count": <total encontrado>, "messages": [{t, f, tp, pos: {y, x, z, s, c, sc}, ...}]}`.
- `flags=0` con máscara `0xFF00` = "todos los mensajes con datos"; se descartan los que no traen `pos`.
- `count > len(messages)` ⇒ `truncated=true`. Después `messages/unload` libera la memoria de la sesión.
- La carga de mensajes vive en la sesión: las peticiones de historial se serializan con un lock.
- Error 1001 = intervalo sin mensajes → recorrido vacío.

## 11. Implicaciones para el gateway
1. Solo POST al host fijo `WIALON_BASE_URL`; token y `sid` nunca en logs, URLs ni respuestas.
2. Lecturas cacheadas (TTL `WIALON_CACHE_TTL_SECONDS`) e invalidadas tras cualquier escritura.
3. Reintentos con backoff solo en lecturas y en errores de conexión antes de enviar; nunca reenviar una
   escritura con resultado desconocido (timeout de lectura tras enviar).
4. Validar cada respuesta antes de mapear (coordenadas en rango, tiempos > 0, tipos); descartar lo inválido.
5. Pendiente de verificar con escrituras reales (solo sobre datos de prueba propios, p. ej. nombre con prefijo
   `ZZ-PRUEBA-GPS-COMERCIAL`): create/update/delete de conductor y pasajero, bind/unbind, campos de unidad.
