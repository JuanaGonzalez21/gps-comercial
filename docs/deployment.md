<!-- Informe del agente architecture-quality (investigación de proveedores, 2026-11-09).
     No se creó ninguna cuenta ni se desplegó nada. Validar de nuevo antes de desplegar. -->

# Despliegue gratuito de GPS Comercial: proveedores verificados (fuentes oficiales consultadas el 2026-11-09)

Leí el enunciado §11 (DEP-01 a DEP-06), `docs/architecture.md:68-75`, `docs/api-contract.md` §4, §8 y §9, `backend/pyproject.toml` y `frontend/vite.config.ts`. No creé cuentas, no desplegué nada y no edité ningún archivo.

## 1. Recomendación
La combinación recomendada es **Vercel Hobby** para el frontend, **Render Free** para el backend y **Neon Free** para la base de datos.
- **Vercel Hobby:** sirve la SPA y reescribe `/api/*` y `/health` hacia el backend, de modo que el navegador ve un solo origen.
- **Render Free:** FastAPI con uvicorn, Python 3.13 nativo, región `virginia`.
- **Neon Free:** región `aws-us-east-1`, con el compute fijo en 0,25 CU.

**Por qué:**
- Ninguno de los tres pide tarjeta.
- Ninguno caduca, y ninguno queda pausado hasta que alguien lo reactive a mano.
- Los tres sirven por HTTPS.
- Un proceso que se mantiene vivo encaja mejor que el serverless con la sesión única de Wialon (INT-01) y la caché con TTL (INT-06).
- El dominio de Juana ya está en Vercel.
- Vercel espera hasta 120 s la respuesta del backend, y Render tarda unos 60 s en despertar.
- Es la topología que ya fija `docs/api-contract.md:128-130`.

**Riesgos:**
- Arranque en frío de un minuto aproximadamente (DEP-04).
- Render incluye 5 GB al mes de salida.
- Neon incluye 100 CU-h al mes.
- Vercel Hobby es solo para "non-commercial personal use", y si se supera un límite la función queda bloqueada hasta 30 días.
- Render no documenta qué devuelve a una petición JSON mientras despierta.

**Alternativas:**
- **Plan B:** FastAPI como Vercel Function en un segundo proyecto de Vercel, con el mismo rewrite. Python en Vercel ya es GA y admite 3.13.
  - Ventaja: arranca en segundos.
  - Contras: respuestas de 4,5 MB como máximo, 4 h al mes de CPU activa, sesión de Wialon y caché separadas por instancia, y todo dependería de una sola cuenta Hobby.
  - Vercel Services (todo en un único proyecto) está en Beta. No lo usaría para esta entrega.
- **Plan C:** un subdominio propio para la API (CNAME hacia Render). Así front y API son el mismo sitio sin proxy, pero exige cambiar el DNS, y eso no está autorizado ahora.
- **Opcional:** un cron externo gratuito que llame a `/health` cada 10-14 min evitaría el arranque en frío (gastaría unas 744 de las 750 h). No lo he contrastado con los términos de Render y no sustituye la pantalla de "servidor iniciando" que exige DEP-04.

## 2. Proveedores

**Backend**
- **Render Free (elegido):**
  - No pide pago para crear el servicio; solo para excedentes.
  - Recursos: 0,1 CPU y 512 MB. Incluye 750 h al mes por workspace.
  - Inactividad: duerme tras 15 min sin tráfico entrante y despierta en "about one minute", mostrando una página de carga a los navegadores.
  - Limitaciones: puede reiniciarse en cualquier momento, el disco es efímero y no hay shell, one-off jobs ni `preDeployCommand`.
  - Cuota: el plan Hobby incluye 5 GB al mes de salida. Si se agotan las horas o el ancho de banda sin tarjeta, suspende los servicios hasta el mes siguiente.
  - Python nativo: los servicios creados desde el 2026-11-03 usan 3.14.10 por defecto, y `PYTHON_VERSION` tiene prioridad sobre `.python-version`.
  - Usa uv si encuentra `uv.lock`, y también admite Docker.
  - Dominio propio con TLS incluido en Free.
