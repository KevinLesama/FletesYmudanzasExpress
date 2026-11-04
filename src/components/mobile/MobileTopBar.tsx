import { AppBar, IconButton, Toolbar, Typography } from '@mui/material'
import { ArrowBack, Menu as MenuIcon } from '@mui/icons-material'
import { color } from '../../design/tokens'
import { MOBILE_SAFE_TOP, MOBILE_TOP_BAR_H, mobileType } from './mobileSx'

export interface MobileTopBarProps {
  /** Section name. The page body keeps the eyebrow/lead; the h1 is visually hidden. */
  title: string
  /** Renders the hamburger. Omit on screens that show a back button instead. */
  onOpenMenu?: () => void
  /** In-page navigation (client side). */
  onBack?: () => void
  /** Link navigation back to the previous screen. */
  backHref?: string
  /** Parent list fallback for a secondary screen. */
  backTo?: string
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
  backTo,
}: MobileTopBarProps) {
  const showBack = Boolean(onBack || backHref || backTo)

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (!backTo) return

    const referrer = document.referrer
    if (window.history.length > 1 && referrer) {
      try {
        if (new URL(referrer).origin === window.location.origin) {
          window.history.back()
          return
        }
      } catch {
        // A malformed or unavailable referrer uses the parent-list fallback.
      }
    }
    window.location.assign(backTo)
  }

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        top: 0,
        left: 0,
        right: 0,
        bgcolor: color.cream,
        color: color.navy,
        border: 'none',
        pt: MOBILE_SAFE_TOP,
        boxShadow: 'none',
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <Toolbar sx={{ minHeight: MOBILE_TOP_BAR_H, px: 1, gap: 0.5 }}>
        {!showBack && onOpenMenu && (
          <IconButton
            aria-label="Abrir menú"
            onClick={onOpenMenu}
            sx={{ color: 'inherit', width: 44, height: 44, flexShrink: 0 }}
          >
            <MenuIcon />
          </IconButton>
        )}

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
              onClick={handleBack}
              sx={{ color: 'inherit', width: 44, height: 44, flexShrink: 0 }}
            >
              <ArrowBack />
            </IconButton>
          )
        ) : null}

        <Typography
          component="p"
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: mobileType.pageTitle,
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </Typography>

      </Toolbar>
    </AppBar>
  )
}
