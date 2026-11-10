# Estado actual y relevo
Snapshot: 2026-11-09 21:15 America/Bogota. Verificar siempre Git, archivos y procesos antes de continuar.

## Alcance vigente
Desarrollo local autónomo autorizado (ver CLAUDE.md). Commits locales en `chore/bootstrap-base`, sin push ni despliegue.

## Relevo final del desarrollo local — 2026-11-09 21:15 America/Bogota
Rama `chore/bootstrap-base`, 61 commits locales sobre `origin/main`, árbol limpio, **sin push ni despliegue**.

### 1. Qué se puede abrir y probar ahora
- Backend: `http://localhost:8000/health`, `/docs`. Lo dejó corriendo Claude en segundo plano; si no responde:
  `cd backend; uv run uvicorn app.main:app --port 8000`.
- Frontend: `http://localhost:5173` (Vite de Juana): `/`, `/login` y luego `/app/*`.
- Login local: `ADMIN_EMAIL` y `ADMIN_PASSWORD` de `backend/.env`, que solo están en ese archivo.
- Pruebas reales en navegador: en `frontend`, `npx playwright test` con `E2E_EMAIL`/`E2E_PASSWORD` en el entorno.

### 2. Estado por módulo
| Módulo | Implementado | Probado en navegador | Verificado con Wialon real | Pendiente |
|---|---|---|---|---|
| Landing | Sí | Sí (e2e, Lighthouse 98/100/100) | No aplica | Lighthouse sobre URL desplegada |
| Login, refresh, logout, cambio obligatorio | Sí | Sí (e2e, también visualizador) | No aplica | — |
| Roles y permisos (UI + API) | Sí | Sí (visualizador sin acciones; API 403) | No aplica | — |
| Usuarios (Admin) | Sí | Pruebas de UI con API simulada; API con PostgreSQL real | No aplica | e2e de la pantalla de usuarios |
| Vehículos: lista, filtros, paginación, mapa, clusters, selección | Sí | Sí (e2e) | **Sí** (62 vehículos, 61 marcadores) | — |
| Detalle de vehículo y campos personalizados | Sí | Sí (e2e crea/edita/borra campo) | **Sí** (campos originales intactos) | — |
| Conductores: CRUD | Sí | Sí (e2e crea/edita/borra) | **Sí** | — |
| Asignación conductor/pasajero ↔ vehículo | Sí | Pruebas de UI con API simulada | **Sí** (`wialon_write_check.py` 15/15) | e2e de UI de asignación |
| Pasajeros: CRUD y campos personalizados | Sí | Pruebas de UI con API simulada | **Sí** (sin perder campos) | e2e de UI de pasajeros |
| Dashboard | Sí | Sí (e2e) | **Sí** | — |
| Historial con reproducción | Sí | Sí (e2e) | **Sí** (3.502 puntos → 2.000) | — |
| Exportación CSV | Sí | Sí (descarga e2e; visualizador 403) | **Sí** | — |
| Auditoría | Sí | Visualizador → acceso denegado (e2e); UI con API simulada | Eventos reales persistidos | — |
| Despliegue | Configuración y guía | — | — | Todo (cuentas de Juana) |

### 3. Pruebas y problemas encontrados
- Resultados:
  - backend `uv run pytest` → 247 passed, cobertura 94 %;
  - `ruff` OK;
  - `pip-audit` sin vulnerabilidades;
  - frontend: build OK, lint OK, `npm test` 161 passed (20 archivos), `npm audit` 0 vulnerabilidades;
  - Playwright 5/5 con Wialon real;
  - Lighthouse móvil local: 98/100/100 (SEO 91).
- PostgreSQL 17 temporal y aislado (ya detenido):
  - migraciones con upgrade, downgrade y `alembic check`;
  - seed, usuarios, cambio obligatorio, desactivación 401 inmediata, reset que revoca sesiones y auditoría.
