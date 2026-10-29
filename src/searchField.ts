/**
 * Buscadores de la app.
 *
 * Chrome ignora `autocomplete="off"` para su Autofill de tarjetas y
 * direcciones (es una decisión de diseño suya), así que la única forma
 * confiable de que no ofrezca contraseñas ni tarjetas guardadas en un
 * buscador es que el campo no se parezca a un campo de pago:
 *
 * - `type="search"`: Chrome no autocompleta datos de pago en buscadores.
 * - `name` neutro: los heurísticos de Autofill se disparan con nombres
 *   como `card`, `cc-number`, `tel` o `number`.
 * - Los `data-*` silencian los gestores de contraseñas más usados.
 */

/** Props para el `<input>`. */
export const SEARCH_INPUT_PROPS = {
  name: 'buscar',
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
} as const

/**
 * `type="search"` mete una "x" nativa en WebKit que rompe el diseño;
 * se oculta y el campo se comporta como un input normal.
 */
export const SEARCH_FIELD_SX = {
  '& input::-webkit-search-cancel-button': { display: 'none' },
  '& input::-webkit-search-decoration': { display: 'none' },
} as const
