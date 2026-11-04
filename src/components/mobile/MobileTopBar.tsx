import type { ReactNode } from 'react'
import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import { ArrowBack, Menu as MenuIcon } from '@mui/icons-material'
import { color, shadow } from '../../design/tokens'
import { MOBILE_SAFE_TOP, MOBILE_TOP_BAR_H } from './mobileSx'

export interface MobileTopBarProps {
  /** Section name. The page body keeps the eyebrow/lead; the h1 is visually hidden. */
  title: string
  /** Renders the hamburger. Omit on screens that show a back button instead. */
  onOpenMenu?: () => void
  /** In-page navigation (client side). */
  onBack?: () => void
  /** Link navigation back to the previous screen. */
  backHref?: string
  /** Contextual action for the current screen. */
  action?: ReactNode
  /** Bottom hairline + shadow. Default `true`. */
  elevation?: boolean
}

/**
 * Compact fixed top bar for every mobile screen.
 *
 * Mobile-only: render it inside an `isMobile` branch. It is intentionally
 * fixed and reserves `env(safe-area-inset-top)` so the notch never covers it.
 */
export function MobileTopBar({
  title,
  onOpenMenu,
  onBack,
  backHref,
  action,
  elevation = true,
}: MobileTopBarProps) {
  const showBack = Boolean(onBack || backHref)

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        top: 0,
        left: 0,
        right: 0,
        bgcolor: color.navy,
        color: color.paper,
        border: 'none',
        pt: MOBILE_SAFE_TOP,
        ...(elevation && {
          boxShadow: shadow.card,
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }),
      }}
    >
      <Toolbar sx={{ minHeight: MOBILE_TOP_BAR_H, px: 1, gap: 0.5 }}>
        {showBack ? (
          backHref ? (
            <IconButton
              component="a"
              href={backHref}
              aria-label="Volver"
              sx={{ color: 'inherit', width: 44, height: 44, flexShrink: 0 }}
            >
              <ArrowBack />
            </IconButton>
          ) : (
            <IconButton
              aria-label="Volver"
              onClick={onBack}
              sx={{ color: 'inherit', width: 44, height: 44, flexShrink: 0 }}
            >
              <ArrowBack />
            </IconButton>
          )
        ) : (
          onOpenMenu && (
            <IconButton
              aria-label="Abrir menú"
              onClick={onOpenMenu}
              sx={{ color: 'inherit', width: 44, height: 44, flexShrink: 0 }}
            >
              <MenuIcon />
            </IconButton>
          )
        )}

        <Typography
          component="p"
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </Typography>

        {action && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {action}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  )
}
