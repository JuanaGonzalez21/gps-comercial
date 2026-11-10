# Estado actual y relevo
Snapshot: 2026-11-09 18:40 America/Bogota. Verificar siempre Git, archivos y procesos antes de continuar.

## Alcance vigente
Desarrollo local autónomo autorizado (ver CLAUDE.md). Commits locales en `chore/bootstrap-base`, sin push ni despliegue.

## Qué usa Wialon real, qué está simulado (actualizado 2026-11-09 19:40 Bogotá)
| Pieza | Estado |
|---|---|
| Login, refresh, logout, cambio obligatorio, roles | Implementado; pytest; navegador (Playwright + Chrome) para login/logout; PostgreSQL 17 verificado |
| Usuarios (crear, rol, activar/desactivar, restablecer) y auditoría (API) | Implementado; pytest; ciclo completo verificado en PostgreSQL 17. UI en construcción |
| Vehículos: lista, filtros, paginación servidor, mapa con clusters, selección sincronizada | **Wialon real en navegador** (62 vehículos, 61 marcadores; e2e Playwright OK) |
| Conductores, pasajeros, asignaciones, campos de vehículos y pasajeros | API implementada y probada (pytest); **escrituras verificadas en Wialon real** con datos propios (15/15); UI en construcción |
| Dashboard, historial (RDP), CSV (anti-inyección) | API implementada y probada (pytest con Wialon simulado); UI en construcción |
| Pruebas automáticas | 246 backend (Wialon **simulado**), 65 frontend, 1 e2e real |
| Despliegue | Configuración y guía (`docs/deploy-guide.md`); nada publicado |

## En ejecución ahora (si se cierra el panel)
- Backend local en `http://localhost:8000` contra Wialon real (proceso en segundo plano de Claude; reiniciar con
  `cd backend; uv run uvicorn app.main:app --port 8000`).
- PostgreSQL temporal aislado en el puerto 55432 (scratchpad de la sesión; no es el servicio de Juana).
- Vite de Juana en `http://localhost:5173`.
- 4 agentes de frontend: detalle de vehículo + corrección de tabla; conductores y pasajeros; dashboard + historial;
  usuarios + auditoría + landing + docs/design-system.md. Al terminar: verificar build/lint/test y commitear.
- Siguiente: e2e ampliado por rol, Lighthouse de la landing, README final y checklist.

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
