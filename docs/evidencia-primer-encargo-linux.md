# Evidencia — primer encargo (base ejecutable) — pruebas realizadas en Linux

Fecha: 2026-11-09, 14:03 America/Bogota. Rama: `chore/bootstrap-base` (sin commit). Base: `7f80496 Initial commit`.
Entorno: copia de trabajo de Claude en Linux (no es el equipo de Juana). Hay que repetir estas comprobaciones en el clon real.
Método: se extrajo `gps-comercial-base.zip` en una carpeta vacía y se ejecutó cada comando sobre esa copia limpia.
Los archivos `.env` y `.env.local` de la prueba se crearon desde `.env.example` (sin token) y no forman parte del ZIP.

## Resumen
| Comprobación | Resultado |
|---|---|
| `uv sync --locked` | 55 paquetes instalados desde `uv.lock` |
| `uv run pytest` | 7 passed |
| `uv run ruff check .` / `ruff format --check .` | All checks passed / 9 files already formatted |
| `uv run pip-audit` | No known vulnerabilities found |
| `npm ci` | 31 paquetes desde `package-lock.json` |
| `npm run build` | OK |
| `npx oxlint` | exit 0 |
| `npm audit` | found 0 vulnerabilities |
| `GET /health` | `200 {"status":"ok"}` |
| CORS origen `http://localhost:5173` | `access-control-allow-origin: http://localhost:5173` |
| CORS origen ajeno | sin cabecera (0 coincidencias) |
| `GET /docs` (APP_ENV=development) | 200 |
| `GET /api/v1/anything` | 404 (prefijo reservado, sin rutas de negocio aún) |
| `git check-ignore` | `backend/.env` y `frontend/.env.local` ignorados; `.env.example` versionables |
| ZIP | sin `.env`, `.env.local`, `node_modules`, `.venv` ni `dist/` |

Comprobación adicional de la sesión (no repetida en este registro): Chrome headless sobre `vite preview` + API
mostró `lang="es-CO"` y el texto "Servidor disponible", es decir, el navegador llegó a `/health` a través de CORS.

