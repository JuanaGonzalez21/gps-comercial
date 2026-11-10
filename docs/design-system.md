# Sistema de diseño — GPS Comercial

Fuente de la sección "Decisiones de diseño" del README (requisito 8.1 y UX-01…UX-07 del enunciado).
Tokens en `frontend/src/styles/tokens.css`; componentes reutilizables en `frontend/src/ui/`.
Fecha: 2026-11-09. Todo lo que se marca como "medido" se calculó o se observó; lo pendiente se dice.

## 1. Paleta obligatoria y función de cada color

La interfaz es una herramienta de trabajo que se mira durante horas: el fondo debe ser tranquilo, la acción
principal fácil de encontrar y el rojo debe significar "atención", no decoración. Con eso se repartieron los
cinco colores:

| Color | Función | Por qué | Restricción |
|---|---|---|---|
| `#EEE8F2` (lavanda) | Fondo de la aplicación y de secciones alternas de la landing | Neutro cálido y de baja saturación: separa las tarjetas blancas sin competir con los datos | Solo con texto oscuro (`#1F1A24`, `#57525C`) |
| `#1E8C93` (verde azulado) | Color de acción y de estado positivo: botones principales (en su tono oscuro), enlaces, "En movimiento", "Éxito", iconos | El verde azulado se asocia a "en marcha / correcto" y no choca con el rojo de error; es el color "seguro" para pulsar | `#1E8C93` mide 4.02:1 sobre blanco: solo iconos, bordes, marcadores y texto grande. El texto normal y los botones usan el derivado `#176F75` |
| `#EB162C` (rojo de marca) | Identidad: logotipo, punto del *kicker*, barra bajo los títulos, indicador de navegación activa, **anillo de foco** | Es el color más llamativo; usado en poca superficie marca la marca y el foco sin cansar | 4.48:1 sobre blanco: **no apto para texto normal** (exige 4.5:1). Solo elementos no textuales (≥ 3:1) |
| `#A81A2B` (rojo oscuro) | Peligro y error: botones destructivos, mensajes de error, "Sin señal", "Fallo" | Rojo con contraste alto (7.37:1 con blanco): sirve para texto y para fondos de botón | Reservado al significado "error/peligro". No se usa como decoración (por eso los *kickers* de la landing son grises con un punto de marca) |
| `#6B6B6B` (gris) | Estado "Detenido", bordes de campos de formulario, *placeholder* | Gris medio, neutral: "detenido" no es bueno ni malo | Texto solo sobre blanco (5.33:1); sobre la lavanda baja a 4.43:1 y no cumple AA en texto normal |

Blanco (`#FFFFFF`) es la superficie de tarjetas, tablas y diálogos. Negro puro no se usa: el texto principal es
`#1F1A24`, un casi-negro teñido de la lavanda para que el conjunto sea armónico.

## 2. Tonos derivados

Todos salen de la paleta (más oscuros o más claros) o de blanco/negro; ninguno introduce un tono nuevo.

| Token | Valor | Derivado de | Uso |
|---|---|---|---|
| `--color-primary` | `#176F75` | `#1E8C93` oscurecido | Botón principal, enlaces, borde y texto del botón secundario |
| `--color-primary-hover` | `#125A5F` | `#1E8C93` más oscuro | *Hover* del primario, texto de "éxito", banda final de la landing |
| `--color-danger-hover` | `#8C1524` | `#A81A2B` oscurecido | *Hover* del botón destructivo |
| `--color-text` | `#1F1A24` | negro teñido de lavanda | Texto principal, barra lateral y pie de página |
| `--color-text-secondary` | `#57525C` | gris teñido de lavanda | Texto secundario sobre blanco **y** sobre lavanda (el `#6B6B6B` no alcanza en lavanda) |
| `--color-surface-muted` | `#F7F4F9` | lavanda aclarada | Encabezados de tabla, filas en *hover*, tarjetas sobre blanco |
| `--color-dark-raised` | `#2E2735` | `#1F1A24` aclarado | *Hover* en la barra lateral |
| `--color-on-dark-muted` | `#C9C2CF` | lavanda oscurecida | Texto secundario sobre fondo oscuro |
| `--color-border` | `#E2DBE7` | lavanda oscurecida | Separadores decorativos (no delimitan controles) |
| `--color-success-bg` / `--color-info-bg` | `#E6F3F4` | `#1E8C93` muy claro | Fondo de éxito e información, fila seleccionada, iconos de tarjetas |
| `--color-danger-bg` | `#FBEAEC` | `#A81A2B` muy claro | Fondo de error, "Sin señal", "Fallo" |
| `--color-warning-bg` | `#FDE8EA` | `#EB162C` muy claro | Fondo de advertencia (texto oscuro; acento rojo de marca) |
| `--color-neutral-bg` / `--color-neutral-text` | `#EFEFEF` / `#4A4A4A` | `#6B6B6B` aclarado / oscurecido | "Detenido", "Inactivo" |

