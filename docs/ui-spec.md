# Especificación UX/UI inicial
Estado: brief enviado a Claude Design; exportación pendiente.
Cuando llegue, guardar recursos no sensibles en docs/design/ y registrar qué se aprobó.
No depender de que Claude Code pueda abrir un enlace privado de Claude Design.

## Paleta
Obligatoria: #EB162C, #A81A2B, #6B6B6B, #1E8C93, #EEE8F2.
Blanco, negro y derivados admitidos. Otros colores requieren justificación.
Asignar roles de color y medir contraste; un color de marca no garantiza texto blanco legible.
Estados mediante icono + texto + color. Evitar confundir acción primaria con eliminar.

## Pantallas y rutas propuestas
| Ruta | Vista | Acceso |
|---|---|---|
| / | Landing con hero, valor, funcionalidades, cómo funciona, CTA, footer | Público |
| /login | Correo y contraseña | Público |
| /change-password | Cambio inicial obligatorio | Usuario correspondiente |
| /app/dashboard | KPIs y dos visualizaciones | Todos los roles |
| /app/vehicles | Mapa + lista sincronizados | Todos los roles |
| /app/vehicles/:id | Datos, posición, conductor, pasajeros, campos | Lectura todos; escritura Admin/Operador |
| /app/drivers | CRUD y vinculaciones | Lectura todos; escritura Admin/Operador |
| /app/passengers | CRUD, filtros, campos y asignaciones | Lectura todos; escritura Admin/Operador |
| /app/history | Recorrido con fechas, playback y velocidad | Todos los roles |
| /app/users | Crear, rol, activar/desactivar, restablecer | Admin |
| /app/audit | Registro de acciones | Admin |

Formularios de altas/ediciones/asignación pueden ser modales o paneles accesibles, no rutas adicionales obligatorias.
Exportar CSV en listados: Admin y Operador. Visualizador no puede exportar.
Sin registro público ni módulo de nómina, reclutamiento o vacaciones.
Mostrar acceso al panel en landing a usuario autenticado, como mejora recomendada.

## Flujos
Público: landing -> login -> cambio obligatorio si aplica -> dashboard.
Todos: dashboard -> monitoreo <-> detalle -> historial.
Admin/Operador: listados -> crear/editar -> validar -> guardar en Wialon -> refrescar resultado.
Admin: usuarios -> crear -> entregar acceso temporal fuera de Git -> primer cambio de contraseña.
Errores no deben simular éxito ni borrar formularios; reintento con feedback.
Eliminar exige confirmación; un Visualizador no recibe acciones mutables.

## Datos y componentes
KPIs: total de vehículos, distribución por estado, con/sin conductor, conductores, pasajeros.
Tabla con búsqueda, orden, filtros y paginación. Mapa con clustering y estado distinguible.
Al seleccionar en mapa o tabla, resaltar el mismo vehículo; mantener selección coherente.
Polling sin recarga, pausado con pestaña oculta. Mostrar última actualización y datos obsoletos.
Detalle sin conductor: indicarlo; pasajeros asignados visibles; nulos no deben romper UI.
Shell, navegación por permisos, botones, campos, tabla, diálogo, toast, skeleton y estado vacío reutilizables.
Gráficas y mapa con alternativa textual útil; navegación y control por teclado.

## Validación
360 px, tablet y escritorio; en móvil alternar mapa/lista y evitar tablas ilegibles.
Loading, vacío con guía, error/reintento, guardando, éxito, acceso denegado, sesión vencida y servidor iniciándose.
WCAG AA en texto, foco visible, HTML semántico, labels, alt y ARIA cuando corresponda.
Landing Lighthouse móvil: Rendimiento >=85; Accesibilidad >=90; Buenas prácticas >=90.
Registrar capturas reales en README; no sustituir con estimaciones.

