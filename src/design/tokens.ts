/**
 * Design tokens — single source of truth for the Fletes Express UI.
 *
 * Primitives hold raw values; semantic aliases describe intent. Components and
 * pages should consume the semantic names (or the MUI theme) instead of
 * re-declaring hex codes or pixel values.
 *
 * Radius note: `shape.borderRadius` in the MUI theme is the unit used by the
 * `sx` spacing-style radius (borderRadius: 2 === 2 * shape.borderRadius). It is
 * set to 4 so that numeric radii map to this scale:
 *   1 => 4px · 1.5 => 6px · 2 => 8px · 2.5 => 10px · 3 => 12px · 4 => 16px
 * Changing that unit rescales the whole application, so treat it as a system
 * decision, not a local tweak.
 */

export const color = {
  // Surfaces
  cream: '#F7F6F2',
  paper: '#FFFFFF',
  sand: '#FBF9F6',
  sandDeep: '#F0F2F5',

  // Brand
  navy: '#132B4A',
  navyDeep: '#0E2140',
  navySoft: '#172942',
  orange: '#F07855',
  orangeDark: '#DF6948',
  // Text on light surfaces and filled surfaces with white labels must pass AA.
  // Coral (orange) stays for dots, lines and non-text indicators only.
  orangeInk: '#A94E2B',
  orangeStrong: '#B4562F',

  // Text
  ink: '#5C6B7A',
  inkStrong: '#33475F',
  muted: '#64707C',
  mutedSoft: '#9AA3AE',

  // Lines
  border: '#E9E6DF',
  borderSoft: '#EDEAE3',

  // Feedback
  green: '#2F7D55',
  greenSoft: '#EAF6EF',
  amber: '#B9761F',
  amberSoft: '#FFF4E5',
  red: '#B24A3A',
  redSoft: '#FFF3EF',
  blue: '#526B8A',
  blueSoft: '#EEF2FA',
} as const

/** Radius scale in pixels (see the note above about shape.borderRadius). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

/** 4px base spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

/** Type scale in pixels. Micro sizes below 12px hurt legibility at 100% zoom. */
export const type = {
  micro: 12,
  caption: 12.5,
  body: 14,
  lead: 16,
  title: 20,
  display: 26,
} as const

export const shadow = {
  card: '0 1px 2px rgba(19,43,74,0.04)',
  raised: '0 8px 24px rgba(19,43,74,0.10)',
} as const

export const motion = {
  fast: '120ms ease',
  base: '180ms ease',
} as const

export type ColorToken = keyof typeof color