- Hallazgos reales resueltos:
  - los vínculos de Wialon son asíncronos (~2 s): ahora hay confirmación acotada a 8 s y error claro;
  - un desvínculo en el mismo segundo no se aplica: se espera 2 s;
  - el flag de pasajeros es `0x200000`;
  - la revisión independiente encontró 1 bloqueante y 4 mayores, todos corregidos con pruebas:
    - el arranque en Render se caía sin `ADMIN_PASSWORD`;
    - el logout no revocaba si el access había caducado;
    - Argon2 podía agotar la memoria;
    - las fusiones se hacían sobre caché;
    - un vínculo se daba por bueno sin confirmar;
  - claves de campo `.`/`..` en la URL.
- Limitaciones:
  - Docker no se ejecutó porque Docker Desktop está apagado;
  - no hay prueba con lector de pantalla real;
  - las pantallas de pasajeros, asignación y usuarios se validaron con API simulada y con escrituras reales vía script, sin e2e de UI.

### 4. Git
61 commits locales Conventional Commits con `Co-Authored-By: Claude`, árbol limpio. No se hizo push.

### 5. Requisitos que aún no se cumplen
- **Despliegue público HTTPS y disponibilidad de 15 días** (DEP-01..04). Es criterio de descalificación: lo más urgente.
- **Historial público en GitHub y PR hacia `main`** (GIT-01..03): requiere push.
- **Comprobaciones que solo existen en producción:** Lighthouse sobre la URL desplegada (UX-07), HTTPS y cabeceras en producción (SEG-02, SEG-05).
- **Opcionales no hechos:** CI (DEP-06), circuit breaker (INT-07), modo oscuro (UX-08).

### 6. Despliegue
- Elegido y verificado el 2026-11-09:
  - frontend en Vercel Hobby;
  - API en Render Free con Docker;
  - base en Neon Free;
  - ninguno requiere tarjeta.
- Preparado: `render.yaml`, `backend/Dockerfile` + `scripts/start.sh` (migra, seed opcional, uvicorn), `frontend/vercel.json` (rewrite `/api` y `/health`, sin caché, CSP) y `docker-compose.yml`.
- Guía paso a paso, incluido el subdominio sin tocar el portafolio: `docs/deploy-guide.md`.
- Falta crear los servicios, cargar las variables, ajustar en `vercel.json` la URL real de Render si cambia, y añadir el registro `CNAME gpscomercial → cname.vercel-dns.com`.

### 7. Acciones que necesita Juana (en orden)
1. Autorizar el push de `chore/bootstrap-base` y abrir un PR hacia `main` (o pedir a Claude que lo haga).
2. Crear o acceder a las cuentas: Neon, Render y Vercel (con GitHub). Ninguno pide tarjeta.
3. Elegir el correo y la contraseña robusta del Admin de evaluación y escribirlos solo en el panel de Render.
4. Seguir `docs/deploy-guide.md`: Neon → Render (variables) → Vercel → DNS del subdominio en Squarespace/Google Domains.
5. Tras publicar: Claude puede verificar las URLs, el arranque en frío, las cookies y Lighthouse, y completar el README y el checklist.
6. Preparar el correo de entrega con repositorio, URLs, Admin (por canal privado) y confirmación de 15 días; Claude no lo envía.

## Relevo 2026-11-09 tarde — desarrollo autónomo
Comandos y resultados reales:
- `scripts/wialon_probe.py` (solo lectura): login OK; 62 unidades (61 con `pos`, 41 con `flds`); 2 recursos;
  16 conductores (12 vinculados); 101 pasajeros. Permisos del token decodificados de `uacl`: ver/crear/editar/borrar
  conductores y pasajeros, gestionar campos personalizados, consultar mensajes.
- `scripts/wialon_write_check.py` (datos propios `ZZ-PRUEBA-GPS-COMERCIAL`): 15/15 OK. Hallazgos reales: los vínculos
  se aplican de forma asíncrona (~2 s) y un desvínculo en el mismo segundo que el vínculo no se aplica; el gateway lo
  confirma releyendo y respeta 2 s desde el último cambio.
