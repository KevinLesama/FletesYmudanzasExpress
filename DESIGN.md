# DESIGN.md — Fletes Express

Sistema de diseño del frontend. Es la referencia para cualquier cambio de UI y
la fuente de verdad para quien revise un PR visual.

## Producto y contexto

Aplicación interna de gestión de fletes y mudanzas, en español (es-AR).

Dos superficies, con necesidades distintas:

- **Administración** (`agenda`, `solicitudes`, `planificacion`, `flota`, `pagos`):
  use intensivo en escritorio, densidad de datos alta, decisiones rápidas.
- **Portal chofer** (`chofer`, `chofer/config`): uso en móvil, a la intemperie,
  una acción principal por pantalla y controles grandes.

Regla de decisión: si una pantalla es de administración, priorizá densidad y
escaneo; si es del chofer, priorizá tamaño de toque y una sola acción clara.

## Principios

1. **Una sola fuente de tokens.** Color, radio, espaciado y tipografía salen de
   `src/design/tokens.ts` y del tema MUI. Un hex suelto en una página es deuda.
2. **Bordes antes que sombras.** La jerarquía se construye con `1px` cálido y
   contraste de superficie, no con sombras grandes.
3. **La UI no miente.** Un error nunca se ve como un éxito; un chequeo que falló
   nunca se muestra como "disponible".
4. **Consistencia antes que novedad.** Un patrón nuevo necesita reemplazar a los
   existentes, no convivir con ellos.

## Color

Primitivas en `src/design/tokens.ts` (`color`), expuestas al tema MUI.

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Marca primaria | `navy` | `#132B4A` | Texto principal, botón primario, superficies oscuras |
| Acento decorativo | `orange` | `#F07855` | Puntos, líneas e indicadores; nunca texto |
| Acento de texto | `orangeInk` | `#A94E2B` | Kickers, asteriscos y etiquetas sobre superficies claras (5.1:1) |
| Acento interactivo | `orangeStrong` | `#B4562F` | Botones y superficies con texto blanco (4.9:1) |
| Fondo de app | `cream` | `#F7F6F2` | `background.default` |
| Superficie | `paper` | `#FFFFFF` | Cards, tablas, formularios |
| Superficie alterna | `sand` | `#FBF9F6` | Encabezados de tabla, bloques suaves |
| Línea | `border` / `borderSoft` | `#E9E6DF` / `#EDEAE3` | Bordes de 1px |
| Texto secundario | `ink` | `#5C6B7A` | `text.secondary` |
| Texto atenuado | `muted` | `#64707C` | Metadatos, captions, íconos secundarios |
| Error | `red` | `#B24A3A` | Errores, estados destructivos |
| Advertencia | `amber` | `#B9761F` | Conflictos, pendientes |
| Advertencia de texto | `amberInk` | `#8A5610` | Texto ámbar sobre `amberSoft` (5.6:1); `amber` solo llega a 3.4:1 |
| Éxito | `green` | `#2F7D55` | Confirmaciones |

Reglas:

- Texto atenuado nunca por debajo de `#64707C`: sobre `cream` da 4.68:1 y sobre
  `paper` 5.06:1, así que cumple AA en tamaños chicos. Los grises anteriores
  (`#8A939E`, `#6E7A87`) quedaban en 3.9–4.4:1 y no alcanzaban AA.
- El estado nunca se comunica solo con color: siempre color + texto, y en los
  chips, además, punto + etiqueta (`StatusChip`).
- Los estados de dominio viven en `STATUS_STYLES` (`src/theme.ts`). Si agregás
  un estado nuevo, agregalo ahí; no inventes colores en la página.

## Tipografía

- **Manrope** — títulos (`h1`–`h6`) y la marca. `fontWeight: 800`, tracking
  negativo.
- **DM Sans** — cuerpo, formularios y tablas.

Escala (`src/design/tokens.ts` → `type`):

| Token | px | Uso |
|---|---|---|
| `micro` | 12 | Kickers, etiquetas en mayúsculas |
| `caption` | 12.5 | Metadatos, ayudas |
| `body` | 14 | Texto general, celdas de tabla |
| `lead` | 16 | Párrafos destacados |
| `title` | 20 | Título de sección |
| `display` | 26 | Título de página (lo aplica `AppShell`) |

Reglas:

