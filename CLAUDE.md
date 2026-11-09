# GPS Comercial — instrucciones para Claude Code

## Objetivo y contexto
Construir la prueba Fullstack de GPS Control. Entrega: 2026-11-10 a las 09:00 America/Bogota.
Repositorio público: https://github.com/JuanaGonzalez21/gps-comercial
La usuaria es Juana. Explica en español, con pasos pequeños y razones prácticas.
Código y commits consistentes, preferiblemente en inglés. No atribuyas trabajo no realizado.

## Lectura inicial
1. Lee docs/estado.md y comprueba el estado real de Git y archivos.
2. Lee docs/contexto.md y docs/architecture.md.
3. Lee .local-context/prueba_tecnica.md completo: es el enunciado original y manda sobre este paquete.
4. Lee docs/checklist.md y docs/primer-encargo.md.
5. Lee docs/ui-spec.md antes de tocar frontend.
Si falta el enunciado, pide a Juana que copie el archivo privado; no inventes requisitos.
Al delegar, pasa expresamente estas rutas, la tarea y los archivos autorizados. No asumas memoria compartida.

## Tres especialistas del proyecto
- ux-ui: UX/UI, adaptación de Claude Design, accesibilidad y frontend de la tarea asignada.
- code-orchestrator: descomposición técnica, implementación e integración de tareas acotadas.
- architecture-quality: revisión de arquitectura, Wialon, seguridad, pruebas y despliegue.

La sesión principal conserva el control: decide tareas, invoca especialistas, integra y habla con Juana.
No hace falta mantener a los tres ejecutándose todo el tiempo. Usa revisiones paralelas si son independientes.
Un solo responsable escribe cada archivo a la vez. El agente de arquitectura devuelve hallazgos; el implementador corrige.
No delegues recursivamente para este proyecto: las tres especialidades bastan.
Si los agentes aún no aparecen, indica reiniciar la sesión y comprobar /agents; no finjas que fueron invocados.

## Restricciones del enunciado
- Backend con framework Python; frontend con framework JavaScript. No sustituir Python por Node.
- Base propuesta: FastAPI + React/TypeScript/Vite + PostgreSQL; validar dependencias compatibles y fijarlas.
- API /api/v1, OpenAPI, /health, capas y módulos por dominio.
- Wialon solo desde backend, detrás de Gateway/Adapter y DTOs propios. Nunca devolver JSON crudo.
- Credenciales, autorización por recurso y renovaciones de sesiones se comprueban en servidor.
- Roles: Admin, Operador, Visualizador. Backend deniega por defecto.
- CRUD remoto real de conductores y pasajeros, bindings y campos personalizados; conservar campos existentes.
- Dashboard, historial con playback, exportación CSV y auditoría son obligatorios, no bonus.
- Mapas gratuitos sin tarjeta y con atribución; Google Maps está prohibido.
- Despliegue en servicios con plan gratuito; comprobar condiciones actuales antes de elegir.
- Disponibilidad pública HTTPS al menos 15 días después de entregar.
- Landing pública en /, sin registro público de usuarios.
- Paleta: #EB162C #A81A2B #6B6B6B #1E8C93 #EEE8F2.
- UI es-CO, fechas en America/Bogota; API timestamps ISO-8601 UTC.
- El diseño de Claude Design está en curso; no inventes que fue recibido ni esperes para avanzar backend.

## Seguridad y trabajo con secretos
Nunca imprimas, copies en prompts ni comitees valores reales de .env, tokens, contraseñas o cookies.
No leas .env para mostrar su contenido. Los procesos pueden cargarlo; informa solo variable presente/ausente.
No registres el token ni el sid de Wialon. No uses secretos en argumentos de comandos, query strings del navegador o frontend.
Revisa .gitignore y git check-ignore antes de crear secretos. Nunca uses git add . sin revisar archivos.
El enunciado privado vive en .local-context/ y queda excluido de Git; no publicar correo ni credenciales.
Usa variables de entorno para Admin seed y configuración. Sin credenciales por defecto.
No uses permisos de ejecución sin restricciones ni desactives protecciones del entorno.
Lee la documentación oficial antes de operaciones Wialon; prueba lecturas antes de mutaciones.
No borres datos ajenos de la cuenta demo; identifica datos de prueba propios y conserva campos al editar.
No reintentes ciegamente una mutación que pueda haberse aplicado.

## Entrega incremental y explicación
Antes de cada fase explica: objetivo, motivo, requisito y forma de comprobarlo.
Implementa tareas pequeñas de extremo a extremo; ejecuta pruebas adecuadas y revisa el diff.
No crees una arquitectura enorme ni microservicios. No elimines obligaciones para llamar MVP a algo incompleto.
No hagas PWA, modo oscuro, i18n, 2FA ni otros bonus hasta verificar lo obligatorio.
Un fallo externo no autoriza a presentar mocks como integración terminada.
Mantén docs/checklist.md y docs/estado.md con evidencia real; documenta limitaciones.
Después de cada fase entrega un resumen corto: hecho, prueba, pendiente y una acción para Juana.
Incluye una explicación breve de los conceptos y una pregunta de sustentación; no conviertas cada paso en un examen bloqueante.
Git: ramas por tarea, commits pequeños Conventional Commits, sin force push ni fechas inventadas.
No atribuyas autoría o firma de commits que no esté configurada. No envíes el correo de entrega automáticamente.
Si hay autorización de Git vigente, respétala; no hagas push durante el primer encargo definido aquí.

## Primer alcance autorizado
Ejecuta exclusivamente docs/primer-encargo.md inicialmente.
No desarrolles la aplicación completa en una sola ejecución ni despliegues sin revisar proveedores y configuración.

