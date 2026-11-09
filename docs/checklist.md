# Checklist de ejecución y evidencia

Estados permitidos: PENDIENTE, EN CURSO, BLOQUEADO, VERIFICADO.
Un archivo existente no prueba que el requisito funcione. Para VERIFICADO, registrar comando/caso, resultado y evidencia.
El enunciado original manda. Algunas filas mezclan obligaciones y recomendaciones: conservar esa distinción.

## Fases
- [ ] F0: entorno y base ejecutable. Propósito: tener frontend/backend reproducibles; cierre: build y health real.
  EN CURSO (2026-11-09): build y /health reales comprobados en entorno de trabajo Linux, incluso desde copia limpia siguiendo el README. Windows (equipo de Juana, 2026-11-09): `npm ci`, `npm run build` y `npm run lint` OK; `uv sync --locked` OK, `uv run pytest` 7 passed y `curl /health` → `200 {"status":"ok"}`. Criterio de cierre cumplido en ambos entornos; solo falta el commit para que sea reproducible desde Git.
- [ ] F1: viabilidad Wialon y hosting. Propósito: resolver riesgos externos temprano; cierre: lectura real y base pública.
- [ ] F2: contratos, DB y acceso. Propósito: asegurar roles/usuarios; cierre: permisos y cambio inicial comprobados.
- [ ] F3: monitoreo. Propósito: visualizar datos reales; cierre: lista/mapa/detalle sincronizados y actualización.
- [ ] F4: operaciones. Propósito: administrar entidades remotas; cierre: CRUD, bindings y campos verificados en Wialon.
- [ ] F5: módulos obligatorios restantes. Propósito: completar alcance; cierre: dashboard, historial/playback, CSV y auditoría.
- [ ] F6: calidad. Propósito: demostrar funcionamiento; cierre: pruebas, accesibilidad, Lighthouse y seguridad.
- [ ] F7: entrega. Propósito: permitir evaluación; cierre: HTTPS, README, capturas, Admin y disponibilidad 15 días.

Diseño y contratos pueden avanzar en paralelo al backend. Seguridad y pruebas acompañan cada fase, no se posponen a F6.
Las fases ordenan el trabajo; no reducen el alcance obligatorio.
Preparar el paquete no marca F0 ni ningún requisito de aplicación como terminado.

