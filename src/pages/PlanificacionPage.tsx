import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  TextField,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  ArrowBack,
  Check,
  CheckCircle,
  InfoOutlined,
  Lock,
  LocalShipping,
  MyLocation,
  LocationOn,
  Notes,
  Person,
  Phone,
  ReceiptLong,
  Save,
  Schedule,
  WarningAmber,
  Close,
  Paid,
  BugReport,
  Block,
  Undo,
} from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { StatusChip } from '../components/StatusChip'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { R, useQuery } from '../routes'
import { DRIVERS, VEHICLES, driverById, vehicleById, hasConflict, getRequest } from '../mockData'
import { ars, fmtDate, fmtDateEs, dayName, waLink } from '../format'
import type { ReceivedBy, ShiftRequest } from '../types'
import { brand } from '../theme'

interface SectionCardProps {
  title: string
  icon?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}

function SectionCard({ title, icon, right, children }: SectionCardProps) {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        {icon && <Box sx={{ color: brand.navy, display: 'flex' }}>{icon}</Box>}
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>{title}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {right}
      </Stack>
      {children}
    </Box>
  )
}

function RouteStop({
  place,
  kind,
  color,
}: {
  place: { label: string; address: string; barrio: string; floor: string; elevator: boolean }
  kind: 'origin' | 'destination'
  color: string
}) {
  return (
    <Stack direction="row" spacing={1.5}>
      <Box sx={{ pt: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, border: kind === 'destination' ? '2px solid #fff' : 'none', boxShadow: kind === 'destination' ? `0 0 0 2px ${color}` : 'none' }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#8A939E', letterSpacing: '0.08em' }}>{place.label.toUpperCase()}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, mt: 0.3 }}>{place.address}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>{place.barrio}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.3 }}>
          <Typography sx={{ fontSize: 12, color: '#8A939E' }}>{place.floor}</Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: 50, bgcolor: '#C4C9CE' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: place.elevator ? '#2F7D55' : '#8A939E' }}>
            {place.elevator ? 'Con ascensor' : 'Sin ascensor'}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

export function PlanificacionPage() {
  const query = useQuery()
  const id = (query.get('id') ?? 'FEX-1048').toUpperCase()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const request = getRequest(id)

  const [driverId, setDriverId] = useState('JA')
  const [vehicleId, setVehicleId] = useState('MOV-05')
  const [start, setStart] = useState('11:00')
  const [end, setEnd] = useState('13:00')
  const [price, setPrice] = useState(() => String(request?.price ?? 185000))
  const [depositRequired, setDepositRequired] = useState(() => String(Math.round((request?.price ?? 185000) * 0.5)))
  const [depositReceived, setDepositReceived] = useState(0)
  const [saved, setSaved] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const selectedDriver = driverById(driverId)
  const selectedVehicle = vehicleById(vehicleId)

  const conflict = hasConflict(driverId, [start, end], request?.id)
  const vehicleBusy = vehicleId === 'MOV-04' || vehicleId === 'MOV-01' || vehicleId === 'MOV-07'
  const depositOk = depositReceived >= Number(depositRequired || 0) && Number(depositRequired) > 0
  const canConfirm = depositOk && !conflict && !vehicleBusy && !!driverId && !!vehicleId

  const driverOption = (did: string) => {
    const d = driverById(did)!
    const busy = did === 'MR'
    return (
      <MenuItem value={did} disabled={busy} key={did}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Person sx={{ fontSize: 16, color: '#8A939E' }} />
          <span>{d.name}</span>
          {busy && <span style={{ fontSize: 12, color: '#9C493A' }}>· Ocupado 10:00-12:00</span>}
        </Stack>
      </MenuItem>
    )
  }

  const vehicleOption = (vid: string) => {
    const v = vehicleById(vid)!
    const note = v.status === 'En taller' ? '· En taller' : v.id === 'MOV-04' ? '· Ocupado 12:00-14:00' : v.id === 'MOV-01' ? '· Ocupado 10:00-12:00' : ''
    const disabled = v.status !== 'Disponible' || v.id !== 'MOV-05'
    return (
      <MenuItem value={vid} disabled={disabled} key={vid}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalShipping sx={{ fontSize: 16, color: '#8A939E' }} />
          <span>
            {v.id} · {v.type}
          </span>
          {note && <span style={{ fontSize: 12, color: '#9C493A' }}>{note}</span>}
        </Stack>
      </MenuItem>
    )
  }

  const requestId = request?.id ?? 'FEX-1048'
  const requestClient = request?.client ?? 'Lucía Benítez'
  const requestPhone = request?.phone ?? '11 4500-1287'
  const requestDate = request?.date ?? '2026-09-24'
  const requestArrival = request?.arrivalRange ?? (['09:00', '11:00'] as [string, string])
  const requestOrigin = request?.origin
  const requestDestination = request?.destination

  const wa = waLink(
    request?.phone ?? '11 3291-5140',
    `Hola ${requestClient}, te escribimos por tu viaje ${requestId} del ${fmtDateEs(requestDate)} · servicio ${(request?.serviceRange ?? ['11:00', '13:00']).join(' a ')}.`,
  )

  const planning = (
    <>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <SectionCard title="Precio acordado">
          <TextField
            size="small"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{ width: 170 }}
          />
        </SectionCard>
        <SectionCard title="Seña requerida">
          <TextField
            size="small"
            value={depositRequired}
            onChange={(e) => setDepositRequired(e.target.value.replace(/[^\d]/g, ''))}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{ width: 170 }}
          />
        </SectionCard>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Schedule sx={{ fontSize: 17, color: '#8A939E' }} />
        </Stack>
        <TextField size="small" type="time" label="Inicio estimado" value={start} onChange={(e) => setStart(e.target.value)} sx={{ flexGrow: 1 }} />
        <TextField size="small" type="time" label="Fin estimado" value={end} onChange={(e) => setEnd(e.target.value)} sx={{ flexGrow: 1 }} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Chofer</InputLabel>
          <Select label="Chofer" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {DRIVERS.map((d) => driverOption(d.id))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Vehículo</InputLabel>
          <Select label="Vehículo" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {VEHICLES.map((v) => vehicleOption(v.id))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={1} sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircle sx={{ fontSize: 16, color: '#2F7D55' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#2F7D55' }}>
            {selectedDriver?.name} — disponible para este horario
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalShipping sx={{ fontSize: 16, color: '#2F7D55' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#2F7D55' }}>
            {selectedVehicle?.id} · {selectedVehicle?.type} · {selectedVehicle?.capacityKg} kg — disponible
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5C6B7A', mb: 1 }}>Otras disponibilidades</Typography>
        <Stack spacing={0.8}>
          <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
            <WarningAmber sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.5, color: '#B9761F' }} />
            Marcelo Rodríguez · MOV-01 · ocupado 10:00-12:00 · FEX-1046
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
            <WarningAmber sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.5, color: '#B9761F' }} />
            MOV-04 · ocupado 12:00-14:00 · FEX-1047
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
            <BugReport sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.5, color: '#8A939E' }} />
            MOV-07 · en taller
          </Typography>
        </Stack>
      </Box>

      {(conflict || vehicleBusy) && (
        <Box sx={{ mt: 2, p: 1.4, borderRadius: 2, bgcolor: '#FFF3EF', border: '1px solid #F3DAD2', color: '#9C493A' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <InfoOutlined sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
              {conflict
                ? `Este chofer ya tiene un viaje entre las ${start} y las ${end}.`
                : 'El vehículo seleccionado no está disponible para este horario.'}
            </Typography>
          </Stack>
        </Box>
      )}
    </>
  )

  const summary = (
    <Box sx={{ bgcolor: '#FBF9F6', border: '1px solid #EDEAE3', borderRadius: 3, p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <ReceiptLong sx={{ fontSize: 17, color: brand.navy }} />
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Resumen de pago</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <StatusChip label={depositOk ? 'Seña registrada' : 'Pendiente de seña'} />
      </Stack>
      <Stack spacing={1}>
        <Row label="Total del viaje" value={ars(Number(price || 0))} strong />
        <Divider sx={{ borderColor: '#EDEAE3' }} />
        <Row label="Seña requerida" value={ars(Number(depositRequired || 0))} />
        <Row label="Seña recibida" value={ars(depositReceived)} />
        <Row label="Saldo pendiente" value={ars(Number(price || 0) - depositReceived)} strong />
      </Stack>
    </Box>
  )

  return (
    <>
      <AppShell
        active="solicitudes"
        breadcrumb={['Gestión', 'Solicitudes', 'Detalle y planificación']}
        kicker="Solicitud"
        title={`${requestId} · Detalle y planificación`}
        description={
          request
            ? `${dayName(requestDate)}, ${fmtDate(requestDate)} · Llegada ${requestArrival.join('-')}`
            : undefined
        }
        action={<StatusChip label={cancelled ? 'Cancelada' : confirmed ? 'Confirmada' : 'En planificación'} />}
      >
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
          <IconButton size="small" href={R.solicitudes} aria-label="Volver a solicitudes">
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
          <Button href={R.solicitudes} size="small" sx={{ color: '#5C6B7A' }}>
            Volver a solicitudes
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.95fr 1.05fr' }, gap: 2.5, alignItems: 'start' }}>
          <Stack spacing={2.5}>
            {request && (
              <SectionCard title="Cliente" icon={<Person sx={{ fontSize: 17 }} />} right={<Phone sx={{ fontSize: 16, color: '#8A939E' }} />}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{request.client}</Typography>
                <Typography sx={{ fontSize: 13, color: '#5C6B7A' }}>{request.phone}</Typography>
                <Button
                  component="a"
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  startIcon={<WhatsAppIcon />}
                  fullWidth
                  sx={{ mt: 1.4, color: '#1EBE5A', borderColor: '#7AE3A7', '&:hover': { borderColor: '#1EBE5A', bgcolor: '#F2FCF6' } }}
                >
                  Contactar por WhatsApp
                </Button>
                <Divider sx={{ my: 1.5, borderColor: '#EDEAE3' }} />
                <Stack direction="row" spacing={3}>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#8A939E' }}>SOLICITADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{fmtDate(request.date)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#8A939E' }}>LLEGADA ACORDADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{request.arrivalRange.join(' – ')}</Typography>
                  </Box>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Recorrido" icon={<LocationOn sx={{ fontSize: 17 }} />} right={<Typography sx={{ fontSize: 12, color: '#8A939E' }}>Buenos Aires</Typography>}>
              {requestOrigin && <RouteStop place={requestOrigin} kind="origin" color="#132B4A" />}
              <Box sx={{ my: 1.4, ml: 0.85, width: 1, height: 18, borderLeft: '2px dashed #D8D3C8' }} />
              {requestDestination && <RouteStop place={requestDestination} kind="destination" color="#F07855" />}
            </SectionCard>

            {request && (
              <SectionCard title="Carga y observaciones" icon={<Notes sx={{ fontSize: 17 }} />} right={
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, bgcolor: '#EEF2FA', color: '#526B8A', borderRadius: 999, px: 1.2, py: 0.3 }}>
                  ~{request.cargo.approxUnits} bultos
                </Typography>
              }>
                <Typography sx={{ fontSize: 13.5, color: '#33475F' }}>{request.cargo.items.map((i) => i.name).join(', ')}</Typography>
                <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 1 }}>
                  <InfoOutlined sx={{ fontSize: 14, color: '#B9761F' }} />
                  <Typography sx={{ fontSize: 12.5, color: '#98621B', fontWeight: 600 }}>
                    Objetos frágiles: {request.cargo.fragile ? 'sí' : 'no'}
                  </Typography>
                </Stack>
                <Box sx={{ mt: 1.4, p: 1.4, borderRadius: 2, bgcolor: '#F7F5F0', border: '1px solid #EDEAE3' }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#8A939E' }}>NOTA DEL CLIENTE</Typography>
                  <Typography sx={{ fontSize: 13, mt: 0.4 }}>{request.cargo.notes}</Typography>
                </Box>
              </SectionCard>
            )}
          </Stack>

          <Stack spacing={2.5}>
            <SectionCard title="Planificación" icon={<Schedule sx={{ fontSize: 17 }} />} right={<StatusChip label={saved ? 'Guardada' : 'Sin guardar'} />}>
              <Typography sx={{ fontSize: 12.5, color: '#8A939E', mb: 1.5 }}>
                Acordá precio, horario y asignación.
              </Typography>
              {planning}
            </SectionCard>

            {summary}

            {cancelled ? (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F1F2F4', border: '1px solid #E0E0E0', color: '#6F7780' }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Block sx={{ fontSize: 16, mt: 0.2 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                    Este viaje fue cancelado. La planificación quedó desactivada; podés reactivarlo si el cliente vuelve a confirmar.
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DFC0', color: '#98621B' }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Lock sx={{ fontSize: 16, mt: 0.2 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                    {depositOk
                      ? 'Confirmación habilitada: la seña está registrada y la asignación no tiene conflictos.'
                      : 'Confirmación bloqueada. Para confirmar el viaje, primero registrá la seña requerida y verificá que chofer y vehículo estén disponibles.'}
                  </Typography>
                </Stack>
              </Box>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<Save />}
                disabled={cancelled}
                sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }}
                onClick={() => {
                  setSaved(true)
                  setToast('Planificación tentativa guardada')
                }}
              >
                Guardar planificación tentativa
              </Button>
              <Button
                variant="outlined"
                startIcon={<Paid />}
                disabled={cancelled}
                sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }}
                onClick={() => setDialogOpen(true)}
              >
                Registrar seña
              </Button>
              <Button
                variant="outlined"
                startIcon={cancelled ? <Undo /> : <Block />}
                sx={
                  cancelled
                    ? { color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }
                    : { color: '#9C493A', borderColor: '#E5B8AD', bgcolor: '#FFF7F5', py: 1.1, '&:hover': { borderColor: '#9C493A', bgcolor: '#FFEFEB' } }
                }
                onClick={() => {
                  if (cancelled) {
                    setCancelled(false)
                    setToast('Viaje reactivado · ' + requestId)
                  } else {
                    setCancelOpen(true)
                  }
                }}
              >
                {cancelled ? 'Reactivar viaje' : 'Cancelar viaje'}
              </Button>
              <Button
                variant="contained"
                startIcon={<Check />}
                disabled={!canConfirm || cancelled}
                sx={{ py: 1.1 }}
                onClick={() => {
                  setConfirmed(true)
                  setToast('Viaje confirmado · FEX-' + requestId)
                }}
              >
                Confirmar viaje
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: '#8A939E', mt: 0.5 }}>
              Guardar la planificación no confirma el viaje. La seña se registra por separado.
            </Typography>
          </Stack>
        </Box>
      </AppShell>

      <DepositDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        requestId={requestId}
        client={requestClient}
        depositRequired={Number(depositRequired || 0)}
        price={Number(price || 0)}
        received={depositReceived}
        onSave={(amount) => {
          setDepositReceived((r) => r + amount)
          setDialogOpen(false)
          setToast(`Seña registrada · ${ars(amount)}`)
        }}
      />

      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelled(true)
          setCancelOpen(false)
          setToast('Viaje cancelado · ' + requestId)
        }}
        requestId={requestId}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)} sx={{ bgcolor: brand.navy }}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography sx={{ fontSize: 13.5, color: strong ? brand.navy : '#5C6B7A', fontWeight: strong ? 800 : 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 800 : 700, color: strong ? brand.navy : '#33475F' }}>
        {value}
      </Typography>
    </Stack>
  )
}

