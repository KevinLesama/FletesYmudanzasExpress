import { IconButton, Stack, Typography } from '@mui/material'
import { ArrowBack, ArrowForward } from '@mui/icons-material'

interface TablePaginationFooterProps {
  page: number
  pageSize: number
  total: number
  /** Etiqueta en plural: "solicitudes", "choferes", "vehículos". */
  itemLabel: string
  onPageChange: (page: number) => void
}

/** Pie de paginación de los listados (mismo diseño en toda la app). */
export function TablePaginationFooter({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
}: TablePaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages - 1)
  const from = total === 0 ? 0 : current * pageSize + 1
  const to = Math.min(total, (current + 1) * pageSize)

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #EDEAE3', bgcolor: '#FBF9F6' }}
    >
      <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
        Mostrando {from}-{to} de {total} {itemLabel}
      </Typography>
      <Stack direction="row" spacing={1}>
        <IconButton
          size="small"
          disabled={current === 0}
          onClick={() => onPageChange(current - 1)}
          aria-label="Página anterior"
        >
          <ArrowBack sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          disabled={current >= totalPages - 1}
          onClick={() => onPageChange(current + 1)}
          aria-label="Página siguiente"
        >
          <ArrowForward sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>
    </Stack>
  )
}