- **Koyeb (descartado):** desde la compra por Mistral (2026-02-17), las cuentas nuevas necesitan un plan de pago y un método de pago.
- **Fly.io (descartado):** no hay free tier para organizaciones nuevas. La prueba da $1 o 7 días; después exige tarjeta.
- **Railway (descartado):** prueba de $5 durante 30 días, y luego plan Free con $1 al mes. La RAM cuesta $10 por GB y mes, así que un servicio 24/7 no cabe.
- **Google Cloud Run (solo si Juana acepta un método de pago):** Free Tier sin fecha de fin (2 M peticiones, 180 000 vCPU-s, 360 000 GiB-s, 1 GB de salida al mes en Norteamérica), escala a cero y admite Docker. Exige cuenta de facturación.
- **Hugging Face Spaces con Docker (descartado):** los Spaces Docker y Gradio ahora requieren el plan PRO de pago; solo los estáticos son gratuitos.

**Base de datos**
- **Neon Free (elegido):**
  - Sin tarjeta.
  - Cuota: 100 CU-h por proyecto y mes (a 0,25 CU son unas 400 h), 1 GB por proyecto y 5 GB de salida.
  - Inactividad: escala a cero cuando pasan 5 min sin consultas activas (no se puede desactivar). Reactiva "within a few hundred milliseconds".
  - Sin pausa: según Neon, "doesn't pause Free projects for inactivity".
  - Al agotar las CU-h o la salida, suspende el compute hasta el siguiente periodo.
- **Supabase Free (descartado):** 500 MB y 2 proyectos. Pausa el proyecto tras 7 días de poca actividad, y reanudarlo es un clic manual ("Resume project").
- **Render Postgres Free (descartado):** 1 GB. Caduca a los 30 días, tiene 14 días de gracia y después se borra.

**Frontend**
- **Vercel Hobby (elegido):**
  - Cuotas mensuales: 1 M de peticiones CDN, 100 GB de Fast Data Transfer y 10 GB de Fast Origin Transfer.
  - Proxy: los rewrites externos funcionan como proxy inverso, con un "Proxied Request Timeout" de 120 s. Si se supera, devuelve `ROUTER_EXTERNAL_TARGET_ERROR`.
  - Caché: en proyectos creados desde el 2026-04-06, Vercel cachea las respuestas de rewrites externos si el origen manda cabeceras de caché.
  - Cabeceras configurables en `vercel.json`.
- **Netlify Free (no recomendado):**
  - Cuota: 300 créditos al mes. Un despliegue de producción cuesta 15, cada GB 20 y cada 10 000 peticiones 2. Si se agotan, los proyectos se pausan hasta el siguiente ciclo.
  - Proxy: las reescrituras con estado `200` tienen un timeout de 26 s, menos de lo que tarda Render en despertar.
- **Cloudflare Pages Free (plan B si preocupa la cláusula no comercial de Vercel):**
  - Cuota: 500 builds al mes.
  - Proxy: `_redirects` no puede reenviar a dominios externos. Haría falta una Pages Function; Workers Free da 100 000 peticiones al día y 10 ms de CPU, sin límite de tiempo mientras espera un `fetch`.

## 3. Cookies entre sitios y proxy
- **Por qué hace falta el proxy:** `onrender.com` y `vercel.app` están en la Public Suffix List, así que front y API serían sitios distintos.
  - Safari bloquea por defecto todas las cookies de terceros (ITP).
  - Además, con `SameSite=Lax` (`docs/api-contract.md:114`) ningún navegador enviaría esas cookies en un `fetch` entre sitios. Sin proxy, el diseño actual no funciona en ningún navegador.
- **Con el rewrite de Vercel:** el navegador ve un único origen. Un `Set-Cookie` sin `Domain` queda guardado solo para el dominio del front (cookie de primera parte), y el navegador no aplica CORS.
- **Cabeceras reenviadas:** Vercel documenta que envía al backend `x-real-ip`, `x-forwarded-for` (lo sobrescribe para que no se pueda suplantar), `x-forwarded-host` y `x-forwarded-proto`.
  - Ni Vercel ni Netlify documentan el reenvío de `Origin`, `Cookie`, `Set-Cookie` ni de la query string. Hay que comprobarlo después de desplegar.
  - El backend recibirá como `Host` el de Render. No hay que construir URLs ni validar `Origin` a partir de `Host`.
- **Arranque en frío:** con 120 s de margen en Vercel y unos 60 s de despertar en Render, la primera petición suele tardar pero no falla.
  - Fallaría si el arranque, sumando las migraciones, pasa de 120 s.
  - También fallaría si Render responde con su página HTML de carga en lugar de esperar.
  - Con Netlify (26 s), el primer intento fallaría siempre.

