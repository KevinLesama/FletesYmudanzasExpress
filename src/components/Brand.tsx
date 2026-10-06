import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { LocalShipping } from '@mui/icons-material'
import { brand } from '../theme'

type Variant = 'dark' | 'light'

export function Brand({ subtitle = 'Administración', variant = 'dark' }: { subtitle?: string; variant?: Variant }) {
  const dark = variant === 'dark'
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
          bgcolor: dark ? brand.navy : brand.cream,
          color: dark ? '#FFFFFF' : brand.navy,
          boxShadow: dark ? '0 4px 10px rgba(19,43,74,0.25)' : 'none',
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
            color: dark ? '#FFFFFF' : brand.navy,
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
            color: dark ? 'rgba(255,255,255,0.6)' : '#8A939E',
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