- No usar tamaños sueltos tipo `fontSize: 13.5`. Elegí un paso de la escala.
- No reinyectar `fontFamily: "'Manrope', sans-serif"` en cada nodo: usá
  `variant="h5"`/`h6` o el componente que ya lo aplica.
- El título de página se define una sola vez en `AppShell` (`title`,
  `description`, `kicker`). No agregues otro encabezado adentro de la página.

## Espaciado y layout

- Base de 4px (`space`). Pasos: 4, 8, 12, 16, 24, 32.
- Ancho de contenido: `1180px` en administración (`AppShell`), `980px` en el
  portal chofer.
- Sidebar de escritorio: `260px`. En móvil se reemplaza por barra inferior con
  `safe-area-inset-bottom`.

## Radios (leer antes de tocar el tema)

`shape.borderRadius` es la **unidad** que multiplica los radios numéricos de
`sx`. Está en `4`, así que:

| `sx` | Resultado |
|---|---|
| `borderRadius: 1` | 4px |
| `borderRadius: 2` | 8px |
| `borderRadius: 2.5` | 10px |
| `borderRadius: 3` | 12px |
| `borderRadius: 4` | 16px |
| `borderRadius: 999` | pill |

Historia: estaba en `12`, por lo que cada card medía 36px de radio y algunas
48px. Ese único valor era la causa principal de la sensación "inflada" de la UI.
**No lo cambies suelto**: recalcula todas las páginas.

Radios por componente (definidos en el tema, no en las páginas): botones 12,
inputs 12, cards 16, diálogos 20, chips 8, menús 12.

## Elevación

- Reposo: `1px solid border`, sin sombra (o `shadow.card`, casi imperceptible).
- Flotante (menú, diálogo, toast): `shadow.raised`.
- Prohibido apilar sombras grandes sobre superficies ya bordeadas.

## Componentes base

| Componente | Archivo | Contrato |
|---|---|---|
| `AppShell` | `src/components/AppShell.tsx` | Layout de administración, navegación, breadcrumb y encabezado único |
| `ChoferShell` | `src/components/ChoferShell.tsx` | Layout móvil del chofer |
| `StatusChip` | `src/components/StatusChip.tsx` | Estado de dominio con punto + texto; colores desde `STATUS_STYLES` |
| `EmptyState` / `LoadingState` / `ErrorState` | `src/components/EmptyState.tsx` | Los tres estados obligatorios de toda vista con datos |
| `Toast` | `src/components/Toast.tsx` | Feedback único; `tone` explícito (`success` / `error`) |
| `AgendaToolbar` | `src/components/AgendaToolbar.tsx` | Barra de la agenda: fecha, vistas y filtros en popover |
| `AgendaGrid` | `src/components/AgendaGrid.tsx` | Grilla horaria multi-día; navegable por teclado |
| `TripDetailModal` | `src/components/TripDetailModal.tsx` | Detalle del viaje en administración y chofer |

Toda vista con datos remotos debe resolver **cargando → error → vacío →
contenido**, en ese orden. `useAsync` ya expone `loading`, `error` y `reload`.

## Agenda (calendario)

- Dos vistas: **Día** y **Semana laboral** (lunes a viernes). En móvil siempre
  se ve Día: cinco columnas no entran en un teléfono.
- Una sola tarjeta contiene la barra y la grilla. El rango de fechas vive en la
  barra; el título de la página describe la cantidad ("3 viajes en la vista") y
  no repite el rango.
- Ventana horaria fija 08:00–16:00, `68px` por hora. Un viaje fuera de la
  ventana se recorta al borde, no agranda la grilla.
- Los bloques toman el fondo y el texto del estado (`green`, `amberInk`,
  `blue`, `red` sobre su `*Soft`). **Sin franja de acento lateral**: el `border-left`
  de 3px es el tell que el detector reporta como `side-tab`.
- Texto ámbar sobre `amberSoft` usa `amberInk` (`#8A5610`, 5.6:1). `amber`
  suelto llega a 3.4:1 y no pasa AA en texto chico.
- Las líneas de hora son `div`s de `1px`, no `repeating-linear-gradient`: el
  gradiente repetido se lee como decoración generada (`repeating-stripes-gradient`).
- Viajes solapados se reparten en carriles; el borde exterior de la columna deja
  `6px` de aire para que el bloque no toque el borde de la tarjeta.