## 3. Contraste medido

Método: script con la fórmula de luminancia relativa de WCAG 2.x (`(L1 + 0.05) / (L2 + 0.05)`), redondeado a
dos decimales. Umbrales AA: texto normal 4.5:1; texto grande (≥ 24 px, o ≥ 18.66 px en negrita) 3:1;
componentes y elementos gráficos (bordes de campos, iconos con significado, anillo de foco) 3:1.

### Texto

| Texto | Fondo | Ratio | Resultado |
|---|---|---|---|
| `#1F1A24` | `#FFFFFF` | 17.05:1 | AA/AAA |
| `#1F1A24` | `#EEE8F2` | 14.18:1 | AA/AAA |
| `#1F1A24` | `#F7F4F9` | 15.64:1 | AA/AAA |
| `#57525C` | `#FFFFFF` | 7.59:1 | AA/AAA |
| `#57525C` | `#EEE8F2` | 6.31:1 | AA |
| `#57525C` | `#F7F4F9` | 6.96:1 | AA |
| `#6B6B6B` | `#FFFFFF` | 5.33:1 | AA (solo sobre blanco) |
| `#6B6B6B` | `#EEE8F2` | 4.43:1 | **No** apto para texto normal |
| `#FFFFFF` | `#176F75` (botón principal) | 5.89:1 | AA |
| `#FFFFFF` | `#125A5F` (*hover*, banda final) | 7.91:1 | AA/AAA |
| `#176F75` | `#FFFFFF` (enlace, botón secundario) | 5.89:1 | AA |
| `#176F75` | `#EEE8F2` | 4.89:1 | AA |
| `#176F75` | `#E6F3F4` | 5.18:1 | AA |
| `#FFFFFF` | `#A81A2B` (botón destructivo) | 7.37:1 | AA/AAA |
| `#FFFFFF` | `#8C1524` (*hover* destructivo) | 9.34:1 | AA/AAA |
| `#A81A2B` | `#FFFFFF` | 7.37:1 | AA/AAA |
| `#A81A2B` | `#EEE8F2` | 6.13:1 | AA |
| `#125A5F` | `#E6F3F4` (insignia "Éxito/Activo") | 6.97:1 | AA |
| `#4A4A4A` | `#EFEFEF` (insignia "Detenido/Inactivo") | 7.71:1 | AA/AAA |
| `#A81A2B` | `#FBEAEC` (insignia "Fallo/Sin señal") | 6.35:1 | AA |
| `#1F1A24` | `#FDE8EA` (insignia/alerta de advertencia) | 14.54:1 | AA/AAA |
| `#FFFFFF` | `#1F1A24` (barra lateral, pie) | 17.05:1 | AA/AAA |
| `#C9C2CF` | `#1F1A24` | 9.83:1 | AA/AAA |
| `#FFFFFF` | `#2E2735` | 14.41:1 | AA/AAA |
| `#EB162C` | `#FFFFFF` | 4.48:1 | **Falla** texto normal: solo no-texto o texto grande |
| `#1E8C93` | `#FFFFFF` | 4.02:1 | **Falla** texto normal: solo no-texto o texto grande |

### Elementos no textuales (≥ 3:1)

