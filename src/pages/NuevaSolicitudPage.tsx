import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Select,
  Stepper,
  Step,
  StepLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { ArrowBack, Check, InfoOutlined, ArrowForward } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { StatusChip } from '../components/StatusChip'
import { Toast, type ToastState } from '../components/Toast'
import { R } from '../routes'
import { api } from '../api'
import { useAsync } from '../useAsync'
import type { Client } from '../types'
import { brand } from '../theme'

export function NuevaSolicitudPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [step, setStep] = useState(0)

  const clientsState = useAsync(() => api.listClients(), [])
  const clients: Client[] = clientsState.data ?? []

  // client
  const [clientMode, setClientMode] = useState<'existente' | 'nuevo'>('existente')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // service
  const [date, setDate] = useState('2026-09-26')
  const [arriveFrom, setArriveFrom] = useState('09:00')
  const [arriveTo, setArriveTo] = useState('11:00')
  const [originAddress, setOriginAddress] = useState('')
  const [originBarrio, setOriginBarrio] = useState('')
  const [originFloor, setOriginFloor] = useState('')
  const [originElevator, setOriginElevator] = useState<'Sí' | 'No'>('No')
  const [destAddress, setDestAddress] = useState('')
  const [destBarrio, setDestBarrio] = useState('')
  const [destFloor, setDestFloor] = useState('')
  const [destElevator, setDestElevator] = useState<'Sí' | 'No'>('No')

  // cargo
  const [cargoDesc, setCargoDesc] = useState('1 heladera, 1 sillón de 2 cuerpos desmontable y 10 cajas')
  const [cargoQty, setCargoQty] = useState('')
  const [fragile, setFragile] = useState<'Sí' | 'No'>('Sí')
  const [notes, setNotes] = useState('')

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (clientMode === 'existente' && !selectedClientId && clients.length > 0) {
      setSelectedClientId(String(clients[0].id))
    }
  }, [clientMode, selectedClientId, clients])

  const clientReady = clientMode === 'existente' ? selectedClientId !== '' : newName.trim() !== '' && newPhone.trim() !== ''
  const serviceReady =
    date !== '' && arriveFrom !== '' && arriveTo !== '' && originAddress.trim() !== '' && originFloor.trim() !== '' && destAddress.trim() !== '' && destFloor.trim() !== ''
  const cargoReady = cargoDesc.trim() !== '' && cargoQty.trim() !== ''

  const canNext = useMemo(() => [clientReady, serviceReady, cargoReady][step], [step, clientReady, serviceReady, cargoReady])

  const steps = ['Cliente', 'Servicio', 'Carga']

  const label = (txt: string, required: boolean) => (
    <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.7 }}>
      {txt} {required && <Box component="span" sx={{ color: brand.orangeInk }}>*</Box>}
    </Typography>
  )

  const save = async () => {
    setSaving(true)
    try {
      let clientId: number | null = null
      let clientName = ''
      let phone = ''
      if (clientMode === 'existente') {
        clientId = Number(selectedClientId)
        const c = clients.find((x) => String(x.id) === selectedClientId)
        clientName = c?.name ?? ''
        phone = c?.phone ?? ''
      } else {
        const created = await api.createClient({ name: newName.trim(), phone: newPhone.trim() })
        clientId = created.id
        clientName = created.name
        phone = created.phone
      }

      const created = await api.createRequest({
        client_id: clientId,
        client_name: clientName,
        phone,
        date,
        arrival_from: arriveFrom,
        arrival_to: arriveTo,
        service_from: arriveFrom,
        service_to: arriveTo,
        origin: {
          address: originAddress,
          barrio: originBarrio,
          floor: originFloor,
          elevator: originElevator === 'Sí',
        },
        destination: {
          address: destAddress,
          barrio: destBarrio,
          floor: destFloor,
          elevator: destElevator === 'Sí',
        },
        cargo: {
          items: [],
          approx_units: Number(cargoQty || 0),
          fragile: fragile === 'Sí',
          notes: cargoDesc + (notes ? ` · ${notes}` : ''),
        },
      })

      setSaved(true)
      setToast({ message: `Solicitud guardada · ${created.id}`, tone: 'success' })
      setTimeout(() => {
        window.location.href = R.planificacion(created.id)
      }, 1400)
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos guardar la solicitud.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AppShell
        active="solicitudes"
        breadcrumb={['Gestión', 'Solicitudes', 'Nueva solicitud']}
        title="Nueva solicitud"
        description="Completá los datos para revisar disponibilidad y condiciones."
        action={<StatusChip label={saved ? 'Guardada' : 'Borrador'} />}
      >
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2.5 }}>
          <Button href={R.solicitudes} size="small" startIcon={<ArrowBack sx={{ fontSize: 16 }} />} sx={{ color: '#5C6B7A' }}>
            Volver a solicitudes
          </Button>
        </Stack>

        <Stepper activeStep={step} alternativeLabel={!isMobile} orientation={isMobile ? 'vertical' : 'horizontal'} sx={{ mb: 3, maxWidth: 720 }}>
          {steps.map((s) => (
            <Step key={s}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { fontWeight: 700 },
                }}
              >
                {s}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ maxWidth: 820 }}>
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: { xs: 2, md: 3.5 } }}>
            {step === 0 && (
              <>
                <StepHeading n="01" title="Cliente" subtitle="Datos de contacto para coordinar el servicio." />
                <ToggleButtonGroup
                  value={clientMode}
                  exclusive
                  onChange={(_, v) => v && setClientMode(v)}
                  size="small"
                  sx={{ mb: 2.5 }}
                >
                  <ToggleButton value="existente">Cliente existente</ToggleButton>
                  <ToggleButton value="nuevo">Nuevo cliente</ToggleButton>
                </ToggleButtonGroup>

                {clientMode === 'existente' ? (
                  <Stack spacing={1.5}>
                    {label('Seleccionar cliente', true)}
                    <Select size="small" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} sx={{ bgcolor: '#fff' }}>
                      {clients.map((c) => (
                        <MenuItem key={c.id} value={String(c.id)}>
                          {c.name} · {c.phone}
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
                      Usamos estos datos para coordinar el servicio con el cliente.
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <TextField label="Nombre y apellido" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth size="small" placeholder="Ingresá el nombre del cliente." />
                    <TextField
                      label="Teléfono"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="11 5555-0000"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">+54</InputAdornment>,
                      }}
                    />
                  </Stack>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading n="02" title="Servicio" subtitle="Fecha solicitada, horario aproximado y recorrido." />
                <Stack spacing={2.5}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: '#64707C', letterSpacing: '0.06em' }}>
                      Fecha y horario
                    </Typography>
                    <TextField label="Fecha solicitada" type="date" value={date} onChange={(e) => setDate(e.target.value)} size="small" fullWidth sx={{ maxWidth: 260 }} />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                      <TextField label="Llegada desde" type="time" value={arriveFrom} onChange={(e) => setArriveFrom(e.target.value)} size="small" sx={{ flexGrow: 1 }} />
                      <TextField label="Llegada hasta" type="time" value={arriveTo} onChange={(e) => setArriveTo(e.target.value)} size="small" sx={{ flexGrow: 1 }} />
                    </Stack>
                  </Stack>

                  <StepLocation
                    title="Origen · Retiro"
                    address={originAddress}
                    onAddress={setOriginAddress}
                    barrio={originBarrio}
                    onBarrio={setOriginBarrio}
                    floor={originFloor}
                    onFloor={setOriginFloor}
                    elevator={originElevator}
                    onElevator={setOriginElevator}
                  />
                  <StepLocation
                    title="Destino · Entrega"
                    address={destAddress}
                    onAddress={setDestAddress}
                    barrio={destBarrio}
                    onBarrio={setDestBarrio}
                    floor={destFloor}
                    onFloor={setDestFloor}
                    elevator={destElevator}
                    onElevator={setDestElevator}
                  />
                </Stack>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading n="03" title="Carga" subtitle="Contanos qué hay que trasladar para elegir el vehículo adecuado." />
                <Stack spacing={2.5}>
                  <Stack spacing={1}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: '#64707C', letterSpacing: '0.06em' }}>
                      Detalles de la carga
                    </Typography>
                    <TextField
                      label="Descripción de la carga"
                      value={cargoDesc}
                      onChange={(e) => setCargoDesc(e.target.value)}
                      multiline
                      minRows={3}
                      fullWidth
                      size="small"
                      helperText="Describí los objetos que se van a trasladar."
                    />
                    <TextField label="Cantidad aproximada (bultos)" value={cargoQty} onChange={(e) => setCargoQty(e.target.value.replace(/[^\d]/g, ''))} type="number" size="small" sx={{ maxWidth: 260 }} />
                    <Box>
                      {label('¿Hay objetos frágiles?', true)}
                      <ToggleButtonGroup value={fragile} exclusive onChange={(_, v) => v && setFragile(v)} size="small">
                        <ToggleButton value="Sí">Sí</ToggleButton>
                        <ToggleButton value="No">No</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <TextField label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth size="small" />
                  </Stack>

                  <Box sx={{ p: 1.8, borderRadius: 2, bgcolor: '#F7F5F0', border: '1px solid #EDEAE3' }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <InfoOutlined sx={{ fontSize: 16, color: brand.navy, mt: 0.2 }} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Importante</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#5C6B7A', mt: 0.3 }}>
                          La solicitud se confirmará cuando se acuerden las condiciones y se registre la seña. No se solicitará ningún pago en este paso.
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </>
            )}
          </Box>

          <Stack direction={{ xs: 'column-reverse', md: 'row' }} spacing={1.5} sx={{ mt: 2.5, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
              {step === 2 ? 'Revisá los datos antes de guardar.' : 'Los campos con * son obligatorios.'}
            </Typography>
            <Stack direction="row" spacing={1.5}>
              {step > 0 && (
                <Button variant="outlined" onClick={() => setStep((s) => s - 1)} sx={{ color: brand.navy, borderColor: '#D9D4C9' }}>
                  Volver
                </Button>
              )}
              {step < 2 ? (
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  disabled={!canNext}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Check />}
                  disabled={!cargoReady || saving}
                  onClick={save}
                  sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
                >
                  {saving ? 'Guardando...' : 'Guardar solicitud'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </AppShell>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function StepHeading({ n, title, subtitle }: { n: string; title: string; subtitle: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: brand.navy, color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif" }}>
        {n}
      </Box>
      <Box>
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>{subtitle}</Typography>
      </Box>
    </Stack>
  )
}

function StepLocation({
  title,
  address,
  onAddress,
  barrio,
  onBarrio,
  floor,
  onFloor,
  elevator,
  onElevator,
}: {
  title: string
  address: string
  onAddress: (v: string) => void
  barrio: string
  onBarrio: (v: string) => void
  floor: string
  onFloor: (v: string) => void
  elevator: 'Sí' | 'No'
  onElevator: (v: 'Sí' | 'No') => void
}) {
  const label = (txt: string, required: boolean) => (
    <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.7 }}>
      {txt} {required && <Box component="span" sx={{ color: brand.orangeInk }}>*</Box>}
    </Typography>
  )
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1.5 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>
        {label('Dirección', true)}
        <TextField size="small" fullWidth value={address} onChange={(e) => onAddress(e.target.value)} placeholder="Ingresá la dirección." />
        <TextField size="small" fullWidth label="Barrio" value={barrio} onChange={(e) => onBarrio(e.target.value)} placeholder="Ingresá el barrio." />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField size="small" fullWidth label="Piso" value={floor} onChange={(e) => onFloor(e.target.value)} placeholder="Indicá el piso." />
          <Box sx={{ width: { xs: '100%', md: 260 } }}>
            <Box sx={{ mb: 0.7 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
                ¿Hay ascensor? <Box component="span" sx={{ color: brand.orangeInk }}>*</Box>
              </Typography>
            </Box>
            <ToggleButtonGroup value={elevator} exclusive onChange={(_, v) => v && onElevator(v)} size="small" fullWidth>
              <ToggleButton value="Sí" sx={{ flexGrow: 1 }}>Sí</ToggleButton>
              <ToggleButton value="No" sx={{ flexGrow: 1 }}>No</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </Stack>
    </Box>
  )
}