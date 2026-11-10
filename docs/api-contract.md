# Contrato de implementación — GPS Comercial

Versión 1 (2026-11-09). Fuente de requisitos: `.local-context/prueba_tecnica.md` (manda sobre este documento).
Este contrato coordina a varios implementadores en paralelo. Un cambio de contrato se anota en la sección
"Registro de cambios" al final y lo decide la sesión principal.

Convenciones globales:
- JSON en `snake_case`, tipos explícitos, `null` para ausentes (nunca cadenas vacías como "sin dato").
- Fechas en la API: ISO-8601 en UTC con sufijo `Z` (ej. `2026-11-09T19:33:11Z`). La UI muestra America/Bogota, es-CO.
- Velocidad en km/h (`speed_kmh`), rumbo en grados 0–359 (`course_deg`); la UI lo traduce a punto cardinal.
- Coordenadas: `latitude` (−90..90) y `longitude` (−180..180); se descartan posiciones inválidas o (0,0).
- Código, identificadores y commits en inglés; textos de UI y mensajes `detail` de error en español (es-CO).
- Ningún endpoint devuelve JSON crudo de Wialon, ni el `sid`, ni el token.

## 1. Arquitectura del backend (FastAPI, Python 3.13, uv)

```
backend/app/
  main.py                 create_app(): middlewares, handlers de error, routers
  cli.py                  python -m app.cli seed-admin   (lee ADMIN_* del entorno)
  core/                   config.py, logging.py, errors.py (Problem Details), security_headers.py,
                          request_context.py (X-Request-ID), rate_limit.py
  domain/                 Núcleo sin dependencias de FastAPI/SQLAlchemy/HTTP
    errors.py             Jerarquía DomainError (ver §6)
    permissions.py        Permission (StrEnum), RoleCode, ROLE_PERMISSIONS (semilla de la matriz)
    fleet.py              Modelos de dominio de flota (dataclasses inmutables)
    ports.py              FleetGateway (Protocol): puerto hacia la plataforma telemática
    vehicle_status.py     Política de estado derivado (Strategy, umbrales configurables)
    track.py              Simplificación de recorridos (Ramer–Douglas–Peucker) y estadísticas
  infrastructure/
    db/                   base.py, session.py, models.py, repositories/*.py (Repository)
    wialon/               client.py, session.py, errors.py, flags.py, schemas.py (validación de
                          respuestas), mappers.py (DTO/Mapper), gateway.py (Adapter: WialonFleetGateway)
    fake_fleet/           gateway.py: FakeFleetGateway en memoria (pruebas y modo demo local)
  services/               Casos de uso: auth, users, audit, vehicles, drivers, passengers,
                          dashboard, history, exports
  api/
    health.py             /health (vida del proceso; no toca DB ni Wialon)
    deps.py               Inyección de dependencias: DB, usuario actual, permisos, gateway, auditoría
    schemas/              Esquemas Pydantic de entrada/salida (contratos HTTP)
    v1/                   Routers /api/v1/* por dominio
backend/migrations/       Alembic (migraciones versionadas)
backend/tests/
```

Reglas HTTP: respuestas de la API con `Cache-Control: no-store`; GZip; `redirect_slashes=False` (una
redirección absoluta sacaría al navegador del dominio del frontend); `Referrer-Policy:
strict-origin-when-cross-origin` (la política de teselas de OpenStreetMap pide no bloquear el Referer).

Reglas: los routers solo validan/serializan y llaman a servicios; los servicios usan puertos y repositorios;
`domain/` no importa FastAPI, SQLAlchemy ni httpx2. Endpoints síncronos (`def`): FastAPI los ejecuta en su
threadpool; el cliente Wialon es síncrono (`httpx2.Client`) con locks para la sesión. Decisión: simplicidad
y depuración más sencilla frente al pequeño volumen de una prueba técnica.

Dependencias permitidas (fijadas en `uv.lock`): fastapi, pydantic-settings, uvicorn, httpx2 (cliente HTTP,
también usado por TestClient), sqlalchemy 2.x, alembic, psycopg[binary] 3.x, argon2-cffi, pyjwt,
email-validator. Pruebas: pytest. No añadir otras sin anotarlo en el registro de cambios.

