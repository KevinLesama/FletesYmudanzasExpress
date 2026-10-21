# Contribuir — Fletes Express

Convenciones acordadas por el equipo. Si algo de acá no se cumple, se corrige en
la revisión del PR, no después del merge.

## 1. Mensajes de commit en español

**Regla: el mensaje se escribe en español.** Aplica a todo el repositorio, sin
excepción por persona ni por tipo de cambio.

Formato (Conventional Commits):

```
tipo(alcance): descripción en español

Cuerpo opcional, también en español. Explica el porqué, no el qué.
```

- El **tipo** y el **alcance** se mantienen en inglés (`feat`, `fix`, `docs`,
  `refactor`, `style`, `test`, `chore`, `perf`; alcance como `ui`, `design`).
  Son tokens que consumen changelogs y herramientas; traducirlos rompe el
  parseo. La **descripción y el cuerpo van en español**.
- Descripción en minúscula, en imperativo, sin punto final, hasta 72
  caracteres.
- Si el cambio necesita más de una línea para entenderse, usá el cuerpo con
  viñetas.

### Ejemplos correctos

```
feat: agrega tokens de diseño y corrige la escala de radios
fix: bloquea la confirmación si falla la consulta de disponibilidad
docs: agrega DESIGN.md con los tokens del sistema
refactor: usa el ícono WhatsApp de MUI
```

### Ejemplos incorrectos

```
feat: add design tokens            ← en inglés
Fix bug                            ← sin tipo, mayúscula
feat: arreglos                     ← no dice qué cambió
feat: arregla el bug de pagos y el layout y el login   ← varios temas juntos
```

Un commit, un tema. Si el mensaje necesita "y" para describirse, probablemente
sean dos commits.

## 2. Ramas

- `feat/<nombre>`, `fix/<nombre>`, `docs/<nombre>`, `chore/<nombre>`.
- Kebab-case, corto y descriptivo.
- No se commitea directo sobre `main`.

## 3. Pull requests

- Título y descripción en español.
- La descripción responde: qué cambia, por qué y cómo se prueba.
- Un tema por PR; si el diff supera ~400 líneas, conviene partirlo.
- `npm run build` verde antes de pedir revisión.
- En cambios visuales, adjuntar captura de antes y después.
- **No modificar `backend/`** sin coordinarlo con su responsable. El frontend
  consume `/api` y no cambia contratos por su cuenta.

## 4. Diseño y UI

Antes de tocar estilos, leer [`DESIGN.md`](./DESIGN.md).

- Colores, radios, espaciados y tamaños salen de `src/design/tokens.ts` o del
  tema de MUI. Un hex suelto en una página es deuda, no una decisión.
- No agregar íconos dibujados a mano: `@mui/icons-material` es la librería
  única.
- Todo estado de datos necesita cargando, error y vacío (`EmptyState`,
  `LoadingState`, `ErrorState`).
- El feedback va por `Toast` con `tone` explícito (`success` / `error`).

## 5. Entorno local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build de producción
```

El backend se levanta por separado; ver `README.md`.

## 6. Checklist antes de commitear

- [ ] `npm run build` pasa.
- [ ] El mensaje está en español y describe el cambio.
- [ ] No se commiteó `package-lock.json` sin motivo.
- [ ] No hay `.env`, credenciales ni rutas absolutas.
- [ ] El cambio no toca `backend/` sin acuerdo.