- Servidor local contra Wialon real: sin sesión 401; login 200 (3 cookies); `/vehicles` total 62; `/vehicles/positions` 61
  marcadores; filtro por estado; CSRF falso 403; logout 204 y sesión revocada.
- `uv run pytest` → 72 passed; ruff check/format OK.
- Alembic en PostgreSQL 17.11 temporal (initdb aislado en el scratchpad, puerto 55432, sin tocar el servicio de Juana):
  upgrade/downgrade/upgrade, `alembic check` sin diferencias, seed-admin idempotente, login/refresh/logout y auditoría
  persistidos.
- Docker: archivos creados, no ejecutados (Docker Desktop apagado).

Local (no versionado): `backend/.env` contiene el token de Juana y valores locales generados (`JWT_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, `DATABASE_URL` SQLite). La contraseña del Admin local solo está en ese archivo.

Pendiente inmediato: integrar frontend (login, lista, mapa) y comprobar en navegador con Wialon real; endpoints restantes;
landing completa; README y documentación de entrega; despliegue (requiere cuentas de Juana).

## Relevo 2026-11-09 — equipo de Juana (Windows)
Fecha / rama / commit: 2026-11-09 / `chore/bootstrap-base` / sin commit (base `7f80496`).

Hecho:
- Localizada la base en `~/Downloads/gps-comercial-base`; código ya copiado e idéntico al del repo.
- `.gitignore` combinado conservando secretos, `.local-context/` y `.claude/settings.local.json`.
- `docs/checklist.md` sustituido por la versión de la base (misma estructura, 82 requisitos con ID, solo añade evidencia).
  La evidencia anterior queda marcada como "(Linux)" y se añadió la de Windows.
- Evidencia completa de Linux conservada en `docs/evidencia-primer-encargo-linux.md`.

Entorno (Windows 11, Git Bash en VS Code):
Git 2.53.0.windows.2; Node v24.16.0; npm 11.13.0; Python 3.13.14 (`python` y `py` ejecutan);
uv 0.13.7 (instalado por Juana el 2026-11-09). uv usó el CPython 3.13.14 de Microsoft Store ya instalado.

Comandos y resultados reales en Windows — backend (tras instalar uv):
- `cp .env.example .env` (README) → `backend/.env` con `WIALON_TOKEN` vacío; `git check-ignore -v` → regla `**/.env`.
- `uv sync --locked` → "Resolved 58 packages", "Installed 55 packages", exit 0. Mismas versiones que Linux
  (en Windows entra `colorama` y no `uvloop`, por plataforma).
- `uv run pytest -v` → `platform win32 -- Python 3.13.14, pytest-9.2.0`, "7 passed in 6.33s", exit 0.
- `uv run ruff check .` → "All checks passed!"; `uv run ruff format --check .` → "9 files already formatted".
- `uv run pip-audit` → "No known vulnerabilities found", exit 0.
- `uv run uvicorn app.main:app --port 8000` y peticiones reales con curl:
  - `GET /health` → `HTTP/1.1 200 OK`, `content-type: application/json`, `{"status":"ok"}`.
  - `Origin: http://localhost:5173` → `access-control-allow-origin: http://localhost:5173`.
  - `Origin: https://evil.example` → 0 cabeceras `access-control-allow-origin`.
  - Log de uvicorn: `GET /docs` → 200; `GET /api/v1/anything` → 404 Not Found. El log no muestra configuración ni token.
  - Servidor detenido después; puerto 8000 libre.
- `git check-ignore -v backend/.env backend/.venv` → ambos ignorados; `git status -uall` sin `.env`, `.venv`,
  `node_modules`, `dist` ni `__pycache__`.

Comandos y resultados reales en Windows — frontend:
- `npm run lint` (oxlint) → exit 0; `npm audit` → "found 0 vulnerabilities".
- `frontend: npm ci` → 28 paquetes, "found 0 vulnerabilities", exit 0.
  (Linux instaló 31; la diferencia corresponde a dependencias opcionales por plataforma.)
- `frontend: npm run build` → `tsc -b && vite build`, 17 módulos, "built in 233ms", exit 0.
- `git check-ignore -v --no-index` → ignorados: `backend/.env`, `frontend/.env`, `frontend/.env.local`,
  `backend/.env.production`, `.local-context/prueba_tecnica.md`, `.claude/settings.local.json`, `node_modules`, `dist`.
  No ignorados (versionables): `backend/.env.example`, `frontend/.env.example`.
- `git status -uall` → candidatos sin `node_modules`, `.venv`, `dist` ni `.env`.

Bloqueos: ninguno. Nota menor: Git avisa "LF will be replaced by CRLF" en `README.md` (autocrlf de Windows).
No afecta a la ejecución; valorar un `.gitattributes` con `* text=auto eol=lf` antes de más commits.

Criterio de cierre de F0 (build y /health reales) cumplido en Windows y Linux. F0 queda EN CURSO solo hasta el commit.

## Relevo anterior 2026-11-09 — pruebas realizadas en Linux (entorno de Claude, no el equipo de Juana)
Salida completa: `docs/evidencia-primer-encargo-linux.md`.
- backend/: FastAPI con `/health`, router `/api/v1` vacío, settings por entorno (pydantic-settings), CORS con orígenes explícitos,
  docs deshabilitados en producción, 7 pruebas pytest, ruff.
- frontend/: React + TypeScript + Vite, pantalla temporal es-CO que consulta `/health`, sin assets de demo.
- Versiones fijadas (lockfiles): Python 3.13 (`backend/.python-version`), FastAPI 0.162.2, Pydantic 2.14.3,
  pydantic-settings 2.16.2, Uvicorn 0.54.0, pytest 9.2.0, ruff 0.17.4, httpx2 2.16.0;
  React 19.3.1, Vite 8.3.7, TypeScript 7.0.2, @vitejs/plugin-react 6.3.0, oxlint 1.93.0. Herramienta Python: uv 0.11.
- Linux (Node 22.23, uv 0.11.32): `uv run pytest` → 7 passed; `ruff check` OK; `pip-audit` sin vulnerabilidades;
  `npm run build` OK; `oxlint` exit 0; `npm audit` 0 vulnerabilidades; `curl /health` → `200 {"status":"ok"}`;
  CORS solo para `http://localhost:5173`; Chrome headless mostró "Servidor disponible".

Archivos principales: `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/api/health.py`,
`backend/app/api/v1/__init__.py`, `backend/tests/test_health.py`, `frontend/src/App.tsx`, `frontend/src/config.ts`.

Requisitos verificados: ninguno cerrado como VERIFICADO; EN CURSO: ARQ-04, ARQ-05, ARQ-07, SEG-01 (CORS),
SEG-05, SEG-06, GIT-05. Ver checklist.

Hallazgo para diseño (Linux, fórmula WCAG sobre `#EEE8F2`): `#1E8C93` 3.34:1, `#EB162C` 3.73:1 y `#6B6B6B` 4.43:1
no alcanzan AA para texto normal; `#A81A2B` 6.13:1 sí.

Propuesta de commits (no ejecutados):
1. `chore: add root gitignore for secrets and build artifacts`
2. `feat(backend): bootstrap FastAPI app with health endpoint and env settings`
3. `feat(frontend): bootstrap React TypeScript Vite app`
4. `docs: add project context, checklist and local setup instructions`

## Siguiente tarea para Juana
Revisar la lista de archivos candidatos y autorizar los 4 commits propuestos (sin push) en `chore/bootstrap-base`.
Después: fase F1 (lectura Wialon de solo lectura y validación de hosting gratuito).

## Formato del siguiente relevo
Fecha / rama / commit si existe:
Hecho:
Comandos y resultados reales:
Archivos principales:
Requisitos verificados:
Pendientes y bloqueos:
Siguiente tarea para Juana:
