# Tema visual del panel y del login

Fecha: 2026-11-10. Rama: `style/panel-login-visual`. Referencia: diseño de Claude Design (capturas de Juana).
Solo cambia la apariencia: la estructura, el orden, los textos, las rutas y la lógica siguen iguales.

## Alcance y aislamiento
- Las reglas están en `frontend/src/styles/panel-theme.css`. Todas empiezan por `.app-shell` (área privada,
  incluidos sus `<dialog>` nativos) o por `.auth-page` (login y cambio de contraseña).
- La hoja viaja en el CSS principal, así que también se descarga con la landing. Se comprobó que no la afecta:
  a 1280 y 360 px, ninguna de sus 47 reglas coincide con un elemento de la landing. Además,
  `--color-border-strong` sigue valiendo `#6b6b6b` en `body`.
- No se modificaron estos archivos compartidos: `tokens.css`, `global.css`, `layouts.css`, `ui/*.css`,
  `Brand.tsx`, `icons.tsx` y la landing.
- Otros cambios:
  - `AppShell.tsx` importa el tema y usa la marca en tono claro.
  - `LoginPage.tsx` y `ChangePasswordPage.tsx` importan el tema.
  - `dashboard.css` cambia las tarjetas de indicadores.
  - `auth.css` añade los anillos decorativos.

## Qué cambió
| Elemento | Antes | Ahora |
|---|---|---|
| Barra lateral, barra superior móvil y menú lateral | Fondo `#1F1A24` | Blanco con divisor `#E2DBE7` dibujado como sombra (las medidas no cambian) |
| Navegación | `#C9C2CF` sobre oscuro; activo `#2E2735` con barra roja | `#57525C`; *hover* `#F7F4F9`; activo: pastilla lavanda `#EEE8F2`, texto `#1F1A24`, icono `#EB162C` y la barra roja |
| Marca | Pin rojo | Pin blanco sobre baldosa roja (mismo tamaño, 28 px) |
| Avatar | `#176F75` | `#1F1A24` |
| Botón secundario | Borde y texto `#176F75` | Blanco, borde `#D6CFDC`, texto `#1F1A24`, icono `#176F75`; *hover* `#F7F4F9` con borde `#857D8C` |
| Estados de botones | Solo *hover* | Pulsado: primario `#0F4C50`, secundario y fantasma `#EEE8F2`, peligro `#8C1524`. Deshabilitado: opacidad 0,55 sin sombra |
| Campos | Borde `#6B6B6B` | Borde `#857D8C`; *hover* `#57525C`; foco con borde `#176F75` y el anillo rojo global; deshabilitado con fondo `#F7F4F9` |
| Insignias de estado | Píldora | Rectángulo con radio de 6 px (mismo tamaño de texto) |
| Cabeceras de tabla | Texto `#1F1A24` | Texto `#57525C` |
| Paginación | Página actual `#176F75` | Página actual `#1F1A24`; contornos `#D6CFDC` |
| Alertas | Borde completo del color del tono | Contorno tintado suave; se conserva el acento de 4 px a la izquierda |
| Indicadores del dashboard | Franja de color de 4 px | Tarjeta lisa; el color de estado queda en el icono y la etiqueta pasa a `#57525C`. El *padding* compensa la franja |
| Sombras | `sm` 0.08 | `sm` 0.05 + 0.04, más difusa |
| Login | Ver "Login rediseñado" | Ver "Login rediseñado" |

## Login rediseñado (petición de Juana, 2026-11-10)
El login copia el diseño de referencia: títulos, textos y fondos. Como logo se usa el icono de GPS Comercial
(pin blanco sobre baldosa roja), no el del prototipo. La lógica no cambia:
- validación, mensajes de error y alertas de sesión;
- foco en el primer campo con error;
- etiquetas "Correo electrónico" y "Contraseña" y botón "Ingresar".

Se añadieron dos elementos visibles en todos los tamaños:
- un aviso de resumen, como en el diseño M1, tras enviar con campos inválidos: "Revisa los campos marcados." y
  "Hay N errores.". Usa `role="alert"` y se actualiza al corregir cada campo; si es el último, desaparece;
- el enlace discreto "‹ Volver al inicio" (gris `#57525C`, 7,59:1) debajo del formulario.

- **Escritorio (≥ 64 rem):** columna oscura `#1F1A24` a la izquierda (2/5) y página blanca a la derecha.
  - Columna oscura:
    - logo arriba;
    - título "Tu flota en tiempo real, en un solo lugar.";
    - subtítulo "Posición, estado y asignaciones de conductores y pasajeros de cada vehículo." en gris
      `#C9C2CF` (`--color-on-dark-muted`, 9,83:1), a petición de Juana, en lugar del tono salmón del diseño;
    - abajo, dos notas con icono: "Solo para cuentas creadas por un administrador. No hay registro público." y
      "En tu primer ingreso deberás cambiar la contraseña.";
    - anillos rojos decorativos (solo CSS, opacidad 0,4) abajo a la derecha, como en el diseño.
  - Formulario sin marco de tarjeta:
    - intro "Usa el correo y la contraseña que te entregó el administrador.";
    - ejemplo `nombre@empresa.com` en el correo;
    - botón con flecha;
    - ayuda "¿Olvidaste tu contraseña? Comunícate con el administrador de tu empresa para restablecerla.".
