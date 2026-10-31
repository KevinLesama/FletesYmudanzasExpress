import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
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
  Close,
  Paid,
  BugReport,
  Block,
  Undo,
  Refresh,
  WarningAmber,
  RouteOutlined,
} from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { SearchableSelect } from '../components/SearchableSelect'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { Toast, type ToastState } from '../components/Toast'
import { StatusChip } from '../components/StatusChip'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { R, useQuery } from '../routes'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars, fmtDate, fmtDateEs, dayName, waLink } from '../format'
import type { Driver, Quote, ReceivedBy, ShiftRequest, Vehicle } from '../types'
import { brand } from '../theme'
import { color } from '../design/tokens'

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
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C', letterSpacing: '0.08em' }}>{place.label.toUpperCase()}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, mt: 0.3 }}>{place.address}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>{place.barrio}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.3 }}>
          <Typography sx={{ fontSize: 12, color: '#64707C' }}>{place.floor}</Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: 50, bgcolor: '#C4C9CE' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: place.elevator ? '#2F7D55' : '#64707C' }}>
            {place.elevator ? 'Con ascensor' : 'Sin ascensor'}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

export function PlanificacionPage() {
  const query = useQuery()
  const id = (query.get('id') ?? '').toUpperCase()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const requestState = useAsync(
    () => (id ? api.getRequest(id) : Promise.reject(new Error('Abrí esta pantalla desde una solicitud para ver su planificación.'))),
    [id],
  )
  const catalogState = useAsync(async () => {
    const [drivers, vehicles] = await Promise.all([api.listDrivers(), api.listVehicles()])
    return { drivers, vehicles }
  }, [])
  const request = requestState.data
  const drivers: Driver[] = catalogState.data?.drivers ?? []
  const vehicles: Vehicle[] = catalogState.data?.vehicles ?? []
  const availableDrivers = useMemo(() => drivers.filter((driver) => driver.status === 'Activo'), [drivers])
  const availableVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.status === 'Disponible'), [vehicles])

  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [start, setStart] = useState('11:00')
  const [end, setEnd] = useState('13:00')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [waitMinutes, setWaitMinutes] = useState('120')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)

  // Sincroniza el formulario cuando llega la solicitud.
  useEffect(() => {
    if (!request) return
    setDriverId(request.driverId ?? '')
    setVehicleId(request.vehicleId ?? '')
    setStart(request.serviceRange[0] || '11:00')
    setEnd(request.serviceRange[1] || '13:00')
    setPrice(String(request.price ?? 0))
    setPriceTouched(Boolean(request.priceOverridden))
    setWaitMinutes(String(request.waitMinutes ?? 120))
    setConfirmedState(request.status === 'Confirmada')
    setCancelled(request.status === 'Cancelada')
  }, [request])

  // Cotizacion del backend con las tarifas del chofer elegido. Se recalcula al
  // cambiar chofer o espera; es solo una vista previa hasta guardar.
  useEffect(() => {
    if (!request || !driverId || request.estimatedKm == null) {
      setQuote(null)
      setQuoteError('')
      return
    }
    let cancelledRequest = false
    setQuoteLoading(true)
    const timer = window.setTimeout(() => {
      api
        .quote(request.id, { driverId, waitMinutes: Number(waitMinutes || 0) })
        .then((q) => {
          if (cancelledRequest) return
          setQuote(q)
          setQuoteError('')
        })
        .catch((err) => {
          if (cancelledRequest) return
          setQuote(null)
          setQuoteError(err instanceof Error ? err.message : 'No pudimos calcular el costo.')
        })
        .finally(() => {
          if (!cancelledRequest) setQuoteLoading(false)
        })
    }, 350)
    return () => {
      cancelledRequest = true
      window.clearTimeout(timer)
    }
  }, [request, driverId, waitMinutes])

  useEffect(() => {
    if (quote && !priceTouched) setPrice(String(Math.round(quote.suggestedPrice)))
  }, [quote, priceTouched])

  useEffect(() => {
    if (catalogState.loading) return
    if (driverId && !availableDrivers.some((driver) => driver.id === driverId)) setDriverId('')
    if (vehicleId && !availableVehicles.some((vehicle) => vehicle.id === vehicleId)) setVehicleId('')
  }, [catalogState.loading, driverId, vehicleId, availableDrivers, availableVehicles])

  const [confirmedState, setConfirmedState] = useState(false)

  const depositReceived = request?.depositReceived ?? 0
  // La seña es siempre el 50 % del precio acordado. El backend es la fuente de
  // verdad (pricing.sena); aca se replica solo para mostrarla mientras se edita.
  const depositRequired = Math.round(Number(price || 0) / 2)
  const depositOk = depositReceived >= depositRequired && depositRequired > 0
  const priceOverridden = Boolean(request?.priceOverridden)
  const suggestedPrice = quote?.suggestedPrice ?? request?.suggestedPrice ?? 0
  const hasDistance = request?.estimatedKm != null

  const selectedDriver = drivers.find((d) => d.id === driverId)
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const canConfirm =
    depositOk &&
    availableDrivers.some((driver) => driver.id === driverId) &&
    availableVehicles.some((vehicle) => vehicle.id === vehicleId)

  const driverOption = (d: Driver) => (
    <MenuItem value={d.id} key={d.id}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Person sx={{ fontSize: 16, color: '#64707C' }} />
        <span>{d.name}</span>
      </Stack>
    </MenuItem>
  )

  const vehicleOptionContent = (v: Vehicle) => {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <LocalShipping sx={{ fontSize: 16, color: '#64707C' }} />
        <span>
          {v.id} · {v.type}
        </span>
      </Stack>
    )
  }

  const requestId = request?.id ?? id
  const requestClient = request?.client ?? ''
  const requestPhone = request?.phone ?? ''
  const requestDate = request?.date ?? ''
  const requestArrival = request?.arrivalRange ?? (['--:--', '--:--'] as [string, string])
  const requestOrigin = request?.origin
  const requestDestination = request?.destination

  const wa = waLink(
    requestPhone,
    `Hola ${requestClient}, te escribimos por tu viaje ${requestId} del ${fmtDateEs(requestDate)} · servicio ${(request?.serviceRange ?? ['', '']).join(' a ')}.`,
  )

  const runAction = async (fn: () => Promise<ShiftRequest | unknown>, successMessage: string) => {
    setBusy(true)
    try {
      await fn()
      await requestState.reload()
      setToast({ message: successMessage, tone: 'success' })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos completar la operación.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (requestState.loading || catalogState.loading) {
    return (
      <AppShell active="solicitudes" breadcrumb={['Gestión', 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <LoadingState label="Cargando solicitud..." />
        </Box>
      </AppShell>
    )
  }

  if (requestState.error || !request) {
    return (
      <AppShell active="solicitudes" breadcrumb={['Gestión', 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <ErrorState message={requestState.error ?? 'No encontramos la solicitud solicitada.'} onRetry={requestState.reload} />
        </Box>
      </AppShell>
    )
  }

  const confirmed = confirmedState
  const cancelledFlag = cancelled


  const planning = (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Schedule sx={{ fontSize: 17, color: '#64707C' }} />
        </Stack>
        <TextField size="small" type="time" label="Inicio estimado" value={start} onChange={(e) => setStart(e.target.value)} sx={{ flexGrow: 1 }} />
        <TextField size="small" type="time" label="Fin estimado" value={end} onChange={(e) => setEnd(e.target.value)} sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          type="number"
          label="Espera (carga y descarga)"
          value={waitMinutes}
          onChange={(e) => setWaitMinutes(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            const n = Math.min(Math.max(Number(waitMinutes || 0), 0), 1440)
            setWaitMinutes(String(n))
          }}
          InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
          inputProps={{ min: 0, max: 1440, step: 15 }}
          sx={{ width: { xs: '100%', md: 190 } }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Chofer</InputLabel>
          <Select label="Chofer" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {availableDrivers.map((d) => driverOption(d))}
          </Select>
        </FormControl>
        <SearchableSelect
          label="Vehículo"
          value={selectedVehicle ?? null}
          options={availableVehicles}
          getKey={(v) => v.id}
          getLabel={(v) => `${v.id} · ${v.type}`}
          getSearchText={(v) => v.status}
          renderOption={vehicleOptionContent}
          onChange={(v) => setVehicleId(v?.id ?? '')}
          placeholder="Buscar por ID o tipo"
          fullWidth
        />
      </Stack>

      <Stack spacing={1} sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircle sx={{ fontSize: 16, color: '#2F7D55' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#2F7D55' }}>
            {selectedDriver ? selectedDriver.name : 'Sin chofer'} — disponible
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalShipping sx={{ fontSize: 16, color: '#2F7D55' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#2F7D55' }}>
            {selectedVehicle ? `${selectedVehicle.id} · ${selectedVehicle.type} · ${selectedVehicle.capacityKg} kg` : 'Sin vehículo'} — disponible
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ mt: 2, p: 1.8, borderRadius: 2, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Paid sx={{ fontSize: 16, color: brand.navy }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Costos del viaje</Typography>
          <Box sx={{ flexGrow: 1 }} />
          {quoteLoading && <CircularProgress size={14} />}
        </Stack>

        {!driverId && (
          <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
            Elegí un chofer para ver su costo y el precio sugerido.
          </Typography>
        )}
        {driverId && !hasDistance && (
          <Typography sx={{ fontSize: 12.5, color: '#98621B' }}>
            Esta solicitud no tiene distancia calculada (se cargó sin geolocalización), así que el costo no se puede calcular.
          </Typography>
        )}
        {quoteError && <Typography sx={{ fontSize: 12.5, color: '#B3261E' }}>{quoteError}</Typography>}

        {quote && (
          <Stack spacing={0.7}>
            <Row label="Tarifa base" value={ars(quote.costBase)} />
            <Row label={`Kilometraje (${quote.kmTotal} km)`} value={ars(quote.costKm)} />
            <Row label={`Tiempo (${quote.totalHours.toString().replace('.', ',')} h)`} value={ars(quote.costTime)} />
            <Divider sx={{ borderColor: '#E3DFD5', mt: 0.5 }} />
            <Row label="Costo del chofer" value={ars(quote.driverCost)} strong />
            <Row label={`Margen (${Math.round((quote.margin - 1) * 100)} %)`} value={ars(quote.suggestedPrice - quote.driverCost)} />
            <Row label="Precio sugerido" value={ars(quote.suggestedPrice)} strong />
            <Row label="Seña sugerida (50 %)" value={ars(quote.depositRequired)} />
          </Stack>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Precio acordado</Typography>
          <Box sx={{ flexGrow: 1 }} />
          {priceOverridden && <StatusChip label="Precio manual" />}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Precio final"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value.replace(/[^\d]/g, ''))
              setPriceTouched(true)
            }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 200 } }}
            helperText={suggestedPrice > 0 ? `Sugerido: ${ars(suggestedPrice)}` : undefined}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ alignSelf: 'center' }}>
            <Typography sx={{ fontSize: 11.5, color: '#64707C', fontWeight: 700 }}>SEÑA REQUERIDA (50 %)</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: brand.navy }}>{ars(depositRequired)}</Typography>
          </Box>
        </Stack>

        {priceOverridden && (
          <Box sx={{ mt: 1.4, p: 1.4, borderRadius: 2, bgcolor: '#FFF4E5', border: '1px solid #F0DFC0' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <WarningAmber sx={{ fontSize: 16, color: '#98621B', mt: 0.2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#98621B' }}>
                  El precio se modificó a mano. El sugerido con las tarifas vigentes es {ars(suggestedPrice)}.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<Refresh />}
                disabled={!driverId || !hasDistance || busy}
                onClick={() => {
                  void runAction(
                    async () => {
                      await api.updateRequest(request.id, { recotizar: true })
                      setPrice(String(Math.round(quote?.suggestedPrice ?? suggestedPrice)))
                      setPriceTouched(false)
                    },
                    'Precio recalculado',
                  ).then(() => setSaved(false))
                }}
                sx={{ color: brand.navy }}
              >
                Volver a calcular
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
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
              <SectionCard title="Cliente" icon={<Person sx={{ fontSize: 17 }} />} right={<Phone sx={{ fontSize: 16, color: '#64707C' }} />}>
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
                  sx={{ mt: 1.4, color: color.green, borderColor: '#7AE3A7', '&:hover': { borderColor: color.green, bgcolor: color.greenSoft } }}
                >
                  Contactar por WhatsApp
                </Button>
                <Divider sx={{ my: 1.5, borderColor: '#EDEAE3' }} />
                <Stack direction="row" spacing={3}>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C' }}>SOLICITADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{fmtDate(request.date)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C' }}>LLEGADA ACORDADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{request.arrivalRange.join(' – ')}</Typography>
                  </Box>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Recorrido" icon={<LocationOn sx={{ fontSize: 17 }} />} right={<Typography sx={{ fontSize: 12, color: '#64707C' }}>Buenos Aires</Typography>}>
              {requestOrigin && <RouteStop place={requestOrigin} kind="origin" color="#132B4A" />}
              <Box sx={{ my: 1.4, ml: 0.85, width: '1px', height: 18, borderLeft: '2px dashed #D8D3C8' }} />
              {requestDestination && <RouteStop place={requestDestination} kind="destination" color="#F07855" />}

              <Divider sx={{ my: 1.6, borderColor: '#EDEAE3' }} />
              {hasDistance ? (
                <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
                  <RouteMetric icon={<RouteOutlined sx={{ fontSize: 15 }} />} label="DISTANCIA IDA" value={`${request?.estimatedKm} km`} />
                  <RouteMetric icon={<RouteOutlined sx={{ fontSize: 15 }} />} label="TOTAL (IDA Y VUELTA)" value={`${request?.totalKm ?? 0} km`} />
                  <RouteMetric icon={<Schedule sx={{ fontSize: 15 }} />} label="VIAJE (IDA)" value={`~${request?.etaMinutes ?? 0} min`} />
                  <RouteMetric icon={<Schedule sx={{ fontSize: 15 }} />} label="ESPERA" value={`${request?.waitMinutes ?? 0} min`} />
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: '#98621B' }}>
                  Sin distancia calculada. La solicitud se cargó sin geolocalización, así que el recorrido no se puede cotizar automáticamente.
                </Typography>
              )}
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
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C' }}>NOTA DEL CLIENTE</Typography>
                  <Typography sx={{ fontSize: 13, mt: 0.4 }}>{request.cargo.notes}</Typography>
                </Box>
              </SectionCard>
            )}
          </Stack>

          <Stack spacing={2.5}>
            <SectionCard title="Planificación" icon={<Schedule sx={{ fontSize: 17 }} />} right={<StatusChip label={saved ? 'Guardada' : 'Sin guardar'} />}>
              <Typography sx={{ fontSize: 12.5, color: '#64707C', mb: 1.5 }}>
                Acordá precio, horario y asignación.
              </Typography>
              {planning}
            </SectionCard>

            {summary}

            {cancelled ? (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F1F2F4', border: '1px solid #E0E0E0', color: '#5F6873' }}>
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
                      ? 'Confirmación habilitada: la seña está registrada y los recursos están disponibles.'
                      : 'Confirmación bloqueada. Para confirmar el viaje, primero registrá la seña requerida y elegí un chofer y un vehículo disponibles.'}
                  </Typography>
                </Stack>
              </Box>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={busy ? <CircularProgress size={16} /> : <Save />}
                disabled={cancelledFlag || busy}
                sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }}
                onClick={() =>
                  runAction(
                    () =>
                      api.updateRequest(request.id, {
                        driver_id: driverId || null,
                        vehicle_id: vehicleId || null,
                        service_from: start,
                        service_to: end,
                        price: Number(price || 0),
                        espera_min: Number(waitMinutes || 0),
                      }),
                    'Planificación tentativa guardada',
                  ).then(() => setSaved(true))
                }
              >
                Guardar planificación tentativa
              </Button>
              <Button
                variant="outlined"
                startIcon={<Paid />}
                disabled={cancelledFlag || busy}
                sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }}
                onClick={() => setDialogOpen(true)}
              >
                Registrar seña
              </Button>
              <Button
                variant="outlined"
                startIcon={cancelledFlag ? <Undo /> : <Block />}
                disabled={busy}
                sx={
                  cancelledFlag
                    ? { color: brand.navy, borderColor: '#D9D4C9', py: 1.1 }
                    : { color: '#9C493A', borderColor: '#E5B8AD', bgcolor: '#FFF7F5', py: 1.1, '&:hover': { borderColor: '#9C493A', bgcolor: '#FFEFEB' } }
                }
                onClick={() => {
                  if (cancelledFlag) {
                    runAction(
                      () => api.updateRequest(request.id, { status: 'Pendiente de seña', confirmed: false }),
                      'Viaje reactivado · ' + requestId,
                    )
                  } else {
                    setCancelOpen(true)
                  }
                }}
              >
                {cancelledFlag ? 'Reactivar viaje' : 'Cancelar viaje'}
              </Button>
              <Button
                variant="contained"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Check />}
                disabled={!canConfirm || cancelledFlag || busy}
                sx={{ py: 1.1 }}
                onClick={() =>
                  runAction(
                    () =>
                      api.updateRequest(request.id, {
                        driver_id: driverId,
                        vehicle_id: vehicleId,
                        service_from: start,
                        service_to: end,
                        price: Number(price || 0),
                        espera_min: Number(waitMinutes || 0),
                        status: 'Confirmada',
                        confirmed: true,
                      }),
                    'Viaje confirmado · ' + requestId,
                  )
                }
              >
                Confirmar viaje
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: '#64707C', mt: 0.5 }}>
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
        onSave={(amount, date, concept, method, receivedBy, notes) => {
          setDialogOpen(false)
          runAction(
            async () => {
              await api.updateRequest(request.id, {
                price: Number(price || 0),
                espera_min: Number(waitMinutes || 0),
              })
              return api.addPayment(request.id, {
                concept,
                method,
                receivedBy,
                amount,
                date,
                notes,
              })
            },
            `Seña registrada · ${ars(amount)}`,
          )
        }}
      />

      <CancelDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false)
          runAction(() => api.updateRequest(request.id, { status: 'Cancelada' }), 'Viaje cancelado · ' + requestId)
        }}
        requestId={requestId}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function RouteMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ color: '#64707C' }}>
        {icon}
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em' }}>{label}</Typography>
      </Stack>      <Typography sx={{ fontSize: 14, fontWeight: 800, color: brand.navy, mt: 0.2 }}>{value}</Typography>
    </Box>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {  return (
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
            <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>{requestId}</Typography>
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
  onSave: (amount: number, date: string, concept: 'Seña' | 'Saldo', method: 'Transferencia' | 'Efectivo', receivedBy: ReceivedBy, notes?: string) => void
}) {
  const [amount, setAmount] = useState(String(depositRequired || ''))
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [concept, setConcept] = useState<'Seña' | 'Saldo'>('Seña')
  const [method, setMethod] = useState<'Transferencia' | 'Efectivo'>('Transferencia')
  const [receivedBy, setReceivedBy] = useState<ReceivedBy>('Administración')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const save = () => {
    const num = Number(amount || 0)
    const max = Math.max(price - received, 0)
    if (num <= 0 || num > max) {
      setError(`Ingresá un importe entre $ 1 y ${ars(max)}.`)
      return
    }
    onSave(num, date, concept, method, receivedBy, notes || undefined)
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={isMobile} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: { xs: 2.5, md: 3 }, pt: { xs: 4, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: '#64707C', fontWeight: 700 }}>{requestId} · {client}</Typography>
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
              <Select label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value as 'Seña' | 'Saldo')}>
                <MenuItem value="Seña">Seña</MenuItem>
                <MenuItem value="Saldo">Saldo</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Medio</InputLabel>
              <Select label="Medio" value={method} onChange={(e) => setMethod(e.target.value as 'Transferencia' | 'Efectivo')}>
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