## 2. Modelos de dominio y puerto (contrato Python)

`app/domain/fleet.py` y `app/domain/ports.py` (escritos en el esqueleto; implementadores no cambian firmas
sin registrar el cambio):

- `Position(latitude, longitude, speed_kmh, course_deg, altitude_m, satellites, recorded_at)`
- `CustomField(id: int, name: str, value: str)`  — campos personalizados de unidad (Wialon `flds`)
- `Unit(id, name, last_message_at, position, custom_fields)`  — sin estado derivado
- `Resource(id, name)`  — contenedor Wialon de conductores y pasajeros
- `Driver(resource_id, id, name, code, phone, description, unit_id)`
- `Passenger(resource_id, id, name, code, phone, unit_id, custom_fields: dict[str, str])` (los tags de Wialon no tienen descripción)
- `DriverInput(name, code, phone, description)`, `PassengerInput(name, code, phone, custom_fields)`
- `TrackPoint(recorded_at, latitude, longitude, speed_kmh, course_deg)`, `Track(unit_id, points, truncated)`

`FleetGateway` (Protocol) — implementado por `WialonFleetGateway` y `FakeFleetGateway`:
`list_units`, `get_unit`, `list_resources`, `list_drivers`, `create_driver`, `update_driver`, `delete_driver`,
`bind_driver`, `unbind_driver`, `list_passengers`, `create_passenger`, `update_passenger`, `delete_passenger`,
`bind_passenger`, `unbind_passenger`, `create_unit_custom_field`, `update_unit_custom_field`,
`delete_unit_custom_field`, `load_track`. Firmas exactas en `ports.py`.

Reglas del adaptador Wialon (detalle en `docs/wialon-api.md`):
- `token/login` perezoso; `sid` en memoria (nunca en logs); error 1 → un único re-login y un único reintento.
- Timeouts explícitos; reintentos con backoff solo en lecturas; caché TTL corto en lecturas, invalidado tras escribir.
- Escrituras: leer el objeto actual y enviar el objeto completo fusionado (no perder campos opcionales ni `jp`).
- Nunca reintentar automáticamente una escritura con resultado desconocido (timeout tras enviar).
- Validar respuestas (esquemas en `schemas.py`) antes de mapear; datos inválidos se descartan o se marcan nulos.
- Traducción de errores Wialon → `DomainError` (§6).

### Estado derivado del vehículo (`vehicle_status.py`)
Umbrales por entorno: `VEHICLE_MOVING_SPEED_KMH=5`, `VEHICLE_NO_SIGNAL_AFTER_MINUTES=60`.
1. Sin posición válida o sin último mensaje → `no_signal`.
2. Último mensaje más antiguo que `VEHICLE_NO_SIGNAL_AFTER_MINUTES` → `no_signal`.
3. Velocidad ≥ `VEHICLE_MOVING_SPEED_KMH` → `moving`.
4. En otro caso → `stopped`.
Etiquetas UI: `moving` "En movimiento", `stopped` "Detenido", `no_signal` "Sin señal".

## 3. Base de datos (PostgreSQL en producción; SQLite solo para pruebas y arranque local rápido)

Tablas (SQLAlchemy 2, tipos portables: `Uuid`, `JSON`, `DateTime(timezone=True)` siempre en UTC):
- `roles(id, code UNIQUE, name)`; `permissions(id, code UNIQUE, description)`;
  `role_permissions(role_id, permission_id)` — la migración inicial siembra la matriz de §5.
- `users(id uuid, email UNIQUE en minúsculas, full_name, password_hash, role_id, is_active,
  must_change_password, failed_login_attempts, locked_until, password_changed_at, last_login_at,
  created_at, updated_at, created_by_id)`
- `auth_sessions(id uuid, user_id, refresh_token_hash UNIQUE, created_at, expires_at, last_used_at,
  revoked_at, ip_address, user_agent)`
- `audit_logs(id, occurred_at, actor_user_id, actor_email, action, entity_type, entity_id, outcome,
  ip_address, details JSON)` — `details` nunca contiene contraseñas, tokens ni cookies.

Los datos de vehículos, conductores y pasajeros viven en Wialon; no se copian en la DB (solo caché en memoria con TTL).

## 4. Autenticación y sesión

- Contraseñas con Argon2id (`argon2-cffi`). Política: 12–128 caracteres, al menos una minúscula, una mayúscula,
  un dígito y un símbolo; no puede contener la parte local del correo.
- Login `POST /api/v1/auth/login` → cookies:
  - `gc_access`: JWT HS256 (`sub`=user id, `sid`=session id, `type`=access), 15 min, `HttpOnly`, `Path=/`.
  - `gc_refresh`: token opaco aleatorio (en DB solo su SHA-256), 7 días, `HttpOnly`, `Path=/api/v1/auth`.
  - `gc_csrf`: aleatorio, legible por JS, `Path=/`.
  - Todas `SameSite=Lax`; `Secure` en producción.
- Cada petición autenticada verifica JWT + sesión no revocada + usuario activo (desactivar o cerrar sesión
  invalida el acceso de inmediato).
- `POST /api/v1/auth/refresh`: rotación del refresh; reutilizar uno ya rotado revoca la sesión.
- CSRF (double submit): métodos no seguros exigen cabecera `X-CSRF-Token` igual a la cookie `gc_csrf`.
  Además, si llega `Origin`, debe estar en `CORS_ORIGINS`. `login` está exento del token pero no del Origin.
- `must_change_password=true` → todo `/api/v1` responde 403 `password_change_required`, salvo
  `auth/me`, `auth/change-password`, `auth/logout` y `auth/refresh`.
- Fuerza bruta: 5 fallos → bloqueo de la cuenta 15 min; límite por IP de 10 intentos/min en login (429 +
  `Retry-After`). Mensaje genérico: "Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente."
- Admin inicial: `uv run python -m app.cli seed-admin` con `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`
  (sin valores por defecto; valida la política; idempotente).
- Usuarios creados o restablecidos por el Admin reciben contraseña temporal generada (se muestra una sola vez)
  y `must_change_password=true`.
- Topología: el navegador habla con un único origen. En local, Vite hace proxy de `/api` y `/health` a
  `http://localhost:8000`; en producción, el host del frontend reescribe `/api/*` al backend. Así las cookies
  son de primera parte. CORS sigue restringido a orígenes explícitos.

## 5. Permisos (RBAC granular, denegar por defecto)

| Permiso | Admin | Operador | Visualizador |
|---|:-:|:-:|:-:|
| `dashboard:read`, `vehicles:read`, `drivers:read`, `passengers:read`, `history:read` | ✔ | ✔ | ✔ |
| `drivers:write`, `passengers:write` (incluye campos personalizados de pasajeros) | ✔ | ✔ | ✗ |
| `assignments:write` (vincular/desvincular conductores y pasajeros) | ✔ | ✔ | ✗ |
| `vehicles:custom_fields:write` | ✔ | ✔ | ✗ |
| `exports:csv` | ✔ | ✔ | ✗ |
| `users:manage`, `audit:read` | ✔ | ✗ | ✗ |

Roles: `admin` "Administrador", `operator` "Operador", `viewer` "Visualizador".
Cada endpoint de `/api/v1` (salvo `auth/*`) declara su permiso con `Depends(require_permission(...))`.
Una prueba recorre todas las rutas y falla si alguna no declara permiso.

## 6. Errores (RFC 7807 Problem Details)

`Content-Type: application/problem+json`:
```json
{"type": "about:blank", "title": "Recurso no encontrado", "status": 404, "detail": "El vehículo no existe.",
 "code": "not_found", "instance": "/api/v1/vehicles/9", "request_id": "…", "errors": null}
```
`errors` (solo 422): `[{"field": "name", "message": "Este campo es obligatorio."}]`.

