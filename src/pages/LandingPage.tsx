import { useState } from 'react'
import {
  ArrowForward,
  CalendarMonth,
  CheckCircleOutline,
  LocalShipping,
  LockOutlined,
  LocationOn,
  Logout,
  Route,
} from '@mui/icons-material'
import { Alert, Box, Button, Chip, Divider, IconButton, Stack, TextField, Typography } from '@mui/material'
import { api } from '../api'
import { Toast, type ToastState } from '../components/Toast'
import { color } from '../design/tokens'
import { brand } from '../theme'
import type { Client } from '../types'

type LandingStep = 'login' | 'request' | 'sent'

type LoginFormProps = Readonly<{
  name: string
  phone: string
  busy: boolean
  setName: (value: string) => void
  setPhone: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}>

type RequestFormProps = Readonly<{
  date: string
  arrivalFrom: string
  arrivalTo: string
  origin: string
  destination: string
  cargo: string
  notes: string
  busy: boolean
  setDate: (value: string) => void
  setArrivalFrom: (value: string) => void
  setArrivalTo: (value: string) => void
  setOrigin: (value: string) => void
  setDestination: (value: string) => void
  setCargo: (value: string) => void
  setNotes: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}>

const today = new Date().toISOString().slice(0, 10)

export function LandingPage() {
  const [step, setStep] = useState<LandingStep>('login')
  const [client, setClient] = useState<Client | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(today)
  const [arrivalFrom, setArrivalFrom] = useState('09:00')
  const [arrivalTo, setArrivalTo] = useState('11:00')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [cargo, setCargo] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const loggedClient = await api.loginClient({ name: name.trim(), phone: phone.trim() })
      setClient(loggedClient)
      setStep('request')
      setToast(null)
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'No pudimos validar tus datos.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    try {
      await api.createRequest({
        client_id: client.id,
        date,
        arrival_from: arrivalFrom,
        arrival_to: arrivalTo,
        service_from: arrivalFrom,
        service_to: arrivalTo,
        origin: { address: origin, barrio: '', floor: '', elevator: false },
        destination: { address: destination, barrio: '', floor: '', elevator: false },
        cargo: { items: [], approx_units: 0, fragile: false, notes: cargo + (notes ? ` · ${notes}` : '') },
      })
      setStep('sent')
      setToast({ message: 'Solicitud enviada correctamente.', tone: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'No pudimos enviar la solicitud.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    setClient(null)
    setStep('login')
    setToast(null)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.cream, color: brand.navy }}>
      <Box component="header" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, py: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: brand.navy, color: '#fff', display: 'grid', placeItems: 'center' }}>
              <LocalShipping sx={{ fontSize: 21 }} />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, lineHeight: 1 }}>Fletes Express</Typography>
              <Typography sx={{ color: brand.muted, fontSize: 12.5, mt: 0.4 }}>Tu mudanza, bien coordinada</Typography>
            </Box>
          </Stack>
          {client && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip label={client.name} size="small" sx={{ bgcolor: '#fff', border: `1px solid ${brand.border}`, fontWeight: 700 }} />
              <IconButton aria-label="Cerrar sesión" onClick={logout} size="small" sx={{ color: brand.navy }}>
                <Logout fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </Stack>
      </Box>

      <Box component="main" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, pb: { xs: 5, md: 9 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' }, gap: { xs: 4, md: 8 }, alignItems: 'center', pt: { xs: 4, md: 8 } }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 30, height: 2, bgcolor: brand.orange }} />
              <Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em' }}>FLETES SIN VUELTAS</Typography>
            </Stack>
            <Typography component="h1" sx={{ mt: 1.8, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: { xs: 38, md: 58 }, lineHeight: 1.02, letterSpacing: '-0.04em', maxWidth: 620 }}>
              Mové lo que necesitás, con todo claro desde el inicio.
            </Typography>
            <Typography sx={{ mt: 2.2, color: color.ink, fontSize: { xs: 16, md: 18 }, lineHeight: 1.55, maxWidth: 540 }}>
              Indicá tu recorrido y coordinamos el servicio con vos. Tu solicitud queda registrada para que el equipo pueda confirmar disponibilidad y condiciones.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.2} sx={{ mt: 4 }}>
              <Benefit icon={<Route />} text="Origen y destino en un solo paso" />
              <Benefit icon={<CheckCircleOutline />} text="Seguimiento de tu solicitud" />
            </Stack>
          </Box>

          <Box sx={{ bgcolor: '#fff', border: `1px solid ${brand.border}`, borderRadius: 4, p: { xs: 2.5, md: 4 }, boxShadow: '0 12px 30px rgba(19,43,74,0.06)' }}>
            {step === 'login' && <LoginForm name={name} phone={phone} busy={busy} setName={setName} setPhone={setPhone} onSubmit={login} />}
            {step === 'request' && <RequestForm date={date} arrivalFrom={arrivalFrom} arrivalTo={arrivalTo} origin={origin} destination={destination} cargo={cargo} notes={notes} busy={busy} setDate={setDate} setArrivalFrom={setArrivalFrom} setArrivalTo={setArrivalTo} setOrigin={setOrigin} setDestination={setDestination} setCargo={setCargo} setNotes={setNotes} onSubmit={submitRequest} />}
            {step === 'sent' && <SuccessState client={client} onNewRequest={() => setStep('request')} />}
          </Box>
        </Box>

        <Divider sx={{ my: { xs: 6, md: 10 }, borderColor: brand.border }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 3, md: 8 }} justifyContent="center">
          <Feature icon={<LockOutlined />} title="Acceso de cliente" text="Tus datos ya están registrados y no necesitás volver a cargarlos." />
          <Feature icon={<CalendarMonth />} title="Coordinación simple" text="Elegí el día y una franja horaria para que podamos organizar el servicio." />
          <Feature icon={<LocalShipping />} title="Equipo preparado" text="Revisamos cada pedido antes de confirmar el viaje." />
        </Stack>
      </Box>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </Box>
  )
}