- Chofer, vehículo y estado viven en un popover detrás del botón de filtros, con
  un punto de aviso cuando hay filtros activos. En la barra solo se muestra el
  interruptor de vista y la leyenda de estados.

## Iconografía

- Librería única: **`@mui/icons-material`**, con imports por ícono (nunca el
  barrel) para mantener el tree-shaking.
- Tamaños: 16 (inline en texto), 20 (acciones), 24 (navegación).
- `WhatsAppIcon` es un wrapper del ícono de MUI; no volver a dibujar SVG a mano.
- Vocabulario del negocio (usar el mismo ícono para el mismo concepto):

| Concepto | Ícono |
|---|---|
| Camión / flota | `LocalShipping` |
| Viaje / servicio | `Route` |
| Solicitud | `Checklist` |
| Agenda / fecha | `CalendarMonth` |
| Chofer | `Badge` |
| Cliente | `Person` |
| Pago / cobro | `Payments` |
| Remito | `ReceiptLong` |
| Conflicto / alerta | `WarningAmber` |
| WhatsApp | `WhatsApp` |

## Feedback y estados

- Éxito: `Toast` con `tone: 'success'`, 3.2s.
- Error: `Toast` con `tone: 'error'`, 5s, y el mensaje del backend tal cual.
- Nunca uses el toast de éxito para un fallo ni un `catch` vacío que deje la UI
  mostrando un estado optimista.
- Después de guardar no se reemplaza la pantalla por un spinner: se mantiene el
  contenido y se deshabilita la acción.

## Accesibilidad

- Foco visible global: `2px solid orangeInk` con `outline-offset: 2px` (`CssBaseline`).
  No usar `outline: 0` en elementos interactivos.
- Todo campo tiene etiqueta asociada (`label`/`htmlFor` o `TextField label`); el
  placeholder no es etiqueta.
- Todo `Dialog` tiene `aria-labelledby` apuntando a su título.
- Los objetivos táctiles del portal chofer no bajan de 44×44px.
- Contraste mínimo: 4.5:1 para texto normal.
- El coral `#F07855` no lleva texto encima: para texto usar `orangeInk` y para
  superficies con etiqueta blanca, `orangeStrong`.

### Estado del detector

`impeccable detect` corre sobre las rutas principales a 1280×800 y 390×844.
Resultado actual: cero hallazgos de contraste en escritorio y móvil. Quedan solo
`nested-cards`, que son heurísticas sobre las filas con borde dentro de una
tarjeta (choferes, precios): el borde de 1px y el fondo transparente son
intencionales y no se "corrigen" cambiando el diseño.

Dos falsos positivos que se dieron por buenos en una auditoría anterior **sí eran
defectos reales** y quedaron corregidos:

- "blanco sobre blanco": era el wordmark del `Brand` renderizado en el sidebar
  claro con la tinta del tema oscuro. `Brand` ahora recibe `surface` y usa navy
  sobre superficies claras (`src/components/Brand.tsx`).
- "blanco sobre `#F07855`": era el badge de conteo de Solicitudes. Todo badge con
  etiqueta blanca usa `orangeStrong` (4.87:1), nunca `orange`.

`kicker-above-heading` está ignorado en `.impeccable/config.json`: los kickers son
parte del sistema tipográfico (ver arriba).

## Copy

- Español rioplatense neutro, segunda persona ("Ingresá", "Revisá").
- Sentence case en títulos y botones; mayúsculas solo en kickers con tracking.
- Fechas `dd/mm/aaaa` y moneda `$ 1.234.567` vía `src/format.ts`.
- Los mensajes de error dicen qué pasó y qué hacer, no "Error inesperado".

## Deuda conocida

Estos puntos están fuera del alcance actual y no deben "arreglarse" de paso en
un PR visual:

1. Quedan colores literales en páginas (aunque ya con los valores del token).
   Migración pendiente a `color.*` o al tema.
2. La tabla de rutas está duplicada en `vite.config.ts` (×2), `nginx.conf`,
   `public/_redirects` y `src/routes.ts`.
3. No hay router cliente: la navegación recarga el documento.
4. Código muerto: `src/components/TripCard.tsx`, `src/choferConfig.ts`,
   `BrandBanner` y parte de `src/mockData.ts`.
5. Sin ESLint, Prettier ni tests de frontend.