| `code` | HTTP | Origen |
|---|---|---|
| `validation_error` | 422 | Pydantic o `InvalidInputError` |
| `invalid_credentials` | 401 | login |
| `not_authenticated` | 401 | falta/expira/revocada la sesión (el frontend intenta `refresh` una vez) |
| `password_change_required` | 403 | §4 |
| `forbidden` | 403 | permiso RBAC ausente (se registra como evento de seguridad) |
| `csrf_failed` | 403 | CSRF/Origin |
| `not_found` | 404 | `NotFoundError` |
| `conflict` | 409 | `ConflictError` (duplicados, ya asignado, conflicto de edición) |
| `rate_limited` | 429 | login |
| `upstream_error` | 502 | Wialon devolvió error de negocio no traducible |
| `upstream_forbidden` | 502 | la cuenta Wialon no tiene permiso para la operación |
| `upstream_unavailable` | 503 | timeout/conexión/indisponibilidad Wialon (`Retry-After` cuando aplique) |
| `upstream_not_configured` | 503 | falta `WIALON_TOKEN` |
| `internal_error` | 500 | excepción no controlada (sin stack trace al cliente) |

## 7. Endpoints `/api/v1`

Paginación común: `?page=1&page_size=20` (1–100) → `{"items": [...], "total": 0, "page": 1, "page_size": 20, "pages": 0}`.
Orden: `?sort=name` o `?sort=-name` (campos permitidos por endpoint).

`?sort=-created` (conductores, pasajeros y sus CSV) = «Recién agregados». Wialon no guarda fecha de
creación de conductores ni pasajeros, así que primero van los creados desde la aplicación, por la
fecha de su `driver.created` / `passenger.created` correcto en la auditoría (el más reciente
primero), y después los creados fuera (directamente en Wialon o antes de la auditoría), por id
descendente: Wialon asigna ids crecientes dentro de cada recurso.