## Requisitos identificados del enunciado (82)
| ID | Nivel | Requisito original | Estado | Evidencia |
|---|---|---|---|---|
| INT-01 | Obligatorio | El backend **DEBE** autenticarse con `token/login` y gestionar la sesión de Wialon (renovarla automáticamente cuando expire, sin que el usuario final lo note). | PENDIENTE | — |
| INT-02 | Obligatorio | Toda comunicación con Wialon **DEBE** pasar por el backend. El frontend **nunca** habla directamente con Wialon. | PENDIENTE | — |
| INT-03 | Obligatorio | El backend **DEBE** encapsular Wialon detrás de una capa propia (cliente/gateway/adaptador) para que el resto del sistema no dependa de sus detalles. | PENDIENTE | — |
| INT-04 | Obligatorio | El backend **DEBE** transformar los datos de Wialon a **modelos propios** (DTOs/esquemas). Está prohibido devolver al frontend el JSON crudo de Wialon. Ver 4.4. | PENDIENTE | — |
| INT-05 | Obligatorio | El backend **DEBE** manejar errores de Wialon (sesión inválida, errores de negocio, timeouts, indisponibilidad) y traducirlos a respuestas propias coherentes y seguras. | PENDIENTE | — |
| INT-06 | Recomendado | El backend **DEBERÍA** aplicar reintentos con backoff, timeouts explícitos y un caché con TTL corto para no saturar la API. | PENDIENTE | — |
| INT-07 | Opcional | El backend **PUEDE** implementar un circuit breaker o degradación elegante cuando Wialon no responda. | PENDIENTE | — |
| RF-01 | Obligatorio | La ruta raíz (`/`) **DEBE** ser una **landing page pública** que explique qué hace la plataforma (monitoreo de flota, beneficios, cómo funciona, módulos principales). Debe tener un llamado a la acción claro para **iniciar sesión**. | PENDIENTE | — |
| RF-02 | Obligatorio | La landing **DEBE** incluir al menos: hero, propuesta de valor, sección de funcionalidades, sección "cómo funciona", llamado a la acción y pie de página. | PENDIENTE | — |
| RF-03 | Obligatorio | Desde la landing **DEBE** poder accederse al login. Un usuario autenticado que entre a `/` **DEBERÍA** ver un acceso directo al panel en lugar del botón de login. | PENDIENTE | — |
| RF-04 | Obligatorio | **DEBE** existir login con correo y contraseña. Rutas protegidas en el frontend (route guards) **y** en el backend. | PENDIENTE | — |
| RF-05 | Obligatorio | **DEBE** existir RBAC con **mínimo 3 roles**: **Admin**, **Operador** y **Visualizador** (puedes agregar más). La matriz de permisos está en 5.3. | PENDIENTE | — |
| RF-06 | Obligatorio | **DEBE** existir un módulo de **gestión de usuarios exclusivo del Admin**: crear usuarios, asignar o cambiar rol, activar/desactivar, restablecer credenciales. Un usuario creado por el Admin **DEBE** cambiar su contraseña en el primer inicio de sesión. | PENDIENTE | — |
| RF-07 | Obligatorio | **DEBE** existir un usuario **Admin inicial** creado por un script de *seed* o comando de gestión (con credenciales leídas de variables de entorno), no hardcodeadas. | PENDIENTE | — |
| RF-10 | Obligatorio | **DEBE** listar los vehículos (unidades) de la cuenta `demoApps` con **búsqueda, filtros por estado y paginación del lado del servidor**. | PENDIENTE | — |
| RF-11 | Obligatorio | **DEBE** pintar en un **mapa gratuito** la posición actual de todos los vehículos, con ícono distinguible por estado, popup/tarjeta con la información clave y **agrupación (clustering)** cuando haya muchos marcadores cercanos. | PENDIENTE | — |
| RF-12 | Obligatorio | **DEBE** existir una vista de **detalle de vehículo** con sus datos transformados, su posición, su estado y su **conductor asignado** (ver RF-13). | PENDIENTE | — |
| RF-13 | Obligatorio | **DEBE** mostrar qué conductor está en cada vehículo, **siempre que esté vinculado (bindeado)** en Wialon. Si no hay conductor vinculado, la UI debe comunicarlo claramente. | PENDIENTE | — |
| RF-14 | Obligatorio | Las posiciones **DEBEN** actualizarse sin recargar la página (polling inteligente, SSE o WebSocket). Debe pausarse cuando la pestaña no está visible. | PENDIENTE | — |
| RF-15 | Obligatorio | Sincronizar el mapa con la lista: al seleccionar un vehículo en una, se resalta en la otra. | PENDIENTE | — |
| RF-16 | Obligatorio | **DEBE** existir CRUD completo de **conductores**, con persistencia **en Wialon** (las altas, cambios y bajas hechas en tu interfaz deben verse en la plataforma Wialon, y viceversa en la lectura). | PENDIENTE | — |
| RF-17 | Obligatorio | **DEBE** poder **vincular y desvincular** un conductor a un vehículo desde la interfaz, reflejado en Wialon. | PENDIENTE | — |
| RF-18 | Obligatorio | Validaciones en frontend **y** backend (campos obligatorios, formatos, duplicados). Mensajes de error claros para el usuario. | PENDIENTE | — |
| RF-08 | Obligatorio | **DEBE** existir CRUD completo de **pasajeros** con persistencia **en Wialon**: las altas, ediciones y bajas hechas en tu interfaz deben verse en la plataforma Wialon, y los datos que se muestren deben leerse desde Wialon. Debes identificar qué servicios de la API corresponden a esta entidad (ver 4.2). | PENDIENTE | — |
| RF-09 | Obligatorio | **DEBE** poder **asignar y desasignar** un pasajero a un vehículo, reflejado en Wialon. En el detalle de un vehículo se **DEBEN** listar los pasajeros asignados. Maneja los casos de error (pasajero o unidad inexistente, sin permisos, ya asignado). | PENDIENTE | — |
| RF-27 | Obligatorio | **DEBE** poder **crear, editar y eliminar los campos personalizados de un pasajero** desde la interfaz, con cambios reflejados en Wialon. Ten especial cuidado de no perder los campos existentes al actualizar otros datos del pasajero. | PENDIENTE | — |
| RF-28 | Obligatorio | Búsqueda, filtros, paginación y validaciones (frontend **y** backend) en el listado y los formularios de pasajeros. | PENDIENTE | — |
| RF-19 | Obligatorio | **DEBE** poder **listar, crear, editar y eliminar** los campos personalizados de un vehículo desde la interfaz, con cambios **reflejados en Wialon**. | PENDIENTE | — |
| RF-20 | Obligatorio | **DEBE** manejar errores y estados intermedios: guardando, éxito, fallo con opción de reintentar. | PENDIENTE | — |
| RF-21 | Recomendado | **DEBERÍA** implementar actualización optimista con *rollback* si Wialon falla. | PENDIENTE | — |
| RF-22 | Opcional | **PUEDE** detectar conflictos (el campo cambió en Wialon mientras lo editabas) y avisar al usuario. | PENDIENTE | — |
| RF-23 | Obligatorio | **Dashboard** con KPIs: total de vehículos, distribución por estado (en movimiento, detenido, sin señal), vehículos con/sin conductor asignado, total de conductores y de pasajeros. Con al menos 2 visualizaciones gráficas. | PENDIENTE | — |
| RF-24 | Obligatorio | **Historial de recorrido**: elegir un vehículo y un rango de fechas, y dibujar el recorrido en el mapa (polilínea) con reproducción (*playback*) y datos de velocidad. Debes investigar qué servicios de mensajes de Wialon usar y cómo manejar grandes volúmenes de puntos (simplificación, límites, paginación o carga por tramos). | PENDIENTE | — |
| RF-25 | Obligatorio | **Exportación a CSV** de vehículos, conductores y pasajeros, respetando los permisos y sanitizando los datos contra *CSV injection*. | PENDIENTE | — |
| RF-26 | Obligatorio | **Registro de auditoría** (visible para Admin): quién hizo qué y cuándo (altas, ediciones y bajas de conductores/pasajeros, cambios de campos personalizados, gestión de usuarios, inicios de sesión fallidos). | PENDIENTE | — |
| ARQ-01 | Obligatorio | Arquitectura **por capas** (o hexagonal/limpia) con separación clara: presentación/API, servicios o casos de uso, dominio, infraestructura/persistencia, integración externa. | PENDIENTE | — |
| ARQ-02 | Obligatorio | Aplicación consciente de **principios SOLID**. En el README, indica con ejemplos concretos (archivo y línea) dónde aplicaste cada principio. | PENDIENTE | — |
| ARQ-03 | Obligatorio | Uso justificado de **patrones de diseño**. Se esperan, como mínimo, estos: **Repository**, **Adapter/Gateway** (Wialon), **DTO/Mapper** (transformación de datos), **inyección de dependencias** y **Strategy** o **Factory** donde tenga sentido. Documenta cuáles usaste y por qué. No uses patrones por adornar: se valora más un patrón bien justificado que diez forzados. | PENDIENTE | — |
| ARQ-04 | Obligatorio | API **REST versionada** (`/api/v1`), contratos documentados con **OpenAPI/Swagger**, paginación consistente y formato de error uniforme (se recomienda RFC 7807 *Problem Details*). | EN CURSO | 2026-11-09 (Linux): router `/api/v1` montado sin rutas aún (`backend/app/api/v1/__init__.py`); OpenAPI en `/openapi.json` y `/docs` en desarrollo (curl `/docs` → 200). Windows 2026-11-09: `/docs` → 200 y `/api/v1/anything` → 404 (log de uvicorn). Faltan paginación y formato de error. |
| ARQ-05 | Obligatorio | Configuración por **variables de entorno**, separada por ambiente (desarrollo/producción). | EN CURSO | 2026-11-09 (Linux): `backend/app/core/config.py` (pydantic-settings) lee `APP_ENV`, `CORS_ORIGINS`, `WIALON_BASE_URL`, `WIALON_TOKEN`; `.env.example` en backend y frontend, `WIALON_TOKEN` vacío. Falta configuración de producción en hosting. |
| ARQ-06 | Obligatorio | Migraciones de base de datos versionadas. | PENDIENTE | — |
| ARQ-07 | Obligatorio | Logging estructurado, sin datos sensibles. Endpoint de salud (`/health`). | EN CURSO | 2026-11-09 (Linux): `curl /health` → `200 {"status":"ok"}`; pytest verifica que no expone el token. `/health` no consulta Wialon ni devuelve configuración. Windows 2026-11-09: `curl -i /health` → `HTTP/1.1 200 OK`, `{"status":"ok"}`. Falta logging estructurado. |
| ARQ-08 | Obligatorio | Estructura modular (por *features* o dominios), componentes reutilizables y separación entre UI, lógica y acceso a datos. | PENDIENTE | — |
| ARQ-09 | Obligatorio | Capa de acceso a la API centralizada (cliente HTTP con interceptores, manejo global de errores y renovación de sesión). | PENDIENTE | — |
| ARQ-10 | Obligatorio | Gestión de estado de servidor con caché (por ejemplo TanStack Query, SWR, RTK Query o equivalente) y estado de UI separado. | PENDIENTE | — |
| ARQ-11 | Obligatorio | Formularios con validación declarativa y mensajes accesibles. | PENDIENTE | — |
| ARQ-12 | Obligatorio | Estados de **carga, vacío y error** en todas las vistas con datos. Nada de pantallas en blanco. | PENDIENTE | — |
| ARQ-13 | Obligatorio | Si usas TypeScript: sin `any` injustificados y tipos que reflejen los contratos del API. | PENDIENTE | — |
| TST-01 | Obligatorio | Pruebas unitarias del backend (por ejemplo `pytest`) para servicios, mappers y reglas de negocio, con la API de Wialon **simulada (mock)**. Cobertura mínima razonable en la lógica de negocio (referencia: 60% o más). | PENDIENTE | Base pytest lista (7 pruebas de health/CORS/config); aún no hay lógica de negocio que probar. Windows 2026-11-09: `uv run pytest` → 7 passed. |
| TST-02 | Obligatorio | Pruebas de autorización: demuestra que cada rol **no puede** hacer lo que no le corresponde. | PENDIENTE | — |
| TST-03 | Obligatorio | Pruebas del frontend (por ejemplo Vitest/Jest + Testing Library) de componentes o flujos clave. | PENDIENTE | — |
| TST-04 | Opcional | **PUEDE** incluir pruebas end-to-end (Playwright o Cypress) del flujo login, mapa y edición de un campo. | PENDIENTE | — |
| SEG-01 | Obligatorio | Control de acceso roto — RBAC aplicado en el backend en cada endpoint; verificación de propiedad/permiso por recurso (evitar IDOR); denegar por defecto; CORS restrictivo con orígenes explícitos. | EN CURSO | Solo la parte CORS, 2026-11-09 (Linux): orígenes explícitos por `CORS_ORIGINS`; `*` hace fallar la configuración; origen ajeno sin cabecera `Access-Control-Allow-Origin` (pytest y curl). Windows 2026-11-09 (curl): `Origin: http://localhost:5173` → `access-control-allow-origin` presente; `Origin: https://evil.example` → 0 cabeceras. RBAC pendiente. |
| SEG-02 | Obligatorio | Fallas criptográficas — Contraseñas con **Argon2 o bcrypt**; HTTPS obligatorio; ningún dato sensible en logs, URLs o *localStorage*. | PENDIENTE | — |
| SEG-03 | Obligatorio | Inyección — Consultas parametrizadas / ORM; validación y saneamiento de entrada con esquemas; protección contra XSS (escape de salida, sin `innerHTML` con datos no confiables); protección contra CSV injection. | PENDIENTE | — |
| SEG-04 | Obligatorio | Diseño inseguro — Modelado de amenazas breve (una tabla en el README con amenazas y mitigaciones); principio de mínimo privilegio. | PENDIENTE | — |
| SEG-05 | Obligatorio | Configuración de seguridad incorrecta — Cabeceras de seguridad (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, etc.); modo *debug* desactivado en producción; sin credenciales por defecto; documentación (Swagger) protegida o deshabilitada en producción si corresponde. | EN CURSO | 2026-11-09 (Linux): con `APP_ENV=production`, `/docs` y `/openapi.json` → 404 (pytest). Sin credenciales por defecto en `.env.example`. Faltan cabeceras de seguridad. |
| SEG-06 | Obligatorio | Componentes vulnerables y desactualizados — Dependencias fijadas (lockfiles); auditoría con `pip-audit`/`npm audit` o equivalente; reporta los hallazgos y qué hiciste. | EN CURSO | 2026-11-09 (Linux): `backend/uv.lock` y `frontend/package-lock.json`. `uv run pip-audit` → "No known vulnerabilities found"; `npm audit` → 0 vulnerabilities. Windows 2026-11-09: `npm ci` → 0 vulnerabilities; `uv sync --locked` → 55 paquetes; `uv run pip-audit` → "No known vulnerabilities found"; `npm audit` → 0 vulnerabilities. Repetir con cada dependencia nueva y antes de entregar. |
| SEG-07 | Obligatorio | Fallas de identificación y autenticación — *Rate limiting* y bloqueo temporal en login; política de contraseñas; tokens de acceso de corta duración con renovación segura (cookies `HttpOnly`, `Secure`, `SameSite`, o refresh rotatorio); cierre de sesión que invalide credenciales; mensajes de error que no revelen si el usuario existe. | PENDIENTE | — |
| SEG-08 | Obligatorio | Fallas de integridad de software y datos — Lockfiles, CI sin pasos inseguros, validación de datos recibidos de Wialon antes de confiar en ellos. | PENDIENTE | Lockfiles creados (ver SEG-06); CI y validación Wialon pendientes. |
| SEG-09 | Obligatorio | Fallas de registro y monitoreo — Registro de auditoría (RF-26); logs de eventos de seguridad (login fallido, acceso denegado); sin información sensible en los logs. | PENDIENTE | — |
| SEG-10 | Obligatorio | SSRF y manejo de condiciones excepcionales — El backend solo llama al host de Wialon configurado (sin URLs controladas por el usuario); manejo centralizado de excepciones que nunca exponga *stack traces* ni detalles internos al cliente. | PENDIENTE | — |
| SEG-11 | Obligatorio | Protección CSRF — Si usas cookies para la sesión, **DEBES** implementar protección CSRF. | PENDIENTE | — |
| UX-01 | Obligatorio | Diseño **responsive mobile-first**: debe verse y usarse bien en móvil (360 px), tablet y escritorio. El mapa y las tablas deben tener un comportamiento pensado para pantallas pequeñas (no basta con que "no se rompan"). | PENDIENTE | — |
| UX-02 | Obligatorio | Apariencia **profesional y atractiva**, con sistema de diseño coherente: tipografía, escala de espaciado, radios, sombras y componentes consistentes. | PENDIENTE | — |
| UX-03 | Obligatorio | **Accesibilidad**: contraste de texto de al menos **WCAG AA**, navegación por teclado, foco visible, etiquetas en formularios, `alt` en imágenes, y uso correcto de HTML semántico y atributos ARIA. | PENDIENTE | Hallazgo 2026-11-09 (Linux, fórmula WCAG sobre fondo `#EEE8F2`): `#1E8C93` 3.34:1, `#EB162C` 3.73:1, `#6B6B6B` 4.43:1 → no aptos para texto normal (AA 4.5:1); `#A81A2B` 6.13:1 sí. Pasar al diseño. |
| UX-04 | Obligatorio | Retroalimentación al usuario en todas las acciones: *skeletons* o indicadores de carga, notificaciones (toasts), confirmaciones en acciones destructivas, mensajes de error útiles. | PENDIENTE | — |
| UX-05 | Obligatorio | Navegación clara y adaptada al rol: el menú y las vistas cambian según los permisos. | PENDIENTE | — |
| UX-06 | Obligatorio | Tablas de datos usables: ordenar, filtrar, paginar, estados vacíos con guía de acción. | PENDIENTE | — |
| UX-07 | Obligatorio | Rendimiento percibido: la landing debe alcanzar en **Lighthouse (móvil)** al menos **85 en Rendimiento y 90 en Accesibilidad y Buenas prácticas**. Incluye una captura en el README. | PENDIENTE | — |
| UX-08 | Opcional | **PUEDE** incluir modo oscuro respetando la paleta, animaciones sutiles con `prefers-reduced-motion`, y soporte de teclado avanzado. | PENDIENTE | — |
| GIT-01 | Obligatorio | Repositorio **público**. Puede ser un monorepo (`/backend`, `/frontend`) o dos repositorios. | PENDIENTE | Repo público verificado por `git clone` anónimo el 2026-11-09 (solo commit inicial). |
| GIT-02 | Obligatorio | Historial de commits **incremental y legible**: commits pequeños y atómicos, con mensajes siguiendo **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). | PENDIENTE | — |
| GIT-03 | Obligatorio | Se recomienda trabajar con **ramas por funcionalidad** y *pull requests* hacia `main`, aunque sean autorevisados. | PENDIENTE | — |
| GIT-04 | Obligatorio | No reescribir el historial de `main` (sin `force push`). | PENDIENTE | — |
| GIT-05 | Obligatorio | `.gitignore` correcto. Sin `node_modules`, entornos virtuales ni artefactos de build en el repositorio. | EN CURSO | 2026-11-09 (Linux): `git check-ignore -v` confirma `backend/.env` y `frontend/.env.local` ignorados y ambos `.env.example` versionables; los 29 archivos candidatos no incluyen `node_modules`, `.venv`, `dist` ni `.env`. Windows 2026-11-09 (clon real, `.gitignore` combinado): `git check-ignore -v --no-index` ignora `backend/.env`, `frontend/.env`, `frontend/.env.local`, `backend/.env.production`, `.local-context/` y `.claude/settings.local.json`; ambos `.env.example` versionables; `git status` sin `node_modules`, `dist` ni `.env`; tras `uv sync`, `git check-ignore -v` confirma `backend/.env` (regla `**/.env`) y `backend/.venv` ignorados. Falta commit. |
| DEP-01 | Obligatorio | Frontend y backend accesibles por **HTTPS** en URL pública. | PENDIENTE | — |
| DEP-02 | Obligatorio | Configuración mediante variables de entorno en la plataforma de despliegue. | PENDIENTE | — |
| DEP-03 | Obligatorio | CORS configurado solo para el origen del frontend desplegado. | PENDIENTE | — |
| DEP-04 | Obligatorio | Si el plan gratuito **suspende el servicio por inactividad** (arranque en frío), el frontend **DEBE** manejarlo con una UX adecuada: estado "iniciando servidor", reintentos con backoff y mensajes claros. No se acepta una pantalla en blanco o un error genérico. | PENDIENTE | — |
| DEP-05 | Recomendado | **DEBERÍA** incluir `Dockerfile` y/o `docker-compose.yml` para reproducir el entorno en local. | PENDIENTE | — |
| DEP-06 | Opcional | **PUEDE** incluir un pipeline de CI (por ejemplo GitHub Actions) que ejecute linters, pruebas y auditoría de dependencias en cada push. | PENDIENTE | — |
## Condiciones generales sin ID
- [x] Backend framework Python y frontend framework JavaScript. (FastAPI 0.162.2 / React 19.3.1 + Vite 8.3.7, base creada 2026-11-09)
- [ ] Repositorio público, historial real incremental, no único commit final ni historial fabricado.
- [ ] App desplegada y credenciales robustas Admin funcionales para evaluación.
- [ ] UI español Colombia; código/commits consistentes. (EN CURSO: `<html lang="es-CO">`; código en inglés)
- [ ] Mapa gratuito sin tarjeta, no Google Maps, atribución y política tiles respetadas.
- [ ] Transformaciones: timestamps ISO UTC, zona Bogota en UI, km/h, rumbo cardinal, coordenadas y nulos.
- [ ] Estado del vehículo derivado en backend con reglas/umbrales documentados y pruebas.
- [ ] DB persiste usuarios, roles/permisos y auditoría; entidades de flota en Wialon.
- [ ] Paleta obligatoria completa; explicar usos, semántica y contraste. Justificar colores adicionales. (contrastes medidos, ver UX-03)
- [ ] Matriz de permisos completa del apartado 5.3, incluida exportación y lectura de historial.
- [ ] Despliegue con planes gratuitos y disponibilidad al menos 15 días desde entrega.
- [ ] Declaración de IA y capacidad de explicar cada parte en defensa de 15–30 minutos.
- [ ] Revisión OWASP vigente con controles y amenazas documentados; no asumir que etiquetas del enunciado reflejan la última nomenclatura.

