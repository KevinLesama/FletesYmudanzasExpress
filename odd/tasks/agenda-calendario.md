# Agenda como calendario (Día / Semana laboral)

Rama: `feat/agenda-calendario` · Entrega: work-unit commits + PR manual · Runner: sin test runner de frontend (vite + tsc + detector + CDP).

## Specs

- **S1. Modos de vista.** El segmentado de arriba ofrece solo **Día** y **Semana laboral** (lunes a viernes). No hay vista de mes. Cita: "Dia Semana Laboral".
- **S2. Todo en uno.** Fecha, eje horario y viajes viven en una sola tarjeta: columnas por día con su encabezado, eje de horas a la izquierda y filas horarias continuas. Cita: "todo en uno el dia, la hora".
- **S3. Barra superior.** Contiene, en este orden: "Hoy", flechas ‹ ›, rango de fechas seleccionable (abre un calendario para saltar a un día), el segmentado Día / Semana laboral y el botón de filtros.
- **S4. Filtros detrás de un ícono.** Chofer, vehículo y estado dejan de ocupar una fila y pasan a un popover que abre un ícono de filtros, con indicador visible cuando hay alguno activo y acción para limpiarlos. Cita: "un icono de filtro donde incluir los filtros de vehiculo, chofer y estado".
- **S5. Sin perder funciones.** El clic en un viaje sigue abriendo el detalle; desde ahí se sigue entrando a planificación. La leyenda Confirmada / Pendiente de seña se mantiene.
- **S6. Móvil.** A 390px se fuerza la vista Día (cinco columnas no entran) y la barra se acomoda en dos filas sin desborde horizontal.
- **S7. Sin regresiones.** Contraste AA, hairlines en `'1px'`, `tsc` y `build` verdes, y el detector sin hallazgos nuevos respecto de la base (5 escritorio / 8 móvil, todos `nested-cards`).
- **S8. Detalle como seguimiento.** El modal del viaje deja de ser una ficha y se lee como seguimiento: estado y horario arriba, cinco etapas (Solicitud, Seña, Confirmado, En viaje, Entregado) y línea de tiempo de novedades al costado de las tarjetas de chofer, carga y nota. Sin lógica nueva de negocio: los datos salen de lo que ya trae el viaje.

## Tasks

| ID | Specs | Ruta | Estado |
|----|-------|------|--------|
| T1 | S3, S4 | inline | hecho — `agendaDates.ts` + `AgendaToolbar.tsx` (popovers de fecha y filtros) |
| T2 | S1, S2, S5 | inline | hecho — `AgendaGrid.tsx` multi-día, carriles por solapamiento, detalle al clic |
| T3 | S2, S6 | inline | hecho — `AgendaPage.tsx` una tarjeta, Día forzado en móvil, `DESIGN.md`; en `ChoferPage` se quitó el chip de fecha que desbordaba a 390 (commit `ff445c8`) |
| T4 | S7 | inline | hecho — `tsc` y `build` verdes, detector 3 escritorio / 6 móvil (solo `nested-cards` previos) |
| T5 | S8 | inline | hecho — `TripTracking.tsx` + `TripDetailModal.tsx` reescrito; detector 0 en el modal (1280 y 390) |

## Log

**L1** (pedido original, verbatim): "quiero cambiar la agenda por algo asi de este estilo, todo en uno el dia, la hora y arriba para seleccionar, dia, semana de trabajo y mes" + captura de un calendario semanal oscuro (Today, ‹ ›, rango, Week / Work week / Day, Calendars, +).

**L2** (decisión de alcance, verbatim): "Dia Semana Laboral y un icono de filtro donde incluir los filtros de vehiculo, chofer y estado". Se descarta la vista de mes: el alcance son dos modos y los filtros dejan la fila para vivir en un popover.

**Notas de decisión**

- Tema claro: la referencia es oscura, pero `DESIGN.md` es el árbitro; se traduce el patrón (columnas por día, eje horario, bloques con color de estado) a los tokens existentes.
- Se elimina la tarjeta del `MiniCalendar` a la izquierda: pasa al popover del rango de fechas. Sin eso, cinco columnas no entran a 1280px.
- Ventana horaria intacta (08:00–16:00), porque el horario de servicio del negocio no cambia.
- Excepción de test-first: no hay runner de frontend en el repo; la verificación es `tsc`, `build`, detector y capturas por CDP.

**Evidencia de T4** (2026-10-26)

- `tsc --noEmit` y `npm run build` verdes.
- Detector escritorio 1280×800 sobre las 6 rutas: **3 hallazgos**, todos `nested-cards` en `/planificacion` (previos, documentados). Móvil 390×844: **6**, `nested-cards` en `/planificacion` y `/flota` (previos). La agenda queda en **0**.
- Los cuatro hallazgos que introdujo la primera versión del calendario y cómo se resolvieron: `side-tab` ×3 → se quitó el `border-left` de 3px de los bloques; `low-contrast` (3.4:1) → token `amberInk` para texto ámbar sobre `amberSoft`; `repeating-stripes-gradient` → las líneas de hora pasan a `div`s de 1px.
- Capturas: `agenda-week.png`, `agenda-day.png`, `agenda-filters.png`, `agenda-date.png`, `agenda-mobile.png`, `chofer.png` (`/tmp/opencode`).
- `gentle-ai review assess` sobre `4747c3d..HEAD`: `medium`, `review_due: false` (`under_budget`). Sin revisión nativa.
- Reassess tras T5 con `--untracked-scope=exclude`: `medium`, `review_due: false` (`under_budget`, 1942 líneas). Sin revisión nativa.

**Commits**

- `8c0c412` feat: rediseña la agenda como calendario de día y semana laboral
- `7338eae` docs: documenta las reglas del calendario en DESIGN.md
- `ff445c8` fix: quita la fecha duplicada en la agenda del chofer
- `4c11e17` feat: convierte el detalle del viaje en un seguimiento con etapas
- `cb5767f` docs: documenta el seguimiento del viaje en DESIGN.md

**L3** (pedido, resumen: el original fue una captura de una pantalla de seguimiento): reemplazar el modal de detalle por esa interfaz, sin lógica real por ahora.

**Notas de decisión (T5)**

- La referencia vuelve a ser una pantalla oscura: se traduce al tema claro con los tokens existentes.
- La etapa sale de `status`; `arrivedAt` y `finishedAt` solo refinan un viaje confirmado. En los datos demo FEX-1048 contradice ese orden (llegada con seña pendiente), así que la UI prioriza el estado y no muestra la llegada ni el "Actualizado" de un evento que la etapa no reconoce.
- Se conservaron todas las acciones previas: maps, WhatsApp, remito, incidente, llegada/fin, cálculo del viaje y abrir planificación.

**Evidencia de T5** (2026-10-26)

- `tsc --noEmit` y `npm run build` verdes.
- Detector por CDP sobre el modal abierto (`detect --cdp 9231`): **0** hallazgos en `/agenda` a 1280 y a 390, y en `/chofer` a 1280.
- Hallazgo previo, fuera de alcance: `kicker-above-heading` en `/chofer` (el `MODO CHOFER` de `ChoferShell.tsx:211` sobre el `h1`), ya presente en `main`.
- Capturas: `trip-modal.png` (1280), `trip-modal-mobile.png` (390), `trip-modal-chofer.png` (`/tmp/opencode`).