## Salida completa
```text
## Entorno

$ git --version
git version 2.43.0
[exit 0]

$ node --version
v22.23.4
[exit 0]

$ npm --version
10.9.9
[exit 0]

$ uv --version
uv 0.11.32 (x86_64-unknown-linux-gnu)
[exit 0]

$ python3 --version
Python 3.13.18
[exit 0]

## Backend (copia limpia extraída del ZIP)

$ cp .env.example .env
[exit 0]

$ uv sync --locked
Using CPython 3.13.18 interpreter at: /usr/local/bin/python3.13
Creating virtual environment at: .venv
Resolved 58 packages in 2ms
Installed 55 packages in 23ms
 + annotated-doc==0.0.5
 + annotated-types==0.8.0
 + anyio==4.16.0
 + boolean-py==5.0
 + cachecontrol==0.14.4
 + certifi==2026.10.23
 + charset-normalizer==3.5.2
 + click==8.5.1
 + cyclonedx-python-lib==11.12.0
 + defusedxml==0.7.1
 + fastapi==0.162.2
 + filelock==4.2.9
 + h11==0.16.0
 + httpcore2==2.16.0
 + httptools==0.9.0
 + httpx2==2.16.0
 + idna==3.20
 + iniconfig==2.3.1
 + license-expression==30.4.4
 + markdown-it-py==4.2.0
 + mdurl==0.1.2
 + msgpack==1.2.4
 + opentelemetry-api==1.45.2
 + packageurl-python==0.17.6
 + packaging==26.3
 + pip==26.3
 + pip-api==0.0.35
 + pip-audit==2.10.1
 + pip-requirements-parser==32.0.1
 + platformdirs==4.14.5
 + pluggy==1.7.0
 + py-serializable==2.2.0
 + pydantic==2.14.3
 + pydantic-core==2.50.4
 + pydantic-settings==2.16.2
 + pygments==2.21.0
 + pyparsing==3.3.3
 + pytest==9.2.0
 + python-dotenv==1.2.4
 + pyyaml==6.0.3
 + requests==2.34.2
 + rich==15.0.0
 + ruff==0.17.4
 + sortedcontainers==2.4.0
 + starlette==1.10.0
 + tomli==2.5.0
 + tomli-w==1.2.0
 + truststore==0.10.5
 + typing-extensions==4.16.0
 + typing-inspection==0.4.5
 + urllib3==2.8.0
 + uvicorn==0.54.0
 + uvloop==0.23.0
 + watchfiles==1.3.0
 + websockets==17.4
[exit 0]

$ uv run pytest -v
============================= test session starts ==============================
platform linux -- Python 3.13.18, pytest-9.2.0, pluggy-1.7.0
rootdir: /tmp/claude-0/-home-claude/1cbec5d0-71c9-5166-b5f9-18b602ee504b/scratchpad/verify-fresh/backend
configfile: pyproject.toml
testpaths: tests
plugins: anyio-4.16.0, platformdirs-4.14.5
collected 7 items

tests/test_health.py .......                                             [100%]

============================== 7 passed in 0.85s ===============================
[exit 0]

$ uv run ruff check .
All checks passed!
[exit 0]

$ uv run ruff format --check .
9 files already formatted
[exit 0]

$ uv run pip-audit
No known vulnerabilities found
[exit 0]

## Frontend (copia limpia extraída del ZIP)

$ cp .env.example .env.local
[exit 0]

$ npm ci

added 31 packages, and audited 32 packages in 2s

10 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
[exit 0]

$ npm run build

> gps-comercial-web@0.0.0 build
> tsc -b && vite build

vite v8.3.7 building client environment for production...
transforming...
✓ 17 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:  0.27 kB
dist/assets/index-Dr7mVmM-.css    0.65 kB │ gzip:  0.35 kB
dist/assets/index-CgfITuHR.js   220.21 kB │ gzip: 68.96 kB

✓ built in 148ms
[exit 0]

$ npx oxlint
[exit 0]

$ npm audit
found 0 vulnerabilities
[exit 0]

## Peticiones reales al backend en ejecución

$ curl -s -i http://127.0.0.1:8010/health
HTTP/1.1 200 OK
date: Mon, 09 Nov 2026 19:03:13 GMT
server: uvicorn
content-length: 15
content-type: application/json
vary: Origin

{"status":"ok"}
[exit 0]

$ curl -s -i -H "Origin: http://localhost:5173" http://127.0.0.1:8010/health | grep -i access-control-allow-origin
access-control-allow-origin: http://localhost:5173

$ curl -s -i -H "Origin: https://evil.example" http://127.0.0.1:8010/health | grep -ic access-control-allow-origin
0

$ curl -s -o /dev/null -w %{http_code}\n http://127.0.0.1:8010/docs
200
[exit 0]

$ curl -s -o /dev/null -w %{http_code}\n http://127.0.0.1:8010/api/v1/anything
404
[exit 0]

## Exclusión de secretos (rama chore/bootstrap-base de la copia de trabajo)

$ git check-ignore -v backend/.env frontend/.env.local
.gitignore:2:.env	backend/.env
frontend/.gitignore:13:*.local	frontend/.env.local
[exit 0]

$ git check-ignore backend/.env.example frontend/.env.example || echo "ambos .env.example se versionan"
ambos .env.example se versionan

$ git status -sb
## chore/bootstrap-base
 M README.md
?? .gitignore
?? backend/
?? docs/
?? frontend/
[exit 0]

## Contenido del ZIP: búsqueda de archivos prohibidos
$ unzip -l gps-comercial-base.zip | grep -E "(^|/)\.env$|\.env\.local|node_modules|\.venv|dist/" || echo ninguno
ninguno
```
