# Primer encargo — base ejecutable
Este es el alcance inicial. No construir toda la aplicación ni dar por terminada una fase sin evidencia.

## Objetivo
Dejar frontend y backend arrancando en local, protegidos contra publicación accidental de secretos.
La usuaria debe entender la estructura y tener un siguiente paso concreto.

## Procedimiento
1. Lee el contexto, enunciado original, checklist y arquitectura. Revisa git status, rama, remoto y archivos existentes.
2. Confirma que estás en el clon real gps-comercial; no inicialices otro repositorio encima ni sobrescribas trabajo.
3. Consulta al agente architecture-quality para una revisión breve del plan; code-orchestrator puede ejecutar el bootstrap.
   UX/UI puede revisar el brief sin modificar archivos compartidos. No esperar diseño para preparar backend.
4. Explica un plan de máximo ocho líneas y procede con las tareas reversibles del alcance.
5. Verifica Git, Node/npm y Python disponibles. El alias WindowsApps no prueba que Python esté instalado.
   Si Python falla, identifica una instalación existente o entrega el paso mínimo para instalarlo; no uses Node como backend.
6. Crea o utiliza una rama de trabajo sin destruir cambios. Fusiona .gitignore si ya existe.
7. Prepara frontend React/TypeScript/Vite mínimo y backend FastAPI con /health.
   Usa versiones compatibles y registra lockfiles/dependencias; no arrastres un generador sobre archivos existentes.
8. Prepara .env.example por aplicación sin valores reales; WIALON_TOKEN debe quedar vacío.
   WIALON_BASE_URL puede incluir https://hst-api.wialon.com/wialon/ajax.html, que no es secreto.
   No necesitas el token para un healthcheck de vida. No crees credenciales ficticias por defecto.
9. Configura CORS de desarrollo con orígenes explícitos, dependientes del entorno.
   /health no consulta Wialon ni devuelve configuración. Reserva /api/v1 para negocio.
10. Añade instrucciones de instalación/arranque comprobadas al README y explica dónde van los secretos.
    Verifica con git check-ignore que backend/.env queda ignorado y .env.example no.
11. Ejecuta build del frontend y comprueba /health mediante petición real si el entorno lo permite.
    Si un comando no pudo ejecutarse, registra el bloqueo exacto y no lo marques como aprobado.
12. Revisa diff y archivos no rastreados. No hagas commit/push todavía: devuelve resultado verificable y propuesta de commit.
    La autorización de este encargo no incluye publicación remota ni cambios de DNS.

## Fuera de este primer encargo
No implementar todavía login completo, CRUD Wialon, pagos, dominio ni despliegue.
No esperar el diseño terminado para ejecutar estas tareas.
No pedir a Juana que pegue el token en el chat.

## Cierre esperado
Actualizar docs/estado.md y solo las filas del checklist que estén realmente verificadas.
Informar: estructura creada, comandos/resultados, URL local si sigue activa, bloqueos y una acción para Juana.
Explicar en pocas líneas qué hace frontend, backend y /health.
Siguiente fase propuesta: acceso Wialon de solo lectura y validación de hosting gratuito, antes de invertir en CRUD.

