# gps-comercial
Plataforma de monitoreo de flotas — Prueba técnica Fullstack

> Estado: base ejecutable. Backend FastAPI con `/health` y frontend React + TypeScript + Vite.
> Aún no hay login, integración Wialon ni despliegue.

## Estructura

```
backend/    API en Python (FastAPI). Dependencias y lockfile con uv.
frontend/   Aplicación web en React + TypeScript + Vite. Lockfile de npm.
docs/       Contexto, arquitectura, checklist y estado del proyecto.
```

## Requisitos

| Herramienta | Versión probada | Para qué |
|---|---|---|
| Git | 2.43+ | Control de versiones |
| Node.js | 22.12+ o 24.x | Frontend (Vite 8 exige `^20.19.0 \|\| >=22.12.0`) |
| uv | 0.11+ | Instala Python 3.13 y las dependencias del backend |

No hace falta instalar Python a mano: `uv` descarga la versión fijada en `backend/.python-version`.
Instalar uv: https://docs.astral.sh/uv/getting-started/installation/

## Arranque local

### Backend

```bash
cd backend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
uv sync --locked
uv run uvicorn app.main:app --reload --port 8000
```

Comprobar: abre http://localhost:8000/health y debe responder `{"status":"ok"}`.
Documentación interactiva en desarrollo: http://localhost:8000/docs

### Frontend

En otra terminal:

```bash
cd frontend
cp .env.example .env.local  # Windows PowerShell: Copy-Item .env.example .env.local
npm ci
npm run dev
```

Abre http://localhost:5173. Debe mostrar "Servidor disponible" si el backend está arriba.

## Configuración y secretos

| Archivo | ¿Se versiona? | Contenido |
|---|---|---|
| `backend/.env.example` | Sí | Nombres de variables, sin valores secretos |
| `backend/.env` | **No** | Valores reales locales, incluido `WIALON_TOKEN` |
| `frontend/.env.example` | Sí | URL pública de la API |
| `frontend/.env.local` | **No** | Copia local |

- El token de Wialon solo va en `backend/.env` (local) o en las variables del proveedor de hosting.
  Nunca en el frontend, en commits, en capturas ni en el chat.
- Todo `VITE_*` termina dentro del JavaScript público: el frontend no guarda secretos.
- `CORS_ORIGINS` exige orígenes explícitos separados por coma; `*` hace fallar el arranque.
- `/health` solo indica que el proceso responde: no consulta Wialon ni devuelve configuración.

Comprobar que los secretos quedan fuera de Git:

```bash
git check-ignore -v backend/.env frontend/.env.local   # ambas rutas deben aparecer
git check-ignore backend/.env.example || echo "se versiona"  # debe imprimir "se versiona"
```

## Comprobaciones

```bash
cd backend && uv run pytest && uv run ruff check . && uv run pip-audit
cd frontend && npm run build && npm run lint && npm audit
```
