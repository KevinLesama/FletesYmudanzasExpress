import type { ReactNode } from 'react'
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { Close } from '@mui/icons-material'
import { color, radius, shadow, space } from '../../design/tokens'
import { MOBILE_SAFE_BOTTOM } from './mobileSx'

export interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  /** Pinned footer, e.g. "Limpiar" + "Ver resultados". */
  actions?: ReactNode
  /** Default `85dvh`. */
  maxHeight?: string
}

/**
 * Base bottom sheet for mobile dialogs (filters, month picker, quick actions).
 *
 * Mobile-only: render it inside an `isMobile` branch. Content scrolls inside the
 * sheet so the page behind never scrolls horizontally.
 */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  maxHeight = '85dvh',
}: MobileBottomSheetProps) {
  const hasHeader = Boolean(title || description)

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          maxHeight,
          border: 'none',
          borderTop: `1px solid ${color.border}`,
          borderTopLeftRadius: `${radius.xl}px`,
          borderTopRightRadius: `${radius.xl}px`,
          bgcolor: color.paper,
          backgroundImage: 'none',
          boxShadow: shadow.raised,
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'inherit' }}>
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 4,
            borderRadius: '999px',
            bgcolor: color.border,
            mx: 'auto',
            mt: 1,
            mb: 0.5,
            flexShrink: 0,
          }}
        />

        {hasHeader && (
          <Stack
            direction="row"
            alignItems="flex-start"
            spacing={1}
            sx={{ px: 2.5, pt: 0.5, pb: 1.5, flexShrink: 0 }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {title && (
                <Typography component="h2" sx={{ fontSize: 16, fontWeight: 800, color: color.navy }}>
                  {title}
                </Typography>
              )}
              {description && (
                <Typography sx={{ fontSize: 12.5, color: color.muted, mt: 0.25 }}>
                  {description}
                </Typography>
              )}
            </Box>
            <IconButton
              aria-label="Cerrar"
              onClick={onClose}
              sx={{ width: 44, height: 44, mt: -0.5, mr: -1, flexShrink: 0 }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        )}

        <Box sx={{ px: 2.5, pb: 2, minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>{children}</Box>

        {actions && (
          <Box
            sx={{
              px: 2.5,
              pt: 1.5,
              pb: `calc(${space.lg}px + ${MOBILE_SAFE_BOTTOM})`,
              borderTop: `1px solid ${color.border}`,
              bgcolor: color.paper,
              flexShrink: 0,
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
