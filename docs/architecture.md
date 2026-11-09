# Arquitectura inicial propuesta
Esta guía fija un punto de partida, pendiente de comprobar dependencias e infraestructura.
No es evidencia de que exista implementación.

## Stack
- Frontend: React + TypeScript + Vite, TanStack Query para estado de servidor.
- Backend: FastAPI, modelos Pydantic, cliente HTTP de Wialon encapsulado.
- Base: PostgreSQL con ORM y migraciones versionadas (SQLAlchemy/Alembic propuestos).
- Mapa: Leaflet con clustering; verificar licencia, atribución y política del proveedor de tiles.
- Pruebas: pytest; Vitest/Testing Library. E2E es bonus, no bloquea las pruebas obligatorias.
- Versiones: seleccionar versiones estables compatibles durante bootstrap y fijarlas; no usar latest sin lockfile.

## Separación
frontend/src/{app,features,shared}
backend/app/{api,services,domain,infrastructure}
backend/app/infrastructure/{db,wialon}
backend/tests
docs

No crear capas vacías por decoración. No microservicios, colas ni Redis sin necesidad demostrada.
UI llama API propia; API aplica permisos/casos de uso; Gateway traduce Wialon a modelos propios.

## Persistencia
PostgreSQL: usuarios, hashes, roles/permisos, auditoría y sesiones/refresh si la estrategia lo necesita.
Wialon: unidades, conductores, pasajeros/tags, vinculaciones y campos personalizados.
No duplicar por defecto entidades remotas en DB local. Un caché local debe tener TTL y justificación.
Identificar entidades remotas con su recurso y entidad cuando corresponda, sin asumir IDs globales.

## Contratos
/api/v1 para negocio; /health para vida del proceso (no exponer configuración ni token).
OpenAPI documentado; producción proteger o limitar Swagger según decisión.
Errores coherentes con código propio, mensaje seguro y trazabilidad sin secretos.
Paginación consistente y filtros de vehículos/pasajeros del lado servidor.
Definir endpoint de posiciones que represente todos los vehículos necesarios para el mapa, independiente de la página de la tabla.
ISO-8601 UTC en API; America/Bogota en UI; km/h; rumbo cardinal en UI.
Estado derivado en backend con umbrales documentados y probados; no inventar un umbral como requisito del evaluador.
Validar coordenadas, nulos, timestamp ausente/antiguo y datos externos.

## Wialon
Host fijo configurado por entorno, no URL elegida por el usuario.
Fuente: https://help.wialon.com/es/api/user-guide
Comprobar parámetros, flags y permisos en documentación oficial y con lecturas reales.
Token/login y renovación de sesión transparente, limitada y sin bucles.
Time-outs explícitos; backoff para operaciones seguras; caché corto recomendado.
No reenviar automáticamente una escritura cuando no se sabe si fue aplicada.
En updates preservar campos opcionales existentes; especial cuidado con jp de pasajeros.
Lectura previa + mapeo/merge cuando lo requiera el contrato real.
No devolver JSON remoto crudo ni sid. No loggear payloads con secretos.
Historial: investigar servicios de mensajes, límites, volumen de puntos y cleanup de recursos de sesión.
Pruebas unitarias mockean Wialon; validación de integración real se registra por separado.

## Acceso
Permisos granulares por rol; denegar por defecto, verificar recurso y usuario activo en backend.
Admin crea usuarios, asigna rol, activa/desactiva y restablece credenciales.
Cambio obligatorio de contraseña inicial; impedir acceso normal hasta completarlo.
Hash Argon2/bcrypt; política de contraseñas; rate limiting/bloqueo temporal; errores genéricos de login.
Cerrar sesión y desactivar usuario deben invalidar el acceso conforme a la estrategia.
Decidir cookies/renovación antes de implementar: HttpOnly/Secure/SameSite y CSRF si cookies.
No tokens ni información sensible en localStorage.
Al separar orígenes, comprobar en navegador CORS explícito, credenciales, CSRF y restricciones de cookies.
No solucionar un fallo abriendo CORS a todos o desactivando seguridad.

## Patrones y SOLID
Repository para persistencia local; Gateway/Adapter para Wialon; DTO/Mapper para transformación.
DI para sustituir dependencias en tests. Strategy/Factory solo con variación real y explicación concreta.
Justificar en README con referencias reales a archivos/líneas; no escribir ejemplos inventados de cumplimiento.

## Despliegue
Frontend propuesto en proyecto nuevo Vercel. Backend Python y PostgreSQL: proveedor gratuito por verificar.
No afirmar que una prueba temporal o crédito corto cumple la disponibilidad de 15 días.
Validar arranque en frío, timeout, persistencia, HTTPS y configuración de secretos.
Publicar una base mínima pronto; subdominio después de comprobar URL provisional.
No modificar el DNS raíz del portafolio para publicar el subdominio.
Preparar frontend con estado de inicio del servidor y reintentos limitados.
Registrar proveedor, condiciones verificadas y limitaciones en este archivo cuando se decidan.

## Decisiones pendientes
- Versión de Python utilizable en el equipo y en el hosting.
- Proveedores backend/DB gratuitos disponibles para esta cuenta.
- Estrategia completa de sesión, CSRF y dominios/orígenes.
- Recurso Wialon y permisos reales del token.
- Contratos de datos y reglas de estado.
- Diseño aprobado de Claude Design.

