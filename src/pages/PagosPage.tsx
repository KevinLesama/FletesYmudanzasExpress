import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { Add, Close, InfoOutlined, Paid, ReceiptLong, Search } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { CampoSelect, CampoTexto, EtiquetaCampo } from '../components/FormFields'
import { StatusChip } from '../components/StatusChip'
import { TablePaginationFooter } from '../components/TablePaginationFooter'
import { Toast, type ToastState } from '../components/Toast'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { usePagedList } from '../usePagedList'
import { ars, fmtDate } from '../format'
import { getTodayISO } from '../agendaDates'
import { SEARCH_FIELD_SX, SEARCH_INPUT_PROPS } from '../searchField'
import { brand } from '../theme'
import { color } from '../design/tokens'
import type { Payment, PaymentMethod, PaymentSummary, ReceivedBy, ShiftRequest } from '../types'

const PAYMENTS_PAGE_SIZE = 10

function toPaymentSummary(request: ShiftRequest): PaymentSummary {
  const collected = (request.payments ?? []).reduce((total, payment) => total + payment.amount, 0)
  const state: PaymentSummary['state'] = collected >= request.price ? 'Cobrado' : 'Parcial'

  return {
    id: request.id,
    client: request.client,
    date: request.date,
    price: request.price,
    deposit: request.depositRequired,
    collected,
    balance: Math.max(request.price - collected, 0),
    state,
  }
}

export function PagosPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [date, setDate] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogTrip, setDialogTrip] = useState<PaymentSummary | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)

  const paymentsState = useAsync(async () => (await api.listRequests()).map(toPaymentSummary), [])
  const trips: PaymentSummary[] = paymentsState.data ?? []

  const paymentTrips = useMemo(() => trips.filter((r) => r.collected > 0), [trips])
  const availableStatuses = useMemo(
    () => new Set(paymentTrips.map((trip) => trip.state)),
    [paymentTrips],
  )

  useEffect(() => {
    if (status !== 'all' && !availableStatuses.has(status as PaymentSummary['state'])) {
      setStatus('all')
    }
  }, [availableStatuses, status])

  const rows = useMemo(() => {
    return paymentTrips.filter((r) => {
      if (date !== 'all' && r.date !== date) return false
      if (status !== 'all' && r.state !== status) return false
      const q = search.trim().toLowerCase()
      if (q && !r.client.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [paymentTrips, date, status, search])

  const pages = usePagedList(rows, PAYMENTS_PAGE_SIZE)

  const registerPayment = async (trip: PaymentSummary, payment: Payment) => {
    setBusy(true)
    try {
      await api.addPayment(trip.id, payment)
      setDialogTrip(null)
      setToast({ message: `Pago registrado · ${trip.id} · ${ars(payment.amount)}`, tone: 'success' })
      paymentsState.reload()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos registrar el pago.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const paymentGridDesktop = (
    <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3, overflow: 'hidden' }}>
      <Table sx={{ '& .MuiTableCell-root': { py: 1 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Viaje / cliente</TableCell>
            <TableCell align="right">Precio acordado</TableCell>
            <TableCell align="right">Seña recibida</TableCell>
            <TableCell align="right">Total cobrado</TableCell>
            <TableCell align="right">Saldo pendiente</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acción</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pages.pageItems.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Typography sx={{ fontWeight: 800, color: brand.navy }}>{r.id}</Typography>
                <Typography sx={{ fontSize: 12.5, color: color.muted }}>{r.client}</Typography>
                <Typography sx={{ fontSize: 12, color: color.muted }}>{fmtDate(r.date)}</Typography>
              </TableCell>
              <TableCell align="right">{ars(r.price)}</TableCell>
              <TableCell align="right">{ars(r.deposit)}</TableCell>
              <TableCell align="right">{ars(r.collected)}</TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 800, color: r.balance > 0 ? color.amberInk : brand.navy }}>{ars(r.balance)}</Typography>
              </TableCell>
              <TableCell><StatusChip label={r.state} /></TableCell>
              <TableCell align="right">
                <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => setDialogTrip(r)} sx={{ color: brand.navy }}>
                  Registrar pago
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePaginationFooter
        page={pages.page}
        pageSize={PAYMENTS_PAGE_SIZE}
        total={pages.total}
        itemLabel="registros"
        onPageChange={pages.setPage}
      />
    </Box>
  )

  const paymentGridMobile = (
    <Stack spacing={1.5}>
      {rows.map((r) => (
        <Box key={r.id} sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3, p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <ReceiptLong sx={{ fontSize: 16, color: color.muted }} />
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: brand.navy }}>{r.id}</Typography>
            </Stack>
            <StatusChip label={r.state} />
          </Stack>
          <Typography sx={{ mt: 0.6, fontWeight: 700, fontSize: 14 }}>{r.client}</Typography>
          <Typography sx={{ fontSize: 12, color: color.muted }}>{fmtDate(r.date)}</Typography>
          <Box sx={{ my: 1.4, p: 1.4, borderRadius: 2, bgcolor: color.sand, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
            <Money label="Precio acordado" value={ars(r.price)} />
            <Money label="Seña recibida" value={ars(r.deposit)} />
            <Money label="Total cobrado" value={ars(r.collected)} />
            <Money label="Saldo pendiente" value={ars(r.balance)} strong />
          </Box>
          <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setDialogTrip(r)} sx={{ color: brand.navy, borderColor: color.border }}>
            Registrar pago
          </Button>
        </Box>
      ))}
    </Stack>
  )

  return (
    <>
      <AppShell
        active="pagos"
        compacto
        breadcrumb={[SECCION_BREADCRUMB, 'Pagos']}
        kicker="Control de cobros"
        title="Pagos"
        description="Registro manual · transferencias y efectivo"
        action={
          <Typography sx={{ fontSize: 12.5, color: color.muted, fontWeight: 600 }}>
            {paymentTrips.length} viajes con cobros · importes en ARS
          </Typography>
        }
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, color: color.amberInk }}>
          <InfoOutlined sx={{ fontSize: 14, color: color.amberInk }} />
          <Typography sx={{ fontSize: 12, color: color.amberInk, fontWeight: 600 }}>
            Que el cliente haya pagado al chofer no significa que el dinero ya se rindió a la empresa.
          </Typography>
        </Stack>

        <Box
          sx={{
            bgcolor: color.paper,
            border: `1px solid ${color.border}`,
            borderRadius: 3,
            p: 1.25,
            mb: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(170px, 1fr) minmax(170px, 1fr)' },
            gap: 1.25,
            alignItems: 'center',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <EtiquetaCampo text="Buscar" htmlFor="pagos-search" />
            <TextField
              id="pagos-search"
              size="small"
              type="search"
              fullWidth
              placeholder="Buscar por viaje o cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ ...SEARCH_FIELD_SX, '& .MuiOutlinedInput-root': { height: 44 } }}
              inputProps={SEARCH_INPUT_PROPS}
              InputProps={{ startAdornment: <Search sx={{ fontSize: 17, color: 'text.secondary', mr: 1 }} /> }}
            />
          </Box>
          <CampoSelect
            label="Fecha"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { height: 44 } }}
          >
              <MenuItem value="all">Todas las fechas</MenuItem>
              <MenuItem value="2026-09-24">24/09/2026</MenuItem>
          </CampoSelect>
          <CampoSelect
            label="Estado"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { height: 44 } }}
          >
              <MenuItem value="all">Todos los estados</MenuItem>
              {availableStatuses.has('Parcial') && <MenuItem value="Parcial">Parcial</MenuItem>}
              {availableStatuses.has('Cobrado') && <MenuItem value="Cobrado">Pagado</MenuItem>}
          </CampoSelect>
        </Box>

        {paymentsState.loading ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3, px: 2, py: 1 }}>
            <Typography sx={{ fontSize: 13, color: color.muted }}>Cargando cobros...</Typography>
          </Box>
        ) : paymentsState.error ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3, px: 2, py: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Typography sx={{ fontSize: 13, color: color.red }}>No pudimos cargar los cobros</Typography>
              <Button size="small" onClick={paymentsState.reload} sx={{ color: brand.navy }}>Reintentar</Button>
            </Stack>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3 }}>
            <EmptyState
              title={search.trim() ? 'No encontramos viajes' : 'Todavía no hay pagos registrados.'}
              subtext={
                search.trim()
                  ? 'Probá cambiar la búsqueda o los filtros.'
                  : 'Las señas se registran desde la planificación de cada viaje.'
              }
            />
          </Box>
        ) : isMobile ? (
          paymentGridMobile
        ) : (
          paymentGridDesktop
        )}
      </AppShell>

      {dialogTrip && (
        <PaymentDialog
          trip={dialogTrip}
          onClose={() => setDialogTrip(null)}
          onSave={(payment) => registerPayment(dialogTrip, payment)}
          busy={busy}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: color.muted, fontWeight: strong ? 800 : 600 }}>{label.toUpperCase()}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 800 : 700, color: strong ? brand.navy : color.inkStrong }}>{value}</Typography>
    </Box>
  )
}