## 4. Hallazgos para el implementador
- **ALTA, `C:/Users/Ardilla Family/Desktop/Enfoque laboral/gps-comercial/docs/api-contract.md:311`:** los reintentos por arranque en frío no se limitan a métodos seguros.
  - Corrección: reintentar solo GET/HEAD y `/health`, y nunca reintentar POST/PUT/PATCH/DELETE. Si una escritura queda en duda, avisar de que el estado es incierto y volver a leer el recurso.
  - Tratar como "servidor iniciando" también las respuestas cuyo `content-type` no sea JSON.
  - Subir el margen de unos 90 s a unos 150 s, y hacer un `GET /health` en cuanto cargue la landing para despertar el backend.
- **ALTA (preventiva), Vercel:** la caché de rewrites externos viene activa en proyectos nuevos y podría guardar respuestas de la API o la página de carga de Render. Corrección: añadir `x-vercel-enable-rewrite-caching: 0` en `/api/*` y `/health`, y enviar `Cache-Control: no-store` desde el backend.
- **MEDIA, `C:/Users/Ardilla Family/Desktop/Enfoque laboral/gps-comercial/backend/pyproject.toml:5`:** el proyecto exige Python `<3.14` y Render usa 3.14.10 por defecto. Corrección: definir `PYTHON_VERSION` con una versión 3.13.x completa.
- **MEDIA, Render Free:**
  - Sin `preDeployCommand` ni shell, las migraciones tienen que ir en el `startCommand` y ser idempotentes.
  - El seed del Admin se ejecuta una vez (desde local contra Neon, o idempotente al arrancar) y después se quita `ADMIN_PASSWORD` del proveedor.
- **MEDIA, salida de 5 GB al mes en Render:** activar GZip en FastAPI, devolver solo los campos necesarios en las posiciones y mantener el polling pausado con la pestaña oculta (RF-14).
- **MEDIA, Neon:**
  - Fijar el compute en 0,25 CU (mínimo igual al máximo) para no pasar de unas 400 h al mes.
  - `/health` no debe consultar la base de datos.
  - Usar `pool_pre_ping=True`, porque Neon cierra las conexiones inactivas al suspender.
  - No dejar transacciones abiertas sin usar, porque Neon las cuenta como actividad y no suspende.
  - Instalar el driver de PostgreSQL y Alembic como dependencias de ejecución, y conectar con `sslmode=require`.
- **MEDIA, redirecciones absolutas:** la redirección de barra final de Starlette o `url_for` enviarían al navegador a `onrender.com` y se perderían las cookies. Corrección: `redirect_slashes=False` o rutas exactas.
- **MEDIA, acceso directo a `onrender.com`:** quien llame directamente al backend puede falsificar `X-Forwarded-For` y esquivar el límite de intentos por IP.
  - El bloqueo por cuenta ya lo mitiga.
  - Opcional: que Vercel añada una cabecera secreta (`routes` con `transforms`, documentado por Vercel) y que el backend rechace lo que no la traiga, salvo `/health`.
- **BAJA, orígenes:** `CORS_ORIGINS` y la comprobación de `Origin` (`docs/api-contract.md:119`) deben incluir exactamente los orígenes de producción. Conviene entregar un solo dominio y comprobar en incógnito que no pide Vercel Authentication.
- **BAJA, uso de Vercel Hobby:** una prueba técnica personal, sin cobros ni anuncios, encaja razonablemente en "non-commercial personal use". Conviene dejarlo escrito como supuesto en el README.
- **BAJA, `Referrer-Policy`:** no usar `no-referrer`, porque la política de teselas de OpenStreetMap pide no bloquear el Referer.

