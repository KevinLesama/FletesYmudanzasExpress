import { alpha, Box, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { color } from '../design/tokens'
import { ars } from '../format'
import type { PaymentSummary } from '../types'

// pendiente de reincorporar
interface PagosResumenProps {
  trips: PaymentSummary[]
  timezone: string
}

function monthLabel(timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: timezone }).format(new Date())
}

function SummaryCard({
  title,
  value,
  detail,
  children,
}: {
  title: string
  value: string
  detail?: string
  children?: ReactNode
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 2,
        border: `1px solid ${color.border}`,
        borderRadius: 3,
        bgcolor: color.paper,
      }}
    >
      <Typography sx={{ fontSize: 12.5, color: color.muted, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ mt: 0.6, fontSize: 22, lineHeight: 1.15, fontWeight: 800, color: value === '—' ? color.muted : color.navy }}>
        {value}
      </Typography>
      {detail && <Typography sx={{ mt: 0.6, fontSize: 12, color: color.muted }}>{detail}</Typography>}
      {children}
    </Box>
  )
}

export function PagosResumen({ trips, timezone }: PagosResumenProps) {
  const pendingBalance = trips.reduce((total, trip) => total + Math.max(trip.balance, 0), 0)
  const month = monthLabel(timezone)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        gap: 1.5,
        mb: 2.5,
      }}
    >
      <SummaryCard
        title={`Cobrado en ${month}`}
        value="—"
        detail="Falta la fecha individual de cada cobro."
      />
      <SummaryCard
        title="Saldo pendiente"
        value={trips.length > 0 ? ars(pendingBalance) : '—'}
        detail={trips.length === 0 ? 'Sin viajes con cobros.' : undefined}
      />
      <SummaryCard
        title="En manos de choferes"
        value="—"
        detail="Faltan datos de recibido por chofer y rendición."
      >
        <Stack
          sx={{
            mt: 1.4,
            p: 1,
            borderRadius: 1.5,
            bgcolor: alpha(color.sand, 0.7),
          }}
        >
          <Typography sx={{ fontSize: 11.5, color: color.muted }}>
            No se puede listar choferes sin esos campos.
          </Typography>
        </Stack>
      </SummaryCard>
    </Box>
  )
}
