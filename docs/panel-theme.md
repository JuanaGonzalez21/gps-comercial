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
| Login (escritorio) | Panel oscuro liso | Dos anillos rojos decorativos (solo CSS) arriba a la derecha, sin cruzar texto |

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