## 5. Configuración mínima (pendiente de validar; sustituir el host real de Render)
`frontend/vercel.json`, con el Root Directory del proyecto de Vercel apuntando a `frontend`. La CSP hay que probarla con el mapa cargado, sin violaciones en la consola.
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/health", "destination": "https://gps-comercial-api.onrender.com/health" },
    { "source": "/api/:path*", "destination": "https://gps-comercial-api.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/api/:path*", "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }] },
    { "source": "/health", "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }] },
    { "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }
    ] }
  ]
}
```
`render.yaml`, en la raíz del repositorio. Si uv o Python 3.13 nativo fallan, la alternativa es `runtime: docker` con el Dockerfile de DEP-05.
```yaml
services:
  - type: web
    name: gps-comercial-api
    runtime: python
    plan: free
    region: virginia
    rootDir: backend
    buildCommand: uv sync --locked --no-dev
    startCommand: uv run --no-sync alembic upgrade head && uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips '*'
    healthCheckPath: /health
    autoDeployTrigger: commit
    envVars:
      - key: PYTHON_VERSION
        value: "3.13.14"   # confirmar en el log de build
      - key: APP_ENV
        value: production
      - key: CORS_ORIGINS
        value: https://gpscomercial.juanagonzalez.dev
      - key: FLEET_GATEWAY
        value: wialon
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL   # cadena de Neon con sslmode=require
        sync: false
      - key: WIALON_TOKEN
        sync: false
```

## 6. Evidencia a recoger después de desplegar (DEP-01, DEP-03, DEP-04)
1. Tras 16 min o más sin tráfico, ejecutar `curl -s -o /dev/null -w "%{http_code} %{content_type} %{time_total}\n" -H "Accept: application/json" https://<front>/health`, repetirlo directamente contra Render y anotar código, tipo de contenido y tiempo.
2. Iniciar sesión en Safari y Firefox en modo privado: deben aparecer las 3 cookies, guardadas solo para el dominio del front, y `x-vercel-cache` no debe ser HIT en `/api/*`.
3. `/api/v1/vehicles?page=2&search=x` debe llegar con la query intacta, y un POST con un `Origin` ajeno debe devolver 403.
4. El log de build de Render debe mostrar Python 3.13.x, el compute de Neon debe estar en 0,25 CU, y Render y Neon deben estar en la misma región.

**Sin confirmar en fuente oficial:** qué devuelve Render a un `fetch` JSON mientras despierta; si Vercel reenvía `Origin` y `Set-Cookie` (solo hay indicios de terceros); y el comportamiento de Firefox, porque la página de Mozilla no cargó.

## Fuentes (consultadas el 2026-11-09)
- **Render:** [free](https://render.com/docs/free) · [outbound-bandwidth](https://render.com/docs/outbound-bandwidth) · [python-version](https://render.com/docs/python-version) · [blueprint-spec](https://render.com/docs/blueprint-spec) · [llms-full](https://render.com/docs/llms-full.txt)
- **Vercel:** [limits](https://vercel.com/docs/limits) · [rewrites](https://vercel.com/docs/routing/rewrites) · [fair use](https://vercel.com/docs/limits/fair-use-guidelines) · [hobby](https://vercel.com/docs/plans/hobby) · [request headers](https://vercel.com/docs/headers/request-headers) · [cache-control](https://vercel.com/docs/caching/cache-control-headers) · [vercel.json](https://vercel.com/docs/project-configuration/vercel-json) · [python](https://vercel.com/docs/functions/runtimes/python) · [function limits](https://vercel.com/docs/functions/limitations) · [services](https://vercel.com/docs/services)
- **Neon:** [pricing](https://neon.com/pricing) · [plans](https://neon.com/docs/introduction/plans) · [scale-to-zero](https://neon.com/docs/introduction/scale-to-zero) · [compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle)
- **Supabase:** [pricing](https://supabase.com/pricing) · [pausing](https://supabase.com/docs/guides/platform/project-pausing)
- **Koyeb:** [blog Mistral](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure) · [instances](https://www.koyeb.com/docs/reference/instances)
- **Fly.io y Railway:** [Fly pricing](https://docs.fly.io/about/pricing) · [Railway trial](https://docs.railway.com/reference/pricing/free-trial) · [Railway plans](https://docs.railway.com/reference/pricing/plans)
- **Google y Hugging Face:** [GCP free](https://docs.cloud.google.com/free/docs/free-cloud-features) · [HF Spaces](https://huggingface.co/docs/hub/spaces-overview)
- **Netlify:** [proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) · [pricing](https://www.netlify.com/pricing/) · [pro-vs-free](https://www.netlify.com/pricing/pro-vs-free/)
- **Cloudflare:** [redirects](https://developers.cloudflare.com/pages/configuration/redirects/) · [pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- **Otras:** [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat) · [WebKit ITP](https://webkit.org/tracking-prevention/) · [teselas OSM](https://operations.osmfoundation.org/policies/tiles/)