## README y entrega
- [ ] Descripción y capturas de landing, dashboard, mapa y móvil.
- [ ] URLs frontend y backend; Swagger si aplica.
- [x] Instalación local comprobada y .env.example sin secretos. (Linux desde copia limpia; Windows 2026-11-09 siguiendo el README: `uv sync --locked`, pytest, ruff, pip-audit, `/health` real, `npm ci`, build, lint, audit. `WIALON_TOKEN` vacío en ambos `.env.example`.)
- [ ] Diagrama de arquitectura y modelo de datos.
- [ ] SOLID/patrones con referencias reales al código.
- [ ] Seguridad y tabla breve de amenazas/mitigaciones.
- [ ] Decisiones de diseño, transformaciones y supuestos.
- [ ] Declaración de IA, limitaciones honestas y mejoras futuras.
- [ ] Lighthouse móvil de landing: rendimiento 85+, accesibilidad 90+, buenas prácticas 90+ y captura.
- [ ] Paquete de entrega preparado: repo público, URLs, Admin privado, disponibilidad 15 días.
- [ ] Ensayo de sustentación: explicar arquitectura, Wialon, RBAC y un cambio pequeño.

## Bonus diferidos
Geocercas, notificaciones/SSE/WebSockets, avl_evts, modo oscuro/i18n, PWA/offline, CI/CD completo,
E2E/cobertura publicada, observabilidad externa, cliente OpenAPI generado, TOTP y stale-while-revalidate.
No marcar como faltantes obligatorios; no empezar hasta verificar lo exigido.

## Evidencia mínima sugerida por riesgo
- RBAC: peticiones API denegadas para cada rol no autorizado, no solo botones ocultos.
- Updates remotos: crear dato propio, editar un campo y comprobar que los demás se conservan.
- Token/sesión: test de renovación y límite de reintentos, sin exponer secretos.
- Datos: mappers con nulos/coordenadas inválidas/timestamps antiguos; estado derivado verificable.
- CSV: entradas peligrosas saneadas y Visualizador sin exportar.
- Historial: rango limitado y muchos puntos, reproducción y velocidad.
- Hosting: URL pública, inicio en frío y sesión real funcionando en navegador.
