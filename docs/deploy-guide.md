# Guía de despliegue (planes gratuitos)

Estado: **preparado, no ejecutado**. Nada se ha publicado, ni se han creado cuentas, ni se ha tocado el DNS.
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
1. New → Blueprint → repositorio `JuanaGonzalez21/gps-comercial` (usa `render.yaml`): servicio `gps-comercial-api`,
   Docker, plan Free. Si el nombre está ocupado, Render añade un sufijo: anotar la URL real.
2. Variables marcadas `sync: false` (se escriben en el panel, nunca en Git):
   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | cadena de Neon |
   | `WIALON_TOKEN` | token privado de la prueba |
   | `CORS_ORIGINS` | `https://gpscomercial.juanagonzalez.dev,https://<proyecto>.vercel.app` |
   | `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, `ADMIN_PASSWORD` | Admin que se entregará al evaluador (contraseña robusta) |
   `JWT_SECRET` lo genera Render (`generateValue`). `APP_ENV=production` activa cookies `Secure`, HSTS y validaciones
   (sin SQLite, sin datos simulados, secreto obligatorio).
3. Al arrancar, `start.sh` ejecuta `alembic upgrade head`, crea/asegura el Admin si hay `ADMIN_EMAIL` y lanza uvicorn.
4. Comprobar `https://<api>.onrender.com/health` → `{"status":"ok"}` y `/docs`.
5. Tras el primer arranque correcto, **borrar `ADMIN_PASSWORD`** del panel (el usuario ya existe; el seed es idempotente).

## 3. Frontend (Vercel)
1. Editar `frontend/vercel.json` y sustituir `https://gps-comercial-api.onrender.com` por la URL real de Render
   (si coincide, no hay que cambiar nada). Commit + push de ese cambio.
2. Vercel → Add New Project → mismo repositorio → **Root Directory `frontend`**, framework Vite,
   build `npm run build`, output `dist`. Sin variables de entorno (`VITE_API_BASE_URL` vacío = mismo origen).
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
