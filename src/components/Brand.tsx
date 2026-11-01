import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { LocalShipping } from '@mui/icons-material'
import { space } from '../design/tokens'
import { brand } from '../theme'

type Surface = 'light' | 'dark'
type Size = 'default' | 'login'

/**
 * The brand block carries a navy tile on every surface, so the wordmark needs
 * to know which ink reads on the surface it sits on: navy on a light one,
 * white on a dark one.
 */
export function Brand({
  subtitle = 'Administración',
  surface = 'light',
  size = 'default',
}: {
  subtitle?: string
  surface?: Surface
  size?: Size
}) {
  const onDark = surface === 'dark'
  const isLogin = size === 'login'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: isLogin ? `${space.md}px` : 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: isLogin ? 40 : 42,
          height: isLogin ? 40 : 42,
          borderRadius: isLogin ? '11px' : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          bgcolor: isLogin ? 'primary.main' : brand.navy,
          color: isLogin ? 'primary.contrastText' : '#FFFFFF',
          boxShadow: onDark ? 'none' : '0 4px 10px rgba(19,43,74,0.25)',
        }}
      >
        <LocalShipping fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, lineHeight: isLogin ? '40px' : 1.1 }}>
        <Typography
          component="div"
          variant={isLogin ? 'h5' : undefined}
          sx={{
            fontFamily: isLogin ? undefined : "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: isLogin ? 28 : 16,
            lineHeight: isLogin ? '40px' : undefined,
            color: isLogin ? 'text.primary' : onDark ? '#FFFFFF' : brand.navy,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Fletes Express
        </Typography>
        {subtitle && (
          <Typography
            component="div"
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: onDark ? 'rgba(255,255,255,0.72)' : '#64707C',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export function BrandBanner({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
