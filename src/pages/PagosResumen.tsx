import { useMemo, useState } from 'react'
import { alpha, Box, Button, Popover, Stack, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { color } from '../design/tokens'
import { ars } from '../format'
import type { PaymentConcept, PaymentSummary } from '../types'

// pendiente de reincorporar
interface PagosResumenProps {
  globalTrips: PaymentSummary[]
  filteredTrips: PaymentSummary[]
  timezone: string
}

type SummaryPayment = {
  amount: number
  concept: PaymentConcept
  date: string
  receivedByRole: 'administrador' | 'chofer' | 'cliente'
  receivedByName: string
  rendido: boolean | null
}

type CancellationTrip = PaymentSummary & {
  payments?: SummaryPayment[]
  requestStatus?: string
  driverCost?: number
  cancelledBy?: 'cliente' | 'empresa'
  depositReturned?: boolean
  cancellationDate?: string
  depositReturnedDate?: string
}

function cancellationTrip(trip: PaymentSummary): CancellationTrip {
  return trip as CancellationTrip
}

function tripStatus(trip: PaymentSummary): string {
  return String(cancellationTrip(trip).requestStatus ?? '')
}

function isFinalized(trip: PaymentSummary): boolean {
  return ['finalizada', 'Finalizada'].includes(tripStatus(trip))
}

function isCancelled(trip: PaymentSummary): boolean {
  return ['cancelada', 'Cancelada'].includes(tripStatus(trip))
}

function tripPayments(trip: PaymentSummary): SummaryPayment[] {
  return cancellationTrip(trip).payments ?? []
}

function depositCollected(trip: PaymentSummary): number {
  return tripPayments(trip)
    .filter((payment) => payment.concept === 'Seña')
    .reduce((total, payment) => total + payment.amount, 0)
}

function returnedDepositDate(trip: PaymentSummary): string | undefined {
  const data = cancellationTrip(trip)
  return data.depositReturnedDate ?? data.cancellationDate
}

function monthParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    timeZone: timezone,
  }).formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  }
}