- **Móvil y tablet (< 64 rem):**
  - banda oscura con el logo y "Tu flota en tiempo real." (24 px a 360 px, hasta 30 px en tablet);
  - el contenido de la banda empieza donde empieza la columna del formulario. Se midió en 10 tamaños,
    de 320 a 1440 px, y el logo y el título comparten la coordenada x del formulario, sin desplazamiento horizontal;
  - un anillo rojo decorativo en la esquina superior derecha de la banda, que no cruza texto;
  - debajo, el formulario sobre blanco, sin el texto introductorio en teléfonos (< 48 rem), como en M1;
  - bajo "Ingresar", dos líneas cortas de 13 px, cada una con su icono en `#176F75`:
    - llave: "¿Olvidaste tu contraseña? Pide al administrador que la restablezca.";
    - usuario administrador: "Solo cuentas creadas por el administrador. En tu primer ingreso cambiarás la
      contraseña.".

    Es la versión condensada a petición de Juana; en escritorio se mantiene la frase completa del diseño, sin
    icono y a 14 px.
- **Textos que se retiraron:**
  - "Monitoreo de flotas sobre Wialon" y su lista de tres capacidades;
  - "Las horas se muestran en la zona horaria de Bogotá.";
  - el pie "¿No tienes cuenta? Solo un administrador puede crear usuarios.".
- **No se copió:** la pista del prototipo "Prueba: envía vacío o con un correo inválido.".
- **Accesibilidad:**
  - un solo `h1` ("Iniciar sesión");
  - el panel es un `aside` con nombre y el título de marca es un párrafo;
  - en el panel oscuro el anillo de foco es blanco: el rojo solo da 3,80:1 sobre `#1F1A24`;
  - contraste del texto: 0 casos por debajo de AA a 1280 y 360 px, también con errores;
  - sin desplazamiento horizontal en 10 tamaños, de 320 a 1440 px;
  - sin errores de consola;
  - pruebas nuevas: el aviso cuenta 2, luego 1 y desaparece; "Volver al inicio" lleva a la landing.
- **Cambiar contraseña:** conserva la tarjeta blanca sobre lavanda con el logo encima.

## Tonos nuevos (solo dentro del ámbito)
| Valor | Derivado de | Uso | Contraste |
|---|---|---|---|
| `#857D8C` | `#6B6B6B` aclarado y teñido de lavanda (familia de `#57525C`) | Borde de campos | 3,96:1 sobre blanco (≥ 3:1) |
| `#D6CFDC` | `#EEE8F2` oscurecido | Contorno de botones secundarios y paginación | Decorativo: identifican al control su etiqueta y su icono |
| `#0F4C50` | `#1E8C93` oscurecido | Primario pulsado | Texto blanco 9,68:1 |
| `#F3C3C9` | `#EB162C` muy claro | Contorno de la alerta de advertencia | Decorativo |
## Contraste de los pares nuevos
- Navegación:
  - `#57525C` sobre blanco: 7,59:1;
  - `#1F1A24` sobre `#EEE8F2`: 14,18:1;
  - icono `#EB162C` sobre `#EEE8F2`: 3,73:1 (no textual).
- Etiqueta de botón secundario `#1F1A24`: 17,05:1 en reposo y 15,64:1 en *hover*.
- Página actual de la paginación y avatar: blanco sobre `#1F1A24`, 17,05:1.
- Anillo de foco rojo:
  - sobre blanco: 4,48:1;
  - sobre lavanda: 3,73:1.
- Auditoría automática de texto (Playwright, color calculado contra el primer fondo opaco):
  - 1.642 textos visibles;
  - login, dashboard, vehículos, conductores, pasajeros, historial, usuarios y auditoría;
  - 1280 y 360 px;
  - resultado: 0 por debajo de AA.

## Comprobaciones (datos simulados, `FLEET_GATEWAY=fake`, sin llamadas a Wialon)
- Capturas antes y después con el mismo tamaño (1280 × 800 y 360 × 780) en 14 pantallas:
  - login con y sin errores;
  - dashboard, vehículos, detalle y conductores con su formulario;
  - pasajeros, historial y usuarios con su formulario;
  - auditoría, cambio de contraseña y menú móvil.
- Geometría: se compararon 1.225 cajas: barra lateral, navegación, tarjetas, tablas, mapa, campos, botones y diálogos.
  - Ninguna se movió por estilo.
  - Las 6 diferencias se deben a los datos: más eventos de auditoría y "hace 14 minutos" frente a "hace 4".
- Sin desplazamiento horizontal en ninguna pantalla.
- Se comprobaron el foco con teclado (navegación, botón y campo), el *hover* de la navegación y el login a 1024 px.
- `npm run build`, `npm run lint` y `npm test`: 161 pruebas superadas.

## Pendiente para la integración (archivos compartidos)
`docs/design-system.md` describe el panel anterior. Al fusionar, conviene actualizar:
- §1–§2:
  - `--color-text` y `--color-dark-raised` ya no pintan la barra lateral; siguen en el panel del login y en el pie de la landing;
  - `--color-primary` ya no es el borde ni el texto del botón secundario en el panel.
- §3: quitar el anillo de foco sobre la barra lateral oscura, porque ahora es blanca.
- §4.4: en el panel, la acción secundaria es neutra (borde suave) con el icono en verde azulado.
- §6: añadir que en el panel las insignias tienen un radio de 6 px.
- `docs/estado.md` y la sección "Decisiones de diseño" del README, si repiten estos puntos.
- En `design-system.md` (apartado "Pulido visual final"), el bloque **Login** describe el panel anterior. También
  queda desactualizada cualquier captura del login en el README.
