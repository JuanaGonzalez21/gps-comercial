# Estado actual y relevo
Snapshot: 2026-11-09 (noche). Verificar siempre Git y archivos antes de continuar.

## Confirmado
- [x] Proyecto Work creado por Juana.
- [x] Repositorio público con main y README verificado (clon anónimo 2026-11-09: solo `7f80496 Initial commit`).
- [x] Primera solicitud enviada por Juana a Claude Design.
- [x] Paquete de contexto y tres definiciones de agentes preparado.
- [x] Paquete copiado dentro del clon real (`CLAUDE.md`, `AGENTS.md`, `docs/`, `.claude/agents/`, `.local-context/prueba_tecnica.md`).
- [x] Agentes `ux-ui`, `code-orchestrator` y `architecture-quality` disponibles en Claude Code (VS Code).
      En la tarea de integración del 2026-11-09 no se invocó ninguno; la hizo la sesión principal.
- [x] Base ejecutable (backend + frontend + README) copiada al clon real, rama `chore/bootstrap-base`.
      Comparada con `~/Downloads/gps-comercial-base` con `cmp`: todos los archivos de código idénticos.
- [x] `.gitignore` combinado (reglas del repo + `dist-ssr/`, `*.local`, `npm-debug.log*` y editores de la base).
- [x] Frontend instala, compila y pasa lint/audit en Windows.
- [x] Backend en Windows: `uv sync --locked`, pytest (7 passed), ruff y pip-audit OK.
- [x] `/health` mediante petición real en Windows → `200 {"status":"ok"}`.
- [x] `backend/.env` local creado desde `.env.example` (sin token) e ignorado por Git.

## No confirmado / pendiente
- [ ] Commit de la base (propuesta abajo). Sin push.
- [ ] Prueba visual en navegador (`npm run dev` + backend → "Servidor disponible") en Windows; en Linux sí se hizo.
- [ ] Token configurado localmente y permisos Wialon verificados.
- [ ] Base de datos, autenticación, funciones y pruebas de negocio.
- [ ] Hosting, DNS y despliegue.
- [ ] Diseño recibido, revisado e implementado.

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
