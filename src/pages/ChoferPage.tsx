import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Check, ChevronLeft, ChevronRight, Close, Paid } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { StatusChip } from '../components/StatusChip'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { tripEarnings } from '../mockData'
import { DEMO_DATE, fmtLong } from '../format'
import { brand } from '../theme'
import type { PaymentConcept, PaymentMethod, ReceivedBy, ShiftRequest } from '../types'


function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function ChoferPage() {
  const [date, setDate] = useState(DEMO_DATE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // El chofer trabaja con su propia sesion: pide su perfil y solo sus viajes.
  const profileState = useAsync(async () => {
    const me = await api.me()
    return api.getUser(me.id)
  }, [])
  const tripsState = useAsync(() => api.listRequests(), [])
  const trips: ShiftRequest[] = tripsState.data ?? []
  const driver = profileState.data
  const vehicles = useAsync(() => api.listVehicles(), [])

  const dayTrips = useMemo(() => trips.filter((t) => t.date === date), [trips, date])
  const selected = trips.find((t) => t.id === selectedId) ?? null
  const selectedVehicleName = selected?.vehicleId
    ? `${selected.vehicleId} · ${(vehicles.data ?? []).find((v) => v.id === selected.vehicleId)?.type ?? ''}`
    : undefined

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await fn()
      await tripsState.reload()
      setToast(message)
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No pudimos completar la operación.')
    } finally {
      setBusy(false)
    }
  }

  const attachRemito = (paymentId: number, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      runAction(
        () => api.setPaymentRemito(paymentId, { name: file.name, dataUrl: String(reader.result) }),
        'Remito cargado',
      )
    }
    reader.readAsDataURL(file)
  }

  const detachRemito = (paymentId: number) => runAction(() => api.deletePaymentRemito(paymentId), 'Remito quitado')

  return (
    <>
      <ChoferShell
        active="viajes"
        breadcrumb={['Chofer', 'Agenda']}
        title="Agenda de viajes"
        description={fmtLong(date)}
        action={<StatusChip label={`${dayTrips.length} viajes`} />}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <IconButton size="small" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Button size="small" onClick={() => setDate(DEMO_DATE)} sx={{ fontSize: 12.5 }}>
            Hoy
          </Button>
          <IconButton size="small" onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente">
            <ChevronRight fontSize="small" />
          </IconButton>
          <Chip label={fmtLong(date)} sx={{ fontWeight: 700, bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', ml: 0.5 }} />
        </Stack>

        {tripsState.loading ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <LoadingState label="Cargando viajes..." />
          </Box>
        ) : tripsState.error ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <ErrorState message={tripsState.error} onRetry={tripsState.reload} />
          </Box>
        ) : dayTrips.length === 0 ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <EmptyState
              title="Sin viajes asignados para esta fecha"
              subtext="Cuando la administración te asigne un servicio en este día, va a aparecer acá."
            />
          </Box>
        ) : (
          <AgendaGrid trips={dayTrips} onOpenTrip={(t) => setSelectedId(t.id)} />
        )}
      </ChoferShell>

      {selected && (
        <TripDetailModal
          trip={selected}
          role="chofer"
          driverName={driver?.name}
          vehicleName={selectedVehicleName}
          onClose={() => setSelectedId(null)}
          earnings={driver ? tripEarnings(driver, selected.estimatedKm ?? 0, selected.estimatedHours ?? 0) : undefined}
          onAddPayment={() => setPaymentOpen(true)}
          onAttachRemito={attachRemito}
          onDetachRemito={detachRemito}
        />
      )}

      {selected && (
        <PaymentDialog
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          trip={selected}
          onSave={(payment, remito) => {
            setPaymentOpen(false)
            runAction(() => api.addPayment(selected.id, { ...payment, remito }), 'Cobro registrado')
          }}
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

function PaymentDialog({
  open,
  onClose,
  trip,
  onSave,
}: {
  open: boolean
  onClose: () => void
  trip: ShiftRequest
  onSave: (
    payment: {
      concept: PaymentConcept
      method: PaymentMethod
      receivedBy: ReceivedBy
      amount: number
      date: string
      notes?: string
    },
    remito?: { name: string; dataUrl: string },
  ) => void
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [concept, setConcept] = useState<PaymentConcept>('Saldo')
  const [method, setMethod] = useState<PaymentMethod>('Efectivo')
  const [notes, setNotes] = useState('')
  const [remito, setRemito] = useState<{ name: string; dataUrl: string } | undefined>()
  const [error, setError] = useState<string | null>(null)

  const pending = Math.max(trip.price - trip.depositReceived, 0)

  const onPickFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setRemito({ name: file.name, dataUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const save = () => {
    const num = Number(amount || 0)
    if (num <= 0) {
      setError('Ingresá el importe recibido.')
      return
    }
    onSave(
      { concept, method, receivedBy: 'Chofer', amount: num, date, notes: notes || undefined },
      remito,
    )
    setAmount('')
    setNotes('')
    setRemito(undefined)
    setError(null)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 17 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 17, fontFamily: "'Manrope', sans-serif", fontWeight: 800 }}>Registrar cobro</Typography>
            <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>{trip.id} · saldo pendiente {`$ ${pending.toLocaleString('es-AR')}`}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Importe recibido"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ''))
              setError(null)
            }}
            fullWidth
            size="small"
            error={!!error}
            helperText={error}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <TextField label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth size="small" />
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>Concepto</InputLabel>
              <Select label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value as PaymentConcept)}>
                <MenuItem value="Seña">Seña</MenuItem>
                <MenuItem value="Saldo">Saldo</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Medio</InputLabel>
              <Select label="Medio" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Cuenta corriente">Cuenta corriente</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} size="small" />
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.7 }}>Foto del remito</Typography>
            {remito ? (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ fontSize: 12.5, flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {remito.name}
                </Typography>
                <Button size="small" sx={{ color: '#9C493A', minWidth: 0 }} onClick={() => setRemito(undefined)}>
                  Quitar
                </Button>
              </Stack>
            ) : (
              <Button component="label" variant="outlined" size="small" sx={{ color: brand.navy, borderColor: '#D9D4C9' }}>
                Adjuntar foto
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onPickFile(f)
                    e.target.value = ''
                  }}
                />
              </Button>
            )}
            <Typography sx={{ fontSize: 11.5, color: '#8A939E', mt: 0.7 }}>
              En cobros en efectivo adjuntá la foto del remito firmado.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>
          Cancelar
        </Button>
        <Button variant="contained" startIcon={<Check />} onClick={save}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