### Auth (sin permiso; requieren sesión salvo login/refresh)
| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /auth/login` | `{email, password}` | `200 {user: Me}` + cookies |
| `POST /auth/refresh` | cookie | `200 {user: Me}` + cookies rotadas |
| `POST /auth/logout` | — | `204` y cookies borradas |
| `GET /auth/me` | — | `200 Me` |
| `POST /auth/change-password` | `{current_password, new_password}` | `200 {user: Me}`; revoca otras sesiones |

`Me = {id, email, full_name, role: {code, name}, permissions: [string], must_change_password}`

### Usuarios y roles (`users:manage`)
| Ruta | Detalle |
|---|---|
| `GET /users?search=&role=&is_active=&page=&page_size=&sort=` | `Page<UserOut>` |
| `POST /users` `{email, full_name, role}` | `201 {user: UserOut, temporary_password}` |
| `GET /users/{id}` | `UserOut` |
| `PATCH /users/{id}` `{full_name?, role?, is_active?}` | `UserOut`; el Admin no puede desactivarse ni quitarse el rol a sí mismo (409) |
| `POST /users/{id}/reset-password` | `200 {temporary_password}`; revoca sesiones del usuario |
| `GET /roles` | `[{code, name, permissions: [string]}]` |

`UserOut = {id, email, full_name, role: {code, name}, is_active, must_change_password, last_login_at, created_at}`

### Auditoría (`audit:read`)
`GET /audit-logs?action=&actor=&outcome=&date_from=&date_to=&page=&page_size=` →
`Page<{id, occurred_at, actor_email, action, entity_type, entity_id, outcome, ip_address, details}>`.
Acciones: `auth.login_succeeded`, `auth.login_failed`, `auth.logout`, `auth.password_changed`,
`user.created`, `user.updated`, `user.password_reset`, `driver.created|updated|deleted|assigned|unassigned`,
`passenger.created|updated|deleted|assigned|unassigned`, `passenger.custom_field.created|updated|deleted`,
`vehicle.custom_field.created|updated|deleted`, `export.generated`, `access.denied`.
`outcome`: `success` | `failure`.

### Vehículos
| Ruta | Permiso | Salida |
|---|---|---|
| `GET /vehicles?search=&status=&has_driver=&sort=&page=&page_size=` | `vehicles:read` | `Page<VehicleSummary>`; sort: `name`, `status`, `last_message_at` |
| `GET /vehicles/positions?search=&status=` | `vehicles:read` | `{items: [VehicleMarker], generated_at}` (todas, sin paginar, solo con posición válida) |
| `GET /vehicles/{id}` | `vehicles:read` | `VehicleDetail` |
| `GET /vehicles/{id}/track?from=&to=&max_points=` | `history:read` | `Track` (rango ≤ 7 días, `max_points` 100–5000, defecto 2000) |
| `GET /vehicles/{id}/custom-fields` | `vehicles:read` | `[CustomField]` |
| `POST /vehicles/{id}/custom-fields` `{name, value}` | `vehicles:custom_fields:write` | `201 CustomField` |
| `PUT /vehicles/{id}/custom-fields/{field_id}` `{name, value, expected_value?}` | `vehicles:custom_fields:write` | `CustomField`; `409` si `expected_value` ya no coincide |
| `DELETE /vehicles/{id}/custom-fields/{field_id}` | `vehicles:custom_fields:write` | `204` |

- `VehicleSummary = {id, name, status, last_message_at, position: Position|null, driver: DriverRef|null, passenger_count}`
- `Position = {latitude, longitude, speed_kmh, course_deg, altitude_m, satellites, recorded_at}`
- `DriverRef = {resource_id, id, name, phone}`
- `VehicleMarker = {id, name, status, latitude, longitude, speed_kmh, course_deg, last_message_at, driver_name}`
- `VehicleDetail = VehicleSummary + {custom_fields: [CustomField], passengers: [PassengerRef]}`
- `CustomField = {id, name, value}`; `PassengerRef = {resource_id, id, name, phone}`
- `Track = {vehicle_id, from, to, points: [{recorded_at, latitude, longitude, speed_kmh, course_deg}],
  stats: {total_points, returned_points, simplified, truncated, distance_km, max_speed_kmh, avg_speed_kmh, duration_s}}`

### Recursos
`GET /resources` (`drivers:read`) → `[{id, name}]` (para elegir dónde crear conductores/pasajeros).
`WIALON_DEFAULT_RESOURCE_ID` opcional; si falta, se usa el primer recurso disponible.

### Conductores
| Ruta | Permiso |
|---|---|
| `GET /drivers?search=&assigned=&sort=&page=&page_size=` → `Page<DriverOut>`; sort: `name`, `-name`, `-created` | `drivers:read` |
| `POST /drivers` `{resource_id?, name, code?, phone?, description?}` → `201 DriverOut` | `drivers:write` |
| `GET /drivers/{resource_id}/{driver_id}` → `DriverOut` | `drivers:read` |
| `PUT /drivers/{resource_id}/{driver_id}` `{name, code?, phone?, description?}` → `DriverOut` | `drivers:write` |
| `DELETE /drivers/{resource_id}/{driver_id}` → `204` | `drivers:write` |
| `PUT /drivers/{resource_id}/{driver_id}/assignment` `{unit_id}` → `DriverOut` | `assignments:write` |
| `DELETE /drivers/{resource_id}/{driver_id}/assignment` → `DriverOut` | `assignments:write` |

`DriverOut = {resource_id, id, name, code, phone, description, vehicle: {id, name}|null}`
Validación: `name` 1–50 obligatorio; `phone` opcional `^\+?[0-9 ()-]{7,20}$`; `code` opcional ≤ 30 y único en el recurso (409).

### Pasajeros (tags de Wialon)
| Ruta | Permiso |
|---|---|
| `GET /passengers?search=&assigned=&vehicle_id=&sort=&page=&page_size=` → `Page<PassengerOut>`; sort: `name`, `-name`, `-created` | `passengers:read` |
| `POST /passengers` `{resource_id?, name, code?, phone?, custom_fields?}` → `201` | `passengers:write` |
| `GET /passengers/{resource_id}/{passenger_id}` → `PassengerOut` | `passengers:read` |
| `PUT /passengers/{resource_id}/{passenger_id}` `{name, code?, phone?}` (conserva campos personalizados) | `passengers:write` |
| `DELETE /passengers/{resource_id}/{passenger_id}` → `204` | `passengers:write` |
| `GET /passengers/{rid}/{pid}/custom-fields` → `[{key, value}]` | `passengers:read` |
| `POST /passengers/{rid}/{pid}/custom-fields` `{key, value}` → `201` (409 si existe) | `passengers:write` |
| `PUT /passengers/{rid}/{pid}/custom-fields/{key}` `{value, new_key?}` | `passengers:write` |
| `DELETE /passengers/{rid}/{pid}/custom-fields/{key}` → `204` | `passengers:write` |
| `PUT /passengers/{rid}/{pid}/assignment` `{unit_id}` / `DELETE …/assignment` | `assignments:write` |

`PassengerOut = {resource_id, id, name, code, phone, vehicle: {id, name}|null, custom_fields: [{key, value}]}`
Claves de campo personalizado: 1–50 caracteres; valores ≤ 255.

### Dashboard, exportación
- `GET /dashboard/summary` (`dashboard:read`) → `{vehicles_total, vehicles_by_status: {moving, stopped, no_signal},
  vehicles_with_driver, vehicles_without_driver, drivers_total, passengers_total, generated_at}`
- `GET /exports/vehicles.csv`, `/exports/drivers.csv`, `/exports/passengers.csv` (`exports:csv`; aceptan los
  mismos filtros que el listado) → `text/csv; charset=utf-8` con BOM, `Content-Disposition: attachment`.
  Celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno se prefijan con `'` (CSV injection).