function LoginForm({ name, phone, busy, setName, setPhone, onSubmit }: LoginFormProps) {
  return <Box component="form" onSubmit={onSubmit}>
    <Typography variant="h5">Ingresá para solicitar tu flete</Typography>
    <Typography sx={{ mt: 0.8, color: brand.muted, fontSize: 14 }}>Usamos los datos de tu cuenta para asociar la solicitud.</Typography>
    <Stack spacing={2} sx={{ mt: 3 }}>
      <TextField label="Nombre y apellido" value={name} onChange={(event) => setName(event.target.value)} required fullWidth />
      <TextField label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} required fullWidth placeholder="11 5555-0000" />
      <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={<ArrowForward />} sx={{ minHeight: 48, mt: 1 }}>
        {busy ? 'Validando...' : 'Continuar'}
      </Button>
    </Stack>
  </Box>
}

function RequestForm({ date, arrivalFrom, arrivalTo, origin, destination, cargo, notes, busy, setDate, setArrivalFrom, setArrivalTo, setOrigin, setDestination, setCargo, setNotes, onSubmit }: RequestFormProps) {
  return <Box component="form" onSubmit={onSubmit}>
    <Typography variant="h5">¿Qué necesitás trasladar?</Typography>
    <Typography sx={{ mt: 0.8, color: brand.muted, fontSize: 14 }}>Completá los datos del servicio y enviá tu pedido.</Typography>
    <Stack spacing={2} sx={{ mt: 3 }}>
      <TextField label="Día del servicio" type="date" value={date} onChange={(event) => setDate(event.target.value)} required InputLabelProps={{ shrink: true }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField label="Desde las" type="time" value={arrivalFrom} onChange={(event) => setArrivalFrom(event.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
        <TextField label="Hasta las" type="time" value={arrivalTo} onChange={(event) => setArrivalTo(event.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
      </Stack>
      <TextField label="¿Desde dónde retiramos?" value={origin} onChange={(event) => setOrigin(event.target.value)} required fullWidth InputProps={{ startAdornment: <LocationOn sx={{ color: brand.orangeInk, mr: 1 }} /> }} />
      <TextField label="¿A dónde lo llevamos?" value={destination} onChange={(event) => setDestination(event.target.value)} required fullWidth InputProps={{ startAdornment: <LocationOn sx={{ color: brand.navy, mr: 1 }} /> }} />
      <TextField label="¿Qué hay que trasladar?" value={cargo} onChange={(event) => setCargo(event.target.value)} required multiline minRows={2} fullWidth />
      <TextField label="Observaciones (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} fullWidth />
      <Button type="submit" variant="contained" size="large" disabled={busy} endIcon={<ArrowForward />} sx={{ minHeight: 48, mt: 1 }}>
        {busy ? 'Enviando...' : 'Enviar solicitud'}
      </Button>
    </Stack>
  </Box>
}

function SuccessState({ client, onNewRequest }: Readonly<{ client: Client | null; onNewRequest: () => void }>) {
  return <Stack spacing={2} alignItems="flex-start">
    <CheckCircleOutline sx={{ color: color.green, fontSize: 42 }} />
    <Typography variant="h5">Ya recibimos tu solicitud{client ? `, ${client.name.split(' ')[0]}` : ''}.</Typography>
    <Typography sx={{ color: color.ink, lineHeight: 1.6 }}>El equipo va a revisar disponibilidad y se va a poner en contacto para confirmar los detalles del servicio.</Typography>
    <Alert severity="success" sx={{ width: '100%' }}>No se generó ningún pago en este paso.</Alert>
    <Button variant="outlined" onClick={onNewRequest} endIcon={<ArrowForward />}>Solicitar otro flete</Button>
  </Stack>
}

function Benefit({ icon, text }: Readonly<{ icon: React.ReactNode; text: string }>) {
  return <Stack direction="row" alignItems="center" spacing={1} sx={{ color: color.ink }}><Box sx={{ color: brand.orangeInk, display: 'grid', placeItems: 'center' }}>{icon}</Box><Typography sx={{ fontSize: 13.5 }}>{text}</Typography></Stack>
}

function Feature({ icon, title, text }: Readonly<{ icon: React.ReactNode; title: string; text: string }>) {
  return <Stack direction="row" spacing={1.5} sx={{ maxWidth: 300 }}><Box sx={{ width: 38, height: 38, border: `1px solid ${brand.border}`, borderRadius: 2, bgcolor: '#fff', color: brand.navy, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</Box><Box><Typography sx={{ fontWeight: 800, fontSize: 14 }}>{title}</Typography><Typography sx={{ mt: 0.4, color: brand.muted, fontSize: 13.5, lineHeight: 1.5 }}>{text}</Typography></Box></Stack>
}