| Elemento | Contra | Ratio |
|---|---|---|
| Anillo de foco `#EB162C` | `#FFFFFF` / `#EEE8F2` / `#F7F4F9` | 4.48 / 3.73 / 4.11 |
| Anillo de foco `#EB162C` | `#1F1A24` / `#2E2735` (barra lateral) | 3.80 / 3.21 |
| Anillo de foco `#EB162C` | `#125A5F` (banda final de la landing) | **1.77 — no cumple**: allí el anillo pasa a blanco (7.91:1) |
| Borde de campo `#6B6B6B` | `#FFFFFF` | 5.33 |
| Icono "En movimiento" `#1E8C93` | `#E6F3F4` / `#FFFFFF` | 3.54 / 4.02 |
| Icono "Detenido" `#6B6B6B` | `#EFEFEF` | 4.63 |
| Icono de error/advertencia `#A81A2B` | `#FBEAEC` / `#FDE8EA` | 6.35 / 6.29 |

Nota: el comentario de `tokens.css` indica 7.57:1 para `#4A4A4A` sobre `#EFEFEF`; la medición da 7.71:1
(cumple igual). Conviene corregir el comentario cuando alguien edite ese archivo.

## 4. Jerarquía visual

1. **Un solo `h1` por vista**: 24–30 px en el panel (`PageHeader`) y 32–52 px en el hero de la landing; peso 700,
   interlineado 1.25. Los `h2` de sección de la landing escalan de 24 a 36 px con una barra de marca debajo.
2. **Superficies**: fondo lavanda → tarjetas blancas con borde `#E2DBE7` y sombra suave. La tarjeta agrupa
   y el contraste de superficie (1.20:1) es decorativo; los controles siempre tienen su propio borde de 5.33:1.
3. **Color = significado**: el verde azulado indica "puedes actuar aquí"; el rojo oscuro solo aparece cuando
   algo falla o se va a destruir; el rojo de marca acompaña (logo, foco, acentos) sin competir con la acción.
4. **Acción principal única por zona**: un botón primario (relleno) por cabecera o diálogo; las demás acciones
   son secundarias (borde) o fantasma (sin borde). Las destructivas usan el estilo de peligro, nunca el primario.
5. **Datos densos**: tablas de 14 px con cabecera sombreada; números y fechas en Bogotá con el valor relativo
   ("hace 5 horas") en texto secundario debajo.

## 5. Estados semánticos (siempre icono + texto + color)

| Estado | Icono | Texto | Colores |
|---|---|---|---|
| Éxito | círculo con visto | "Éxito", "Activo", "Cambios guardados" | `#125A5F` sobre `#E6F3F4`, borde/icono `#1E8C93` |
| Error | círculo con exclamación | "Fallo", mensaje del servidor | `#A81A2B` sobre `#FBEAEC` |
| Advertencia | triángulo (alertas) o llave (contraseña temporal) | "Se muestra una sola vez", "Debe cambiar la contraseña" | texto `#1F1A24` sobre `#FDE8EA`, acento `#EB162C`, icono `#A81A2B` |
| Información | círculo con "i" | avisos neutros | `#1F1A24` sobre `#E6F3F4`, borde `#1E8C93` |
| En movimiento / Detenido / Sin señal | flecha / cuadrado / rombo con "!" | etiqueta en español | verde azulado / gris / rojo oscuro; la forma del marcador en el mapa también cambia |

Advertencia y error usan tintes rosados parecidos; se distinguen por el icono, el texto y el color del texto
(oscuro en advertencia, rojo en error), no solo por el fondo. Las notificaciones (*toasts*) de error se anuncian
en una región `aria-live="assertive"`; las de éxito, en una `polite`.

## 6. Tipografía, espaciado, radios y sombras

- **Fuente del sistema** (`system-ui, Segoe UI, Roboto…`): cero descargas, texto visible desde el primer
  pintado y compatible con una CSP estricta. Monoespaciada del sistema para códigos, IP y contraseñas temporales.
- **Escala tipográfica** (rem): 0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 1.875 · 2.25; los títulos de la landing
  escalan con `clamp()` (h1 de 32 a 52 px). Cuerpo 16 px (evita el zoom de iOS en campos), interlineado 1.5.
- **Espaciado** en base 4 px: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- **Radios**: 6 · 8 · 12 · 16 px y píldora para insignias.
- **Sombras** teñidas con el color de texto: `sm` (tarjetas), `md` (barra superior), `lg` (diálogos e ilustración).

## 7. Foco, teclado y accesibilidad

- **Foco visible global**: contorno de 3 px `#EB162C` con 2 px de separación (`:focus-visible`). En la banda
  verde azulada de la landing se cambia a blanco porque el rojo no alcanza 3:1 allí.
- **Objetivos táctiles** de 44 px en botones, campos, alternadores y el `summary` de "Ver detalles".
- **Formularios**: etiqueta visible enlazada, obligatorios con texto oculto "(obligatorio)", ayuda y error unidos por
  `aria-describedby`, `aria-invalid` y foco al primer campo con error. Validación con zod en cliente y mensajes
  del servidor (409/422) mapeados al campo correspondiente.
- **Diálogos** nativos `<dialog>` (foco atrapado, Esc, fondo inerte). Al abrir, el foco va al primer campo útil
  (o a "Copiar contraseña"); al terminar una cadena de diálogos (crear → contraseña temporal) vuelve al botón que la
  inició.
- **Botones repetidos por fila**: el nombre accesible empieza por el texto visible y añade la persona
  ("Editar a Luis Gómez"), según WCAG 2.5.3.
- **Acciones no permitidas explicadas**: la fila del administrador conectado muestra "Tu cuenta" y una nota
  enlazada al botón deshabilitado ("no puedes desactivarla ni cambiar su rol").
- **Datos de terceros como texto**: los detalles de auditoría se muestran con `JSON.stringify` dentro de `<pre>`;
  React escapa el contenido y no se usa `innerHTML` (probado con un valor `<img onerror>`).
- **Movimiento**: la única animación decorativa (pulso del vehículo en la ilustración) solo corre con
  `prefers-reduced-motion: no-preference`; además hay una regla global que reduce animaciones y transiciones.
- **Semántica**: *landmarks* (`header`, `main`, `nav`, `footer`), una región por sección de la landing con su
  `h2`, listas reales, tablas con `caption`, `scope` y `aria-sort`, y regiones con desplazamiento accesibles por teclado.

## 8. Responsive (mobile-first)

| Ancho | Comportamiento |
|---|---|
| < 48 rem (360 px probado) | Una columna; listas como tarjetas; filtros en 1–2 columnas; menú en cajón |
| 48–80 rem (768 px probado) | Tarjetas de usuarios y auditoría en dos columnas; filtros en 4 columnas |
| ≥ 64 rem | Barra lateral fija; landing en dos columnas (texto + ilustración) |
| ≥ 80 rem (1280 px probado) | Tablas completas de usuarios (5 columnas) y auditoría (6 columnas) sin desplazamiento horizontal |

Medido con Chrome (Playwright, API simulada) en 360, 768 y 1280 px: `scrollWidth` igual al ancho de la ventana
en landing, usuarios y auditoría (sin desbordamiento horizontal) y sin errores en consola en la landing.

## 9. Componentes reutilizables

`src/ui/`: `Button`/`LinkButton` (primario, secundario, peligro, fantasma; estado de carga), `TextField`,
`PasswordField`, `SelectField`, `Card`, `PageHeader`, `Dialog`/`ConfirmDialog`, `Alert`, `EmptyState`,
`ErrorState` (con reintento), `Skeleton`, `Spinner`/`PageLoader`, `Pagination`, `StatusBadge`, `useToast` e iconos SVG propios.

Patrón de listados administrativos (`src/features/users/admin-table.css` y `ToneBadge.tsx`, usados por usuarios y
auditoría): barra de filtros con rol `search`, panel con contador anunciado, tabla en escritorio y tarjetas en
pantallas menores, insignias semánticas. Candidatos a moverse a `src/ui/` (`DataTable`, `FilterBar`, `ToneBadge`)
cuando la sesión principal lo decida.

## 10. Pendiente de medir

- **Lighthouse móvil de la landing** (UX-07: Rendimiento ≥ 85, Accesibilidad y Buenas prácticas ≥ 90): no se
  ha ejecutado Lighthouse. Medición previa con Chrome sobre el *build* de producción servido sin compresión
  (`vite preview`), CPU ×4, RTT 150 ms y 1.6 Mbps, tres corridas: FCP ≈ 1.5 s, LCP 2.2–2.4 s (elemento: párrafo
  del hero), CLS 0, tiempo de bloqueo ≈ 225–256 ms. Es una referencia, no una puntuación: la captura de
  Lighthouse debe tomarse sobre la URL desplegada (con compresión) y adjuntarse al README.
