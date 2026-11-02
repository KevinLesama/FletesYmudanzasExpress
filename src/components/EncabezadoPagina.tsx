import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { brand } from '../theme'

interface EncabezadoPaginaProps {
  kicker?: string
  titulo?: ReactNode
  bajada?: ReactNode
  accion?: ReactNode
}

export function EncabezadoPagina({ kicker, titulo, bajada, accion }: EncabezadoPaginaProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      sx={{ mb: 2.5, minHeight: { xs: 76, md: 80 } }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {kicker && (
          <Typography
            sx={{ fontSize: 11, fontWeight: 800, color: brand.orangeInk, letterSpacing: '0.14em', mb: 0.5 }}
          >
            {kicker.toUpperCase()}
          </Typography>
        )}
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, md: 26 } }}>
          {titulo}
        </Typography>
        {bajada && <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>{bajada}</Typography>}
      </Box>
      {accion && <Box sx={{ flexShrink: 0 }}>{accion}</Box>}
    </Stack>
  )
}
