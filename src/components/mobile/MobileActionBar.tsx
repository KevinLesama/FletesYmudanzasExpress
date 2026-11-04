import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { color, shadow, space } from '../../design/tokens'
import { MOBILE_ACTION_BAR_H, MOBILE_SAFE_BOTTOM } from './mobileSx'

export interface MobileActionBarProps {
  /** Buttons. Secondary actions belong in the overflow menu. */
  children: ReactNode
  /** Short explanation shown above the buttons. */
  hint?: string
  /**
   * `stretch` makes every child share the width (primary flow).
   * `split` keeps natural widths and pushes them apart.
   */
  align?: 'stretch' | 'split'
  /** Default `true`. */
  elevated?: boolean
}

/**
 * Fixed bottom action bar. Reserves the home-indicator safe area.
 *
 * Pages that use it must add `MOBILE_ACTION_BAR_SPACE` to their bottom padding
 * so the bar never covers content.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileActionBar({
  children,
  hint,
  align = 'stretch',
  elevated = true,
}: MobileActionBarProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        boxSizing: 'border-box',
        minHeight: MOBILE_ACTION_BAR_H,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        px: 2,
        pt: 1.25,
        pb: `calc(${space.md}px + ${MOBILE_SAFE_BOTTOM})`,
        bgcolor: color.paper,
        borderTop: `1px solid ${color.border}`,
        boxShadow: elevated ? shadow.raised : 'none',
      }}
    >
      {hint && (
        <Typography sx={{ fontSize: 12, lineHeight: 1.35, color: color.muted }}>
          {hint}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          ...(align === 'split' ? { justifyContent: 'space-between' } : null),
          '& > *': align === 'stretch' ? { flex: 1, minWidth: 0 } : { flexShrink: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
