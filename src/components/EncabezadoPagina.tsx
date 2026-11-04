import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { brand } from '../theme'

interface EncabezadoPaginaProps {
  kicker?: string
  titulo?: ReactNode
  bajada?: ReactNode
  accion?: ReactNode
  /** Reduce el alto del encabezado en páginas que necesitan más espacio vertical. */
  compacto?: boolean
  /**
   * Mobile shows the section title in the fixed top bar, so the `h1` is kept
   * for screen readers only. Pages whose heading carries its own content (the
   * agenda greeting, for example) set this to keep it visible on mobile too.
   */
  tituloVisibleEnMobile?: boolean
  /**
   * Hides the lead paragraph on mobile when another block already shows the
   * same information (the fleet counters, for example).
   */
  bajadaVisibleEnMobile?: boolean
  /** Tightens the bottom margin only on mobile. */
  compactoEnMobile?: boolean
}

export function EncabezadoPagina({
  kicker,
  titulo,
  bajada,
  accion,
  compacto = false,
  tituloVisibleEnMobile = false,
  bajadaVisibleEnMobile = true,
  compactoEnMobile = false,
}: EncabezadoPaginaProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      sx={{
        mb: compactoEnMobile ? { xs: 1.5, md: compacto ? 1.5 : 2.5 } : compacto ? 1.5 : 2.5,
        minHeight: compacto ? undefined : { md: 80 },
      }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {kicker && (
          <Typography
            sx={{ fontSize: 11, fontWeight: 800, color: brand.orangeInk, letterSpacing: '0.14em', mb: 0.5 }}
          >
            {kicker.toUpperCase()}
          </Typography>
        )}
        {/*
          Mobile shows the title in the fixed top bar, so the page keeps the h1
          for screen readers only. Desktop renders it exactly as before.
          Pages that own their heading text (the agenda greeting) opt out.
        */}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: 22, md: 26 },
            ...(tituloVisibleEnMobile
              ? null
              : {
                  position: { xs: 'absolute', md: 'static' },
                  width: { xs: 1, md: 'auto' },
                  height: { xs: 1, md: 'auto' },
                  p: { xs: 0, md: undefined },
                  m: { xs: -1, md: 0 },
                  overflow: { xs: 'hidden', md: 'visible' },
                  clip: { xs: 'rect(0 0 0 0)', md: 'auto' },
                  whiteSpace: { xs: 'nowrap', md: 'normal' },
                  border: 0,
                }),
          }}
        >
          {titulo}
        </Typography>
        {bajada && (
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: 14,
              mt: 0.5,
              ...(!bajadaVisibleEnMobile && { display: { xs: 'none', md: 'block' } }),
            }}
          >
            {bajada}
          </Typography>
        )}
      </Box>
      {accion && <Box sx={{ flexShrink: 0 }}>{accion}</Box>}
    </Stack>
  )
}
