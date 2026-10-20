import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
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
import { Add, Close, InfoOutlined, Paid, ReceiptLong, Search, WarningAmber } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { StatusChip } from '../components/StatusChip'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars, fmtDate } from '../format'
import { brand } from '../theme'
import type { Payment, PaymentConcept, PaymentMethod, PaymentSummary, ReceivedBy } from '../types'

export function PagosPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [date, setDate] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogTrip, setDialogTrip] = useState<PaymentSummary | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const summaryState = useAsync(() => api.paymentsSummary(), [])
  const trips: PaymentSummary[] = summaryState.data ?? []

  const rows = useMemo(() => {
    return trips.filter((r) => {
      if (date !== 'all' && r.date !== date) return false
      if (status !== 'all' && r.state !== status) return false
      const q = search.trim().toLowerCase()
      if (q && !r.client.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [trips, date, status, search])

  const registerPayment = async (trip: PaymentSummary, payment: Payment) => {
    setBusy(true)
    try {
      await api.addPayment(trip.id, payment)
      setDialogTrip(null)
      setToast(`Pago registrado · ${trip.id} · ${ars(payment.amount)}`)
      summaryState.reload()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No pudimos registrar el pago.')
    } finally {
      setBusy(false)
    }
  }

  const paymentGridDesktop = (
    <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, overflow: 'hidden' }}>
      <Table>
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
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Typography sx={{ fontWeight: 800, color: brand.navy }}>{r.id}</Typography>
                <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>{r.client}</Typography>
                <Typography sx={{ fontSize: 12, color: '#B8C0C9' }}>{fmtDate(r.date)}</Typography>
              </TableCell>
              <TableCell align="right">{ars(r.price)}</TableCell>
              <TableCell align="right">{ars(r.deposit)}</TableCell>
              <TableCell align="right">{ars(r.collected)}</TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 800, color: r.balance > 0 ? '#98621B' : brand.navy }}>{ars(r.balance)}</Typography>
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
    </Box>
  )

  const paymentGridMobile = (
    <Stack spacing={1.5}>
      {rows.map((r) => (
        <Box key={r.id} sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <ReceiptLong sx={{ fontSize: 16, color: '#8A939E' }} />
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: brand.navy }}>{r.id}</Typography>
            </Stack>
            <StatusChip label={r.state} />
          </Stack>
          <Typography sx={{ mt: 0.6, fontWeight: 700, fontSize: 14 }}>{r.client}</Typography>
          <Typography sx={{ fontSize: 12, color: '#8A939E' }}>{fmtDate(r.date)}</Typography>
          <Box sx={{ my: 1.4, p: 1.4, borderRadius: 2, bgcolor: '#F8F6F1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
            <Money label="Precio acordado" value={ars(r.price)} />
            <Money label="Seña recibida" value={ars(r.deposit)} />
            <Money label="Total cobrado" value={ars(r.collected)} />
            <Money label="Saldo pendiente" value={ars(r.balance)} strong />
          </Box>
          <Button fullWidth variant="outlined" size="small" startIcon={<Add />} onClick={() => setDialogTrip(r)} sx={{ color: brand.navy, borderColor: '#D9D4C9' }}>
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
        breadcrumb={['Operación', 'Pagos']}
        kicker="Control de cobros"
        title="Pagos"
        description="Registro manual · transferencias y efectivo"
        action={
          <Typography sx={{ fontSize: 12.5, color: '#8A939E', fontWeight: 600 }}>
            {rows.length} registros · importes en ARS
          </Typography>
        }
      >
        <Box sx={{ mb: 2.5, p: 1.6, borderRadius: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DFC0', color: '#98621B' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <WarningAmber sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              Que el cliente haya pagado al chofer no significa que el dinero ya se rindió a la empresa.
            </Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            bgcolor: '#FFFFFF',
            border: '1px solid #E9E6DF',
            borderRadius: 3,
            p: 2,
            mb: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            placeholder="Buscar por viaje o cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ fontSize: 17, color: '#8A939E', mr: 1 }} /> }}
          />
          <FormControl size="small">
            <InputLabel>Fecha</InputLabel>
            <Select label="Fecha" value={date} onChange={(e) => setDate(e.target.value)}>
              <MenuItem value="all">Todas las fechas</MenuItem>
              <MenuItem value="2026-09-24">24/09/2026</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Estado</InputLabel>
            <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="all">Todos los estados</MenuItem>
              <MenuItem value="Sin pagos">Sin pagos</MenuItem>
              <MenuItem value="Parcial">Parcial</MenuItem>
              <MenuItem value="Cobrado">Cobrado</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {summaryState.loading ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <LoadingState label="Cargando pagos..." />
          </Box>
        ) : summaryState.error ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <ErrorState message={summaryState.error} onRetry={summaryState.reload} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <EmptyState title="No encontramos viajes" subtext="Probá cambiar la búsqueda o los filtros." />
          </Box>
        ) : isMobile ? (
          paymentGridMobile
        ) : (
          paymentGridDesktop
        )}

        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mt: 2.5 }}>
          <InfoOutlined sx={{ fontSize: 15, color: '#8A939E', mt: 0.2 }} />
          <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
            El registro es manual: no se realiza verificación bancaria. Si el pago lo recibió el chofer, la rendición a la empresa se registra por separado.
          </Typography>
        </Stack>
      </AppShell>

      {dialogTrip && (
        <PaymentDialog
          trip={dialogTrip}
          onClose={() => setDialogTrip(null)}
          onSave={(payment) => registerPayment(dialogTrip, payment)}
          busy={busy}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3200} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert variant="filled" sx={{ bgcolor: brand.navy }} onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  )
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#8A939E', fontWeight: strong ? 800 : 600 }}>{label.toUpperCase()}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 800 : 700, color: strong ? brand.navy : '#33475F' }}>{value}</Typography>
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [concept, setConcept] = useState<PaymentConcept>('Saldo')
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
    onSave({ concept, method, receivedBy, amount: num, date, notes })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ px: 3, pt: { xs: 4, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 12, color: '#8A939E', fontWeight: 700 }}>{trip.id} · {trip.client}</Typography>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Registrar pago</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DFC0', mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#98621B' }}>Saldo pendiente</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#98621B' }}>{ars(saldo)}</Typography>
          </Stack>
        </Box>

        <Stack spacing={2}>
          <TextField
            label="Importe"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ''))
              setError(null)
            }}
            fullWidth
            error={!!error}
            helperText={error}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <TextField label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth size="small" />
          <FormControl size="small" fullWidth>
            <InputLabel>Concepto</InputLabel>
            <Select label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value as PaymentConcept)}>
              <MenuItem value="Seña">Seña</MenuItem>
              <MenuItem value="Saldo">Saldo</MenuItem>
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>Medio</InputLabel>
              <Select label="Medio" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Recibido por</InputLabel>
              <Select label="Recibido por" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value as ReceivedBy)}>
                <MenuItem value="Administración">Administración</MenuItem>
                <MenuItem value="Chofer">Chofer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} size="small" />
        </Stack>

        <Typography sx={{ mt: 1.5, fontSize: 11.5, color: '#8A939E' }}>
          Registro manual. No se realiza verificación bancaria.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Add />} disabled={busy} onClick={save}>{busy ? 'Guardando...' : 'Guardar pago'}</Button>
      </DialogActions>
    </Dialog>
  )
}