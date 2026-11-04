import { color, radius, shadow, space, type as typeScale } from '../../design/tokens'

/**
 * Presentation constants for the redesigned mobile experience (< md).
 *
 * Everything exported here is meant to be consumed by components that the
 * pages render only behind `useMediaQuery(theme.breakpoints.down('md'))`.
 * Nothing in this file is imported by desktop code paths, so desktop stays
 * pixel-identical.
 */

/** Height of the fixed top bar, excluding `env(safe-area-inset-top)`. */
export const MOBILE_TOP_BAR_H = 56

/** Height of the fixed action bar, excluding `env(safe-area-inset-bottom)`. */
export const MOBILE_ACTION_BAR_H = 64

/**
 * Tallest hint the action bar can show above its buttons (two lines plus the
 * gap), so pages reserve room for it instead of guessing.
 */
export const MOBILE_ACTION_BAR_HINT_H = 48

/** Lateral page gutter on mobile. */
export const MOBILE_GUTTER = space.lg

/**
 * Local type scale for sizes the shared tokens do not define.
 * Sizes that already exist in `design/tokens.ts` are reused, never redefined.
 */
export const mobileType = {
  /** Marketing hero headline. */
  hero: 30,
  /** Agenda greeting. */
  greeting: 22,
  pageTitle: typeScale.title,
  sectionTitle: typeScale.lead,
  cardTitle: 15,
  body: typeScale.body,
  caption: typeScale.caption,
  micro: typeScale.micro,
} as const

/** Minimum touch target (WCAG 2.5.5 / iOS HIG). */
export const MOBILE_TOUCH = {
  minWidth: 44,
  minHeight: 44,
} as const

/** Force 48px controls with 16px text so iOS never zooms on focus. */
export const MOBILE_INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    height: 48,
    fontSize: 16,
    borderRadius: `${radius.md}px`,
  },
  '& .MuiInputBase-input, & .MuiSelect-select': { fontSize: 16 },
} as const

/** Long addresses, ids and names must never create horizontal scroll. */
export const wrapAnywhere = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  minWidth: 0,
} as const

export const MOBILE_SAFE_TOP = 'env(safe-area-inset-top, 0px)'
export const MOBILE_SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

/** Padding a page must reserve so the fixed action bar never covers content. */
export const MOBILE_ACTION_BAR_SPACE = {
  pb: `calc(${MOBILE_ACTION_BAR_H}px + ${MOBILE_ACTION_BAR_HINT_H}px + ${MOBILE_SAFE_BOTTOM} + ${space.lg}px)`,
} as const

/**
 * Top padding every mobile page reserves under the fixed top bar:
 * bar height + notch + gutter. Derived, never a magic number.
 */
export const MOBILE_PAGE_TOP_SPACE = `calc(${MOBILE_TOP_BAR_H}px + ${MOBILE_SAFE_TOP} + ${space.lg}px)`

/**
 * Bottom padding of a mobile page: home indicator + gutter.
 * There is no bottom navigation bar anymore, so nothing else is reserved.
 */
export const MOBILE_PAGE_BOTTOM_SPACE = `calc(${MOBILE_SAFE_BOTTOM} + ${space.lg}px)`

/**
 * `scroll-margin-top` that keeps a scrolled-to panel below the fixed top bar
 * instead of underneath it.
 */
export const MOBILE_SCROLL_OFFSET = `calc(${MOBILE_TOP_BAR_H}px + ${MOBILE_SAFE_TOP} + ${space.sm}px)`

/** Flat bordered card: no shadow, 12px radius, 16px inner padding. */
export const MOBILE_CARD_SX = {
  bgcolor: color.paper,
  border: `1px solid ${color.border}`,
  borderRadius: `${radius.md}px`,
  boxShadow: 'none',
} as const

/** Elevation used by the fixed bars, the drawer and the bottom sheet. */
export const MOBILE_BAR_SHADOW = shadow.raised

/** Focus ring shared by the new interactive mobile surfaces. */
export const MOBILE_FOCUS_RING = {
  '&:focus-visible': {
    outline: `2px solid ${color.blue}`,
    outlineOffset: 2,
  },
} as const
