import WhatsApp from '@mui/icons-material/WhatsApp'

/**
 * WhatsApp glyph from the project icon library (@mui/icons-material).
 * Kept as a named wrapper so call sites stay stable.
 */
export function WhatsAppIcon({ size = 17 }: { size?: number }) {
  return <WhatsApp sx={{ fontSize: size }} aria-hidden="true" />
}
