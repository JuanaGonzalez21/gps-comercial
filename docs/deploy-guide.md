# Guía de despliegue (planes gratuitos)

Estado (2026-11-09 22:00 Bogotá): **Neon y Render creados por Juana; API pública verificada** en
`https://gps-comercial-ygq0.onrender.com` (HTTPS, cabeceras, CORS, CSRF y conexión a Neon). Vercel y DNS pendientes.
Proveedores elegidos y condiciones verificadas el 2026-11-09: [docs/deployment.md](deployment.md).

| Pieza | Proveedor | Plan | Por qué |
|---|---|---|---|
| Frontend (SPA) | Vercel | Hobby | Sin tarjeta; el dominio ya está en Vercel; rewrite proxy de 120 s (cubre el arranque en frío) |
| API FastAPI | Render | Free (Docker) | Sin tarjeta; proceso persistente (sesión Wialon y caché); duerme tras 15 min |
| PostgreSQL | Neon | Free | Sin tarjeta; no pausa proyectos por inactividad; reanuda en milisegundos |

Topología: el navegador solo habla con el dominio del frontend. Vercel reescribe `/api/*` y `/health` hacia Render,
así las cookies de sesión son de primera parte (Safari/Firefox bloquean cookies de terceros).

## 1. Base de datos (Neon)
1. Crear proyecto `gps-comercial`, región **AWS us-east-1** (misma zona que Render `virginia`), PostgreSQL 17.
2. Compute: mínimo = máximo = 0,25 CU (cabe en las 100 CU-h mensuales).
3. Copiar la *connection string* directa con `sslmode=require` (`postgresql://...neon.tech/neondb?sslmode=require`).
   El backend la convierte a `postgresql+psycopg://` automáticamente.

## 2. API (Render)
Configuración usada (Web Service creado desde el panel; `render.yaml` queda como alternativa Blueprint equivalente):

| Campo | Valor |
|---|---|
| Repositorio / rama | `JuanaGonzalez21/gps-comercial` / `main` |
| Language | Docker |
| Region | Virginia (US East), igual que Neon `aws-us-east-1` |
| Root Directory | `backend` |
| Dockerfile Path | `./Dockerfile` (relativo al Root Directory) |
| Docker Build Context Directory | `.` |
| Docker Command | vacío (usa `CMD ./start.sh`) |
| Instance Type | Free |
| Health Check Path | `/health` |
| URL resultante | `https://gps-comercial-ygq0.onrender.com` |

1. Si se recrea el servicio, anotar la URL real y actualizarla en `frontend/vercel.json`.
2. Variables marcadas `sync: false` (se escriben en el panel, nunca en Git):
   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | cadena de Neon |
   | `WIALON_TOKEN` | token privado de la prueba |
   | `CORS_ORIGINS` | `https://gpscomercial.juanagonzalez.dev,https://<proyecto>.vercel.app` |
   | `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, `ADMIN_PASSWORD` | Admin que se entregará al evaluador (contraseña robusta) |
   Además: `APP_ENV=production`, `FLEET_GATEWAY=wialon`, `LOG_LEVEL=INFO`, `API_DOCS_ENABLED=true`,
   `WIALON_BASE_URL=https://hst-api.wialon.com/wialon/ajax.html`. `DATABASE_URL`: cadena **directa** de Neon (sin pooling)
   tal cual (`postgresql://…?sslmode=require&channel_binding=require`); el backend añade el driver `psycopg`.
   `JWT_SECRET` se genera con el botón Generate de Render. `APP_ENV=production` activa cookies `Secure`, HSTS y validaciones
   (sin SQLite, sin datos simulados, secreto obligatorio).
3. Al arrancar, `start.sh` ejecuta `alembic upgrade head`, crea/asegura el Admin si hay `ADMIN_EMAIL` y lanza uvicorn.
4. Comprobar `https://<api>.onrender.com/health` → `{"status":"ok"}` y `/docs`.
5. Tras el primer arranque correcto, **borrar `ADMIN_PASSWORD`** del panel (el usuario ya existe; el seed es idempotente).

## 3. Frontend (Vercel)
1. `frontend/vercel.json` ya apunta a `https://gps-comercial-ygq0.onrender.com` (rewrites de `/api/*` y `/health`,
   caché de rewrites desactivada, catch-all SPA a `/index.html` y cabeceras de seguridad con CSP).
2. Vercel → Add New Project → mismo repositorio, rama `main`, Project Name `gps-comercial`, **Root Directory `frontend`**,
   preset Vite. Build Command `npm run build`, Output Directory `dist`, Install Command `npm ci`, Node.js 22.x o 24.x.
   **Sin variables de entorno**: `VITE_API_BASE_URL` vacío significa mismo origen y el frontend no lleva secretos.
3. Añadir en Render `CORS_ORIGINS` el dominio `https://<proyecto>.vercel.app` que asigne Vercel (separado por coma).
3. Comprobar `https://<proyecto>.vercel.app/health` (pasa por el rewrite) y el login.

## 4. Subdominio `gpscomercial.juanagonzalez.dev` sin tocar el portafolio
Situación observada el 2026-11-09: el DNS de `juanagonzalez.dev` está en los nameservers `ns-cloud-e*.googledomains.com`
(Google Domains → Squarespace Domains); la raíz apunta a Vercel (`A 76.76.21.21`) y `www` es `CNAME cname.vercel-dns.com`.
1. En el **nuevo** proyecto de Vercel → Settings → Domains → añadir `gpscomercial.juanagonzalez.dev`.
2. En el panel DNS del dominio añadir **solo** `CNAME  gpscomercial  →  cname.vercel-dns.com` (TTL por defecto).
   No modificar los registros `@`/`A` ni `www`: el portafolio sigue igual.
3. Esperar el certificado HTTPS de Vercel (minutos) y añadir el origen a `CORS_ORIGINS` en Render si no estaba.

## 5. Verificación posterior (evidencia para el README)
1. Tras ≥16 min sin tráfico, abrir la app: debe verse "Iniciando el servidor…" y luego cargar (DEP-04).
2. Login en Chrome, Safari/Firefox privados: cookies `gc_*` solo para el dominio del frontend; `x-vercel-cache` no es HIT
   en `/api/*`.
3. Un `POST` con `Origin` ajeno → 403; `/api/v1/vehicles` sin sesión → 401.
4. Log de Render sin token, sid ni contraseñas; `alembic upgrade head` aplicado.
5. Lighthouse móvil de la landing desplegada (≥85 / ≥90 / ≥90) y capturas.
6. Disponibilidad ≥ 15 días: los tres planes no caducan; vigilar cuotas (Render 750 h/mes, Neon 100 CU-h/mes).
