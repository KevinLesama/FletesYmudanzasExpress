import type { ReactNode } from 'react'
import { Button, Stack } from '@mui/material'
import { color } from '../../design/tokens'
import { MobileBottomSheet } from './MobileBottomSheet'

export interface MobileFilterSheetProps {
  open: boolean
  onClose: () => void
  /** Resets every filter to its default value. */
  onClear: () => void
  /** Drives the header subtitle. */
  activeCount: number
  /** Label of the confirm button. Default "Ver resultados". */
  resultLabel?: string
  children: ReactNode
}

/**
 * Filter sheet shared by the mobile listings.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileFilterSheet({
  open,
  onClose,
  onClear,
  activeCount,
  resultLabel = 'Ver resultados',
  children,
}: MobileFilterSheetProps) {
  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Filtros"
      description={
        activeCount > 0
          ? `${activeCount} ${activeCount === 1 ? 'filtro activo' : 'filtros activos'}`
          : 'Sin filtros activos'
      }
      actions={
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            onClick={onClear}
            disabled={activeCount === 0}
            sx={{ minHeight: 48, px: 1.5, flexShrink: 0, color: color.ink }}
          >
            Limpiar
          </Button>
          <Button variant="contained" fullWidth onClick={onClose} sx={{ minHeight: 48 }}>
            {resultLabel}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>{children}</Stack>
    </MobileBottomSheet>
  )
}