function CancelDialog({
  open,
  onClose,
  onConfirm,
  requestId,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  requestId: string
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#FFF3EF', color: '#9C493A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Block sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Cancelar viaje</Typography>
            <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>{requestId}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: 13.5, color: '#33475F' }}>
          ¿Estás seguro de cancelar el viaje {requestId}? El cliente dejará de verlo y se liberará la asignación de chofer y vehículo.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>
          Volver
        </Button>
        <Button variant="contained" startIcon={<Block />} sx={{ bgcolor: '#9C493A', '&:hover': { bgcolor: '#8A4236' } }} onClick={onConfirm}>
          Sí, cancelar viaje
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DepositDialog({
  open,
  onClose,
  requestId,
  client,
  depositRequired,
  price,
  received,
  onSave,
}: {
  open: boolean
  onClose: () => void
  requestId: string
  client: string
  depositRequired: number
  price: number
  received: number
  onSave: (amount: number) => void
}) {
  const [amount, setAmount] = useState(String(depositRequired || ''))
  const [date, setDate] = useState('2026-09-24')
  const [concept, setConcept] = useState('Seña')
  const [method, setMethod] = useState('Transferencia')
  const [receivedBy, setReceivedBy] = useState<ReceivedBy>('Administración')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const save = () => {
    const num = Number(amount || 0)
    const max = Math.max(price - received, depositRequired)
    if (num < depositRequired || num > max) {
      setError(`Ingresá un importe entre ${ars(depositRequired)} y ${ars(max)}.`)
      return
    }
    onSave(num)
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={isMobile} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: { xs: 2.5, md: 3 }, pt: { xs: 4, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: '#8A939E', fontWeight: 700 }}>{requestId} · {client}</Typography>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Registrar seña</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar"><Close fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, md: 3 }, pt: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DFC0', mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#98621B' }}>Seña requerida</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#98621B' }}>{ars(depositRequired)}</Typography>
          </Stack>
        </Box>

        <Stack spacing={2}>
          <TextField
            label="Importe recibido"
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
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>Concepto</InputLabel>
              <Select label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)}>
                <MenuItem value="Seña">Seña</MenuItem>
                <MenuItem value="Saldo">Saldo</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Medio</InputLabel>
              <Select label="Medio" value={method} onChange={(e) => setMethod(e.target.value)}>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Recibido por</InputLabel>
            <Select label="Recibido por" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value as ReceivedBy)}>
              <MenuItem value="Administración">Administración</MenuItem>
              <MenuItem value="Chofer">Chofer</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} size="small" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.5, md: 3 }, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Check />} onClick={save}>Guardar seña</Button>
      </DialogActions>
    </Dialog>
  )
}