function monthKey(date: string): string {
  return date.slice(0, 7)
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

function paymentRows(trips: PaymentSummary[]): SummaryPayment[] {
  return trips.flatMap((trip) => tripPayments(trip))
}

export function PagosResumen({ globalTrips, filteredTrips, timezone }: PagosResumenProps) {
  const [driversAnchor, setDriversAnchor] = useState<HTMLButtonElement | null>(null)
  const current = monthParts(new Date(), timezone)
  const previousDate = new Date(Date.UTC(current.year, current.month - 2, 1))
  const previous = monthParts(previousDate, 'UTC')
  const currentKey = `${current.year}-${String(current.month).padStart(2, '0')}`
  const previousKey = `${previous.year}-${String(previous.month).padStart(2, '0')}`
  const allPayments = useMemo(() => paymentRows(globalTrips), [globalTrips])
  const returnedDeposits = globalTrips.filter((trip) => cancellationTrip(trip).depositReturned === true)
  const returnedAmountFor = (trip: PaymentSummary) => {
    const data = cancellationTrip(trip)
    return data.depositReturned === true ? depositCollected(trip) : 0
  }
  const netPaymentTotal = (key: string) =>
    allPayments
      .filter((payment) => monthKey(payment.date) === key)
      .reduce((total, payment) => total + payment.amount, 0) -
    returnedDeposits
      .filter((trip) => returnedDepositDate(trip) && monthKey(returnedDepositDate(trip) as string) === key)
      .reduce((total, trip) => total + returnedAmountFor(trip), 0)
  const currentMonthTotal = netPaymentTotal(currentKey)
  const previousMonthTotal = netPaymentTotal(previousKey)
  const currentSettledTotal = allPayments
    .filter((payment) => payment.concept === 'Saldo' && monthKey(payment.date) === currentKey)
    .reduce((total, payment) => total + payment.amount, 0) -
    returnedDeposits
      .filter((trip) => returnedDepositDate(trip) && monthKey(returnedDepositDate(trip) as string) === currentKey)
      .reduce((total, trip) => total + returnedAmountFor(trip), 0)
  const variation =
    previousMonthTotal > 0
      ? `${currentMonthTotal >= previousMonthTotal ? '+' : ''}${Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100)} % vs. ${new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(previousDate)}`
      : undefined
  const pendingBalance = filteredTrips.reduce((total, trip) => total + Math.max(trip.balance, 0), 0)
  const hasRenditionData = allPayments.some((payment) => payment.rendido !== null)
  const driverPayments = hasRenditionData
    ? allPayments.filter((payment) => payment.receivedByRole === 'chofer' && payment.rendido === false)
    : []
  const driverTotals = Array.from(
    driverPayments.reduce((totals, payment) => {
      totals.set(payment.receivedByName, (totals.get(payment.receivedByName) ?? 0) + payment.amount)
      return totals
    }, new Map<string, number>()),
  )
    .sort(([, amountA], [, amountB]) => amountB - amountA)
    .map(([name, amount]) => ({ name, amount }))
  const totalCollected = globalTrips.reduce((total, trip) => total + trip.collected, 0)
  const currentMonth = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: timezone }).format(new Date())
  const currentTrips = globalTrips.filter((trip) => monthKey(trip.date) === currentKey)
  const finalizedTrips = currentTrips.filter(isFinalized)
  const clientCancelledTrips = currentTrips.filter((trip) => isCancelled(trip) && cancellationTrip(trip).cancelledBy === 'cliente')
  const previousCancelledWithoutActor = globalTrips.filter(
    (trip) => isCancelled(trip) && !cancellationTrip(trip).cancelledBy,
  ).length
  const hasCancellationData = globalTrips.some((trip) => tripStatus(trip) || cancellationTrip(trip).cancelledBy)
  const gain = hasCancellationData
    ? finalizedTrips.reduce((total, trip) => total + trip.price - (cancellationTrip(trip).driverCost ?? 0), 0) +
      clientCancelledTrips.reduce((total, trip) => total + depositCollected(trip), 0)
    : null
  const confirmedProjection = currentTrips
    .filter((trip) => tripStatus(trip) === 'confirmada' || tripStatus(trip) === 'Confirmada')
    .reduce((total, trip) => total + trip.price - (cancellationTrip(trip).driverCost ?? 0), 0)
  const gainDetail = hasCancellationData
    ? `${finalizedTrips.length} finalizados · ${clientCancelledTrips.length} cancelados por cliente`
    : 'Faltan estado, costo del chofer y cancelado_por en el resumen.'
  const returnedDateSource = returnedDeposits.some((trip) => cancellationTrip(trip).depositReturnedDate)
    ? 'fecha de devolución'
    : 'fecha de cancelación'

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
        title={`Ganancia de ${currentMonth}`}
        value={gain == null ? '—' : ars(gain)}
        detail={gainDetail}
      >
        {hasCancellationData && (
          <Tooltip title="Si cancela el cliente, la seña no se devuelve y cuenta como ganancia. Si cancela la empresa, se devuelve.">
            <Typography sx={{ mt: 0.8, fontSize: 11.5, color: color.muted, cursor: 'help' }}>
              Proyectada con confirmados: {ars(confirmedProjection)}
            </Typography>
          </Tooltip>
        )}
      </SummaryCard>
      <SummaryCard
        title={`Cobrado en ${new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(previousDate)}`}
        value={currentMonthTotal === 0 && previousMonthTotal === 0 ? '—' : ars(previousMonthTotal)}
        detail={variation}
      />
      <SummaryCard
        title={`Saldado en ${currentMonth}`}
        value={currentSettledTotal === 0 ? '—' : ars(currentSettledTotal)}
        detail={`Señas devueltas descontadas por ${returnedDateSource}.`}
      />
      <SummaryCard
        title="Saldo pendiente"
        value={filteredTrips.length > 0 ? ars(pendingBalance) : '—'}
        detail={filteredTrips.length === 0 ? 'Sin viajes con cobros.' : undefined}
      />
      {hasRenditionData ? (
        <SummaryCard title="En manos de choferes" value={driverPayments.length > 0 ? ars(driverPayments.reduce((total, payment) => total + payment.amount, 0)) : '—'}>
          {driverTotals.length > 0 && (
            <Stack spacing={0.35} sx={{ mt: 1.2 }}>
              {driverTotals.slice(0, 3).map((driver) => (
                <Stack key={driver.name} direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: color.muted }}>
                    {driver.name}
                  </Typography>
                  <Typography sx={{ flexShrink: 0, fontSize: 12, color: color.ink }}>{ars(driver.amount)}</Typography>
                </Stack>
              ))}
              {driverTotals.length > 3 && (
                <Button size="small" onClick={(event) => setDriversAnchor(event.currentTarget)} sx={{ alignSelf: 'flex-start', mt: 0.5, p: 0, minWidth: 0 }}>
                  Ver todos
                </Button>
              )}
            </Stack>
          )}
        </SummaryCard>
      ) : (
        <SummaryCard
          title="Total cobrado"
          value={totalCollected > 0 ? ars(totalCollected) : '—'}
          detail="Falta el campo de rendición para calcular cobros en manos de choferes."
        >
          <Box sx={{ mt: 1.2, p: 1, borderRadius: 1.5, bgcolor: alpha(color.sand, 0.7) }}>
            <Typography sx={{ fontSize: 11.5, color: color.muted }}>
              Se identifican receptor y rol, pero no si el cobro fue rendido.
            </Typography>
          </Box>
        </SummaryCard>
      )}
      {previousCancelledWithoutActor > 0 && (
        <Typography sx={{ gridColumn: '1 / -1', fontSize: 12, color: color.muted }}>
          {previousCancelledWithoutActor} cancelados anteriores no se cuentan como ganancia porque no tienen cancelado_por.
        </Typography>
      )}
      <Popover
        open={Boolean(driversAnchor)}
        anchorEl={driversAnchor}
        onClose={() => setDriversAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={0.5} sx={{ p: 2, minWidth: 240 }}>
          {driverTotals.map((driver) => (
            <Stack key={driver.name} direction="row" justifyContent="space-between" spacing={2}>
              <Typography sx={{ fontSize: 13 }}>{driver.name}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{ars(driver.amount)}</Typography>
            </Stack>
          ))}
        </Stack>
      </Popover>
    </Box>
  )
}
