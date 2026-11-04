import type { KeyboardEvent, ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { color, motion } from '../../design/tokens'
import { MOBILE_CARD_SX, mobileType, wrapAnywhere } from './mobileSx'

export interface MobileCardProps {
  onClick?: () => void
  /**
   * Turns the whole card into a link. Used by the mobile listings where the
   * card is the tap target (the desktop "Ver detalle" button is not repeated).
   */
  href?: string
  /** Top row: id, status chip, badges. */
  header?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  /** Free-form line under the subtitle (dates, route, totals). */
  meta?: ReactNode
  /** Bottom row: buttons or secondary information. */
  footer?: ReactNode
  selected?: boolean
  as?: 'div' | 'li' | 'article'
  children?: ReactNode
}

/**
 * Base card for the mobile listings.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileCard({
  onClick,
  href,
  header,
  title,
  subtitle,
  meta,
  footer,
  selected = false,
  as = 'article',
  children,
}: MobileCardProps) {
  const isLink = Boolean(href)
  const interactive = Boolean(onClick || isLink)

  // A real anchor already handles Enter; only plain clickable cards need this.
  const handleKeyDown =
    onClick && !isLink
      ? (event: KeyboardEvent<HTMLElement>) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onClick()
        }
      : undefined

  return (
    <Box
      component={isLink ? 'a' : as}
      href={href}
      onClick={onClick}
      role={interactive && !isLink ? 'button' : undefined}
      tabIndex={interactive && !isLink ? 0 : undefined}
      onKeyDown={handleKeyDown}
      sx={{
        ...MOBILE_CARD_SX,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: '100%',
        p: 2,
        textAlign: 'left',
        fontFamily: 'inherit',
        ...(isLink && { textDecoration: 'none', color: 'inherit' }),
        ...(interactive && {
          cursor: 'pointer',
          transition: `border-color ${motion.fast}`,
          '&:hover': { borderColor: color.mutedSoft },
          '&:focus-visible': { outline: `2px solid ${color.blue}`, outlineOffset: 2 },
        }),
        ...(selected && {
          borderColor: color.navy,
          boxShadow: `inset 0 0 0 1px ${color.navy}`,
        }),
      }}
    >
      {header && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>{header}</Box>
      )}

      {(title || subtitle || meta) && (
        <Box sx={{ minWidth: 0 }}>
          {title && (
            <Typography
              sx={{
                fontSize: mobileType.cardTitle,
                fontWeight: 800,
                lineHeight: 1.3,
                color: color.navy,
                ...wrapAnywhere,
              }}
            >
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography sx={{ fontSize: mobileType.caption, color: color.muted, ...wrapAnywhere }}>
              {subtitle}
            </Typography>
          )}
          {meta && (
            <Box sx={{ mt: 0.5, fontSize: mobileType.caption, color: color.inkStrong, ...wrapAnywhere }}>
              {meta}
            </Box>
          )}
        </Box>
      )}

      {children}

      {footer && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>{footer}</Box>
      )}
    </Box>
  )
}
