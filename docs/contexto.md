# Contexto del proyecto
Estado de preparación: 9 de noviembre de 2026. Entrega: martes 10, 09:00 Colombia.
Producto provisional: GPS Comercial. Empresa evaluadora: GPS Control.
Repositorio: https://github.com/JuanaGonzalez21/gps-comercial (público).
Objetivo: plataforma de monitoreo de flota real con Wialon, backend Python y frontend JavaScript.

## Lo confirmado
- Proyecto creado en Work.
- Repositorio verificado con rama main y README inicial; volver a comprobar antes de modificar.
- Prompt de primera entrega enviado a Claude Design; los diseños aún no se han recibido aquí.
- Primera entrega visual solicitada: login, dashboard, monitoreo y detalle de vehículo.
- Juana usará Claude Code para desarrollar; ChatGPT Work ayuda a coordinar y revisar.
- Se desean tres especialidades: UX/UI, orquestación de código y arquitectura/calidad.
- Se necesita guía por fases, bloques cortos, explicación clara y checklist con evidencia.
- La usuaria dispone del token privado de Wialon; no forma parte de este paquete.
- Base URL confirmada por correo: https://hst-api.wialon.com/wialon/ajax.html
- Cuenta demo indicada: demoApps. Permisos efectivos del token aún NO verificados.
- Dominio personal: juanagonzalez.dev, con sitio en Vercel.
- Subdominio deseado: gpscomercial.juanagonzalez.dev. DNS y despliegue todavía NO configurados.
- Existe BanaHosting pagado, pero el enunciado obliga a servicios con plan gratuito.

## Fuente de verdad
.local-context/prueba_tecnica.md contiene el enunciado completo, sin token ni el correo.
El checklist no reemplaza los detalles de tablas, reglas generales y requisitos sin identificador.
Las instrucciones de este paquete son propuestas de implementación, no nuevos requisitos del evaluador.

## Objetivo final
Landing pública + acceso seguro + monitoreo + operaciones Wialon + historial/playback + CSV + auditoría.
Tres roles con controles en backend y frontend. CRUD de usuarios por Admin y cambio inicial de contraseña.
Repositorio público con historial incremental real; app y API por HTTPS, operativas al menos 15 días.
README reproducible, diagramas, decisiones, controles de seguridad, capturas y declaración de uso de IA.
Credenciales robustas de Admin se entregan por privado al evaluador; nunca en Git.
Defensa técnica de 15 a 30 minutos: Juana debe entender y poder modificar el código.

## Peso de evaluación
Integración Wialon 15; arquitectura 15; seguridad/RBAC 15; funcionalidad 15; UX/UI 15;
calidad/pruebas 10; despliegue/documentación 10; Git/proceso 5. Bonus +10 solo tras lo obligatorio.

## Riesgos y prioridades
1. Fallar despliegue, stack o acceso Admin descalifica; verificar viabilidad desde la primera fase.
2. Wialon no es una API local simulada: permisos, sesiones, recursos y semántica de updates son riesgos tempranos.
3. Un diseño completo no debe bloquear backend ni contratos.
4. La falta de tiempo no convierte dashboard, historial, CSV o auditoría en opcionales.
5. No prometer cumplir todo antes de medir avance. Documentar honestamente lo pendiente.
6. El wireframe compartido era de recursos humanos: usar su idea visual, no sus módulos ni registro público.

## Comunicación
Evitar planes repetidos y preguntas que puedan resolverse mirando el repo.
Pedir solo decisiones o datos que cambien el trabajo. Una tarea humana concreta a la vez.
Dar el porqué de cada fase, evidencia de cierre y siguiente acción.