function PaymentDialog({
  trip,
  onClose,
  onSave,
  busy,
}: {
  trip: PaymentSummary
  onClose: () => void
  onSave: (payment: Payment) => void
  busy?: boolean
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const cobrado = trip.collected
  const saldo = Math.max(trip.price - cobrado, 0)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayISO)
  const [method, setMethod] = useState<PaymentMethod>('Transferencia')
  const [receivedBy, setReceivedBy] = useState<ReceivedBy>('Administración')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    const num = Number(amount || 0)
    if (!num || num <= 0 || num > saldo) {
      setError(`Ingresá un importe válido entre $ 1 y ${ars(saldo)}.`)
      return
    }
    setError(null)
    onSave({ concept: 'Saldo', method, receivedBy, amount: num, date, notes })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ px: 3, pt: { xs: 4, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: color.blueSoft, color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 12, color: color.muted, fontWeight: 700 }}>{trip.id} · {trip.client}</Typography>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Registrar pago</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color.amberSoft, border: `1px solid ${color.border}`, mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.amberInk }}>Saldo pendiente</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.amberInk }}>{ars(saldo)}</Typography>
          </Stack>
        </Box>

        <Stack spacing={2}>
          <CampoTexto
            label="Importe"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ''))
              setError(null)
            }}
            fullWidth
            error={!!error}
            mensaje={error}
            autoComplete="off"
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <CampoTexto label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth size="small" autoComplete="off" />
          <Stack direction="row" spacing={1.5}>
            <CampoSelect label="Medio" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} size="small">
              <MenuItem value="Transferencia">Transferencia</MenuItem>
              <MenuItem value="Efectivo">Efectivo</MenuItem>
            </CampoSelect>
            <CampoSelect label="Recibido por" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value as ReceivedBy)} size="small">
              <MenuItem value="Administración">Administración</MenuItem>
              <MenuItem value="Chofer">Chofer</MenuItem>
            </CampoSelect>
          </Stack>
          <CampoTexto label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} size="small" autoComplete="off" />
        </Stack>

        <Typography sx={{ mt: 1.5, fontSize: 12.5, color: color.muted }}>
          Registro manual. No se realiza verificación bancaria.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: color.ink }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Add />} disabled={busy} onClick={save}>{busy ? 'Guardando...' : 'Guardar pago'}</Button>
      </DialogActions>
    </Dialog>
  )
}