- Revisión con lector de pantalla real (NVDA/VoiceOver) y con un analizador automático (axe): no realizadas.

## Pulido visual final (2026-11-10)
Dirección: producto de flotas sobrio y preciso. La personalidad viene de la composición y la jerarquía, no de efectos.

**Landing**
- Superficies planas, sin gradientes ni ilustraciones abstractas:
  - lavanda `--color-bg` en el hero y el cierre;
  - blanco y `--color-surface-muted` en las secciones de contenido;
  - banda oscura `--color-dark` (la misma superficie de la barra lateral de la app) en "Confianza y control".
- Una sola retícula de 72 rem para cabecera, secciones y pie. En escritorio el hero usa 5/12 de texto y 7/12 de producto.
- Vista de producto real:
  - capturas de la aplicación tomadas con datos **simulados** (`FLEET_GATEWAY=fake`), indicadas en el pie de imagen;
  - nada de nombres, IMEI, teléfonos, coordenadas ni recorridos reales;
  - WebP con `width`/`height` declarados y versión de 720 px para móvil;
  - la imagen del hero lleva `fetchpriority="high"`; el resto, carga diferida.
- Funcionalidades en filas alternas separadas por líneas (no tarjetas idénticas), numeradas en turquesa oscuro con cifras tabulares.
- Rojo de marca solo como marca corta junto a los antetítulos y en el logotipo. Las acciones usan `#176F75`.
- En la banda oscura los iconos usan un tono claro de `#1E8C93` (`#7FD3D8`, 9,92:1) y el anillo de foco pasa a blanco.
- Cabecera con navegación a secciones reales (oculta por debajo de 48 rem, donde el pie y el enlace del hero la cubren). Pie con marca, enlaces reales y atribución de OpenStreetMap. Sin formularios ni registro.

**Login**
- Fondo plano lavanda (se retiraron los gradientes radiales).
- En escritorio, panel oscuro con la marca y tres capacidades reales. En móvil, solo el formulario.
- La tarjeta del formulario tiene borde discreto y sombra ligera.
- Etiquetas visibles, foco, carga y errores se mantienen del componente compartido.

**Transversal**
- Cifras tabulares en tablas e indicadores (`font-variant-numeric: tabular-nums`) para comparar velocidades, fechas y conteos.
- Tabla de pasajeros: con la columna extra de campos personalizados, las cuatro acciones ya no caben en una línea a 1440 px. Ahora forman una cuadrícula pareja de 2 × 2 (editar/cambiar, desasignar/eliminar) en lugar de un salto 3 + 1, y nombres y vehículos vuelven a una sola línea. Conductores mantiene su fila única.
- Contenedor de tablas de conductores y pasajeros con `position: relative`: los textos solo para lectores de pantalla (posición absoluta) escapaban del desplazamiento interno y producían scroll horizontal de toda la página entre 48 y ~75 rem (97 px a 1024 px). Comprobado en 0 en las ocho pantallas internas a 360, 768, 1024, 1280 y 1440 px.

## Rediseño de la landing (2026-11-10)
- Se retiraron las capturas pequeñas del producto. El hero usa una fotografía ilustrativa de una furgoneta y un camión (PNG con transparencia, convertido a WebP con alfa de 720 y 1400 px) sobre una sola forma plana turquesa `#176F75`, con la etiqueta «Integración con Wialon». El reparto es 45 % texto y 55 % imagen.
- Ritmo de secciones:
  - hero lavanda;
  - franja blanca de tres capacidades;
  - sección editorial con fotografía ilustrativa (carga diferida);
  - bloque oscuro «Cómo funciona» con una ficha ilustrativa en HTML/CSS («Vista ilustrativa»: sin mapa ni datos reales, sin botones);
  - control de acceso en blanco;
  - cierre lavanda;
  - pie oscuro.
- Los textos de los roles salen de `ROLE_PERMISSIONS` (`backend/app/domain/permissions.py`).
- Cabecera blanca y fija de 76 px, con contenido de hasta 1200 px. Las secciones compensan la altura con `scroll-margin-top`. En móvil, botón de menú con `aria-expanded` y `aria-controls`; el menú se cierra al navegar y con Escape.
- Todo el CSS nuevo está acotado a `.landing-*` y `.public-*`. Ningún token global cambió.