## 8. Configuración (variables de entorno, backend)

`APP_ENV` (development|test|production), `CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres, obligatorio,
sin defecto), `ACCESS_TOKEN_TTL_MINUTES=15`, `REFRESH_TOKEN_TTL_DAYS=7`, `COOKIE_SECURE` (true en producción),
`API_DOCS_ENABLED` (defecto: true salvo en producción), `LOG_LEVEL=INFO`,
`LOGIN_MAX_ATTEMPTS=5`, `LOGIN_LOCKOUT_MINUTES=15`, `LOGIN_RATE_LIMIT_PER_MINUTE=10`,
`WIALON_BASE_URL`, `WIALON_TOKEN`, `WIALON_TIMEOUT_SECONDS=15`, `WIALON_CACHE_TTL_SECONDS=15`,
`WIALON_DEFAULT_RESOURCE_ID` (opcional), `FLEET_GATEWAY=wialon|fake` (`fake` prohibido en producción),
`VEHICLE_MOVING_SPEED_KMH=5`, `VEHICLE_NO_SIGNAL_AFTER_MINUTES=60`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME` (solo para `seed-admin`).
Frontend: `VITE_API_BASE_URL` (vacío = mismo origen, recomendado), `VITE_DEV_PROXY_TARGET=http://localhost:8000`.

`FLEET_GATEWAY=fake` existe para desarrollar la UI y probar sin token: datos simulados en Bogotá, con aviso
visible "Datos simulados" en la UI (`GET /api/v1/system/info` → `{fleet_source: "wialon"|"fake", environment}`,
permiso `dashboard:read`). Nunca se presenta como integración real.

## 9. Frontend (React 19 + TypeScript + Vite)

```
frontend/src/
  main.tsx                 Monta <App/>
  app/                     App.tsx, providers.tsx, router.tsx, guards.tsx, ServerStatusBanner.tsx
  api/                     client.ts (fetch centralizado), errors.ts (ApiError), types.ts (contrato TS),
                           un módulo por dominio con funciones + hooks TanStack Query (auth, users, vehicles,
                           drivers, passengers, resources, dashboard, history, audit, exports, system)
  auth/                    AuthProvider.tsx, useAuth.ts
  lib/                     format.ts (fechas Bogotá, km/h, cardinal), download.ts
  ui/                      Sistema de componentes reutilizables (ver ownership)
  styles/                  tokens.css (paleta y escala), global.css
  layouts/                 PublicLayout.tsx, AppShell.tsx (navegación según permisos)
  features/<dominio>/      Páginas y componentes de cada vista
  test/setup.ts            Vitest + Testing Library
```

