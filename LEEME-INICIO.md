# GPS Comercial — paquete de contexto para Claude Code

## Instalar (una vez)
1. Clona tu repositorio si todavía no está en tu computador.
2. Copia TODO el contenido de este paquete a la raíz del clon, junto al README.md y .git.
   Incluye .claude y .local-context. No copies la carpeta contenedora como subcarpeta.
   Si ya tienes un .gitignore u otro archivo del mismo nombre, combina sus reglas en vez de reemplazar trabajo.
3. Abre una sesión nueva de Claude Code desde esa carpeta.
4. Usa /agents para comprobar ux-ui, code-orchestrator y architecture-quality.
   Si no aparecen, reinicia la sesión en la raíz correcta.
5. Pega el mensaje de arranque que aparece abajo.

Este paquete es documentación/configuración, NO una aplicación terminada ni un clon de Git.
No contiene tokens ni contraseñas. El enunciado original se incluye en .local-context y queda excluido de Git.
No hay que subir el ZIP al repositorio: copia su contenido y revisa los archivos que vayas a versionar.

## Mensaje de arranque
Lee CLAUDE.md, docs/contexto.md, docs/estado.md y el enunciado completo en .local-context/prueba_tecnica.md.
Confirma que reconoces los agentes ux-ui, code-orchestrator y architecture-quality.
Ejecuta el primer encargo de docs/primer-encargo.md, apoyándote en esos especialistas cuando corresponda.
Primero explica brevemente el objetivo y después realiza los cambios y comprobaciones del alcance.
El diseño de Claude Design está en curso. No necesitas esperar por él para preparar backend y estructura.
No me pidas el token en el chat ni publiques cambios todavía.
Al terminar, actualiza estado/checklist con evidencia real y dame una única tarea siguiente.

## Contenido
- CLAUDE.md: contexto persistente y reglas.
- AGENTS.md: referencia común para otras herramientas.
- .claude/agents/: los tres especialistas.
- docs/contexto.md: decisiones, objetivo y restricciones.
- docs/architecture.md: arquitectura propuesta y pendientes.
- docs/ui-spec.md: pantallas, roles, paleta y estados.
- docs/checklist.md: fases y requisitos con evidencia pendiente.
- docs/estado.md: avance confirmado y formato de relevo.
- docs/primer-encargo.md: primer trabajo acotado.
- .local-context/prueba_tecnica.md: enunciado original completo.
- .gitignore: exclusiones de secretos, contexto privado y archivos generados.

## Notas de funcionamiento
La sesión principal coordina. Los agentes se invocan para tareas concretas; no son tres conversaciones Work.
No es necesario que los tres escriban código simultáneamente.
El contexto del chat de ChatGPT no se transfiere automáticamente; estos archivos son el relevo explícito.
La configuración se preparó usando documentación oficial consultada el 9 de noviembre de 2026:
https://code.claude.com/docs/en/sub-agents
https://code.claude.com/docs/en/memory

