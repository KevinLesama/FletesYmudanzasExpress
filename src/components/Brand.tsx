import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { LocalShipping } from '@mui/icons-material'
import { brand } from '../theme'

type Surface = 'light' | 'dark'

/**
 * The brand block carries a navy tile on every surface, so the wordmark needs
 * to know which ink reads on the surface it sits on: navy on a light one,
 * white on a dark one.
 */
export function Brand({ subtitle = 'Administración', surface = 'light' }: { subtitle?: string; surface?: Surface }) {
  const onDark = surface === 'dark'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          bgcolor: brand.navy,
          color: '#FFFFFF',
          boxShadow: onDark ? 'none' : '0 4px 10px rgba(19,43,74,0.25)',
        }}
      >
        <LocalShipping fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
        <Typography
          component="div"
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            color: onDark ? '#FFFFFF' : brand.navy,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Fletes Express
        </Typography>
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
      </Box>
    </Box>
  )
}

export function BrandBanner({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