Contratos frontend:
- `apiFetch` envía `credentials: 'include'`, `X-CSRF-Token` en métodos no seguros, parsea Problem Details a
  `ApiError {status, code, detail, fieldErrors}`; ante 401 `not_authenticated` hace un único `refresh`
  compartido y repite; ante 403 `password_change_required` navega a `/change-password`.
- Arranque en frío: solo GET/HEAD (y `/health`) se reintentan ante error de red, 502/503/504 o respuesta no JSON,
  con backoff (1 s, 2 s, 4 s… hasta ~150 s) y aviso global "Iniciando el servidor, esto puede tardar hasta un
  minuto…". POST/PUT/PATCH/DELETE nunca se reintentan: si el resultado es incierto se avisa y se vuelve a leer.
  La landing hace `GET /health` al cargar para despertar el backend. Nunca pantalla en blanco.
- `useAuth()` → `{status: 'loading'|'authenticated'|'anonymous', user: Me|null, login, logout,
  changePassword, hasPermission(p), refreshUser}`. Ningún token en `localStorage`/`sessionStorage`.
- Polling de posiciones con TanStack Query `refetchInterval` (15 s), pausado con la pestaña oculta.
- Rutas: `/`, `/login`, `/change-password`, `/app/dashboard`, `/app/vehicles`, `/app/vehicles/:id`,
  `/app/drivers`, `/app/passengers`, `/app/history`, `/app/users`, `/app/audit`.
- Mapa: Leaflet + leaflet.markercluster + teselas OpenStreetMap con atribución. Sin Google Maps.
- Gráficas: SVG propio accesible (tabla alternativa), sin librería pesada.
- Formularios: react-hook-form + zod, mensajes accesibles (`aria-invalid`, `aria-describedby`).

### Roles de color (decisión inicial; ux-ui la documenta y puede ajustarla registrándolo)
| Rol | Color | Uso y contraste medido |
|---|---|---|
| Fondo de aplicación | `#EEE8F2` | Solo con texto oscuro (`#1F1A24`, 14.18:1) |
| Marca / acento | `#EB162C` | Logo, indicadores activos, anillo de foco (4.48:1 sobre blanco, 3.73:1 sobre `#EEE8F2`, ≥ 3:1 exigido a no-texto); no texto normal |
| Peligro / error / sin señal | `#A81A2B` | Botones destructivos y errores (blanco sobre él 7.37:1; sobre `#EEE8F2` 6.13:1) |
| Acción principal / éxito / en movimiento | `#1E8C93` y su derivado oscuro `#176F75` | Botones primarios usan `#176F75` (blanco 5.89:1; sobre `#EEE8F2` 4.89:1); `#1E8C93` (4.02:1 sobre blanco) en iconos, marcadores, bordes y texto grande |
| Texto secundario / detenido | `#6B6B6B` | Texto secundario solo sobre blanco (5.33:1; sobre `#EEE8F2` 4.43:1 no apto) |
Estados siempre con icono + texto + color.

## 10. Propiedad de archivos durante el trabajo en paralelo

Cada tarea trabaja en su propia rama/worktree y solo modifica los archivos que se le asignan. Archivos
compartidos (`pyproject.toml`, `uv.lock`, `package.json`, `package-lock.json`, `api/v1/__init__.py`,
`app/router.tsx`) los cambia únicamente la sesión principal o la tarea que figure como dueña.

## Registro de cambios
- v1 (2026-11-09): versión inicial.
- v1.1 (2026-11-09): pasajeros sin `description` (`resource/update_tag` no tiene `ds`, ver docs/wialon-api.md §7).
  Flags y semántica de Wialon verificados con la documentación oficial y un sondeo real de solo lectura.
  Reintentos de arranque en frío solo en lecturas; reglas HTTP de caché/redirecciones (docs/deployment.md §4).
