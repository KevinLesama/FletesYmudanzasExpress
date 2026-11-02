import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  FormHelperText,
  InputAdornment,
  MenuItem,
  Stack,
  Select,
  Tooltip,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  ArrowBack,
  Check,
  Edit,
  ErrorOutline,
  InfoOutlined,
  Lock,
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
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EtiquetaCampo, CampoSelect, CampoTexto } from '../components/FormFields'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { Toast, type ToastState } from '../components/Toast'
import { StatusChip } from '../components/StatusChip'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { R, useQuery } from '../routes'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars, fmtDate, fmtDateEs, dayName, waLink } from '../format'
import { getTodayISO } from '../agendaDates'
import type { Driver, Quote, ReceivedBy, ShiftRequest, Vehicle } from '../types'
import { brand } from '../theme'
import { color, shadow, type as typeScale } from '../design/tokens'
import { motivosConfirmacionViaje } from './planificacionConfirmacion'
import type { SelectChangeEvent } from '@mui/material/Select'

const avisoCampoSx = {
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main' },
} as const

const errorCampoSx = {
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main' },
} as const

interface SectionCardProps {
  title: string
  icon?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}

function SectionCard({ title, icon, right, children }: SectionCardProps) {
  return (
    <Box sx={{ bgcolor: color.paper, border: '1px solid', borderColor: color.border, borderRadius: 3, p: 2.5 }}>
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

/** Quita el prefijo administrativo de un tramo de dirección ("Partido de …"). */
function stripSegment(segment: string): string {
  return segment.replace(/^(partido|municipio|departamento)\s+de\s+/i, '').trim()
}

/**
 * Separa la dirección en las dos líneas del recorrido: calle y número, y
 * localidad (barrio + ciudad). Descarta código postal y país, y deja el texto
 * completo para el tooltip.
 */
function placeLines(place: { address: string; barrio: string }): { street: string; locality: string; full: string } {
  const segments = place.address.split(',').map(stripSegment).filter(Boolean)
  const isPostalCode = /^[A-Z]?\d{4}[A-Z]{0,3}$/i
  const isCountry = /^argentina$/i
  const street = segments[0] ?? ''
  const cities = segments.slice(1).filter((segment) => !isPostalCode.test(segment) && !isCountry.test(segment))
  const locality = [place.barrio, ...cities]
    .map(stripSegment)
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
    .join(' · ')
  const full =
    place.address && place.barrio && !place.address.toLowerCase().includes(place.barrio.toLowerCase())
      ? `${place.address} · ${place.barrio}`
      : place.address || place.barrio

  return { street: street || place.barrio || place.address, locality, full }
}

/** Marcadores del recorrido, coherentes con los del mapa. */
function RouteMarker({ kind }: { kind: 'origin' | 'destination' }) {
  if (kind === 'origin') {
    return (
      <Box
        aria-hidden="true"
        sx={{
          width: 18,
          height: 18,
          boxSizing: 'border-box',
          borderRadius: '50%',
          bgcolor: color.paper,
          border: `4px solid ${color.navy}`,
          boxShadow: shadow.card,
        }}
      />
    )
  }

  return (
    <Box
      aria-hidden="true"
      sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: '50% 50% 50% 0',
          bgcolor: color.orange,
          boxShadow: shadow.card,
          transform: 'rotate(-45deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color.paper }} />
      </Box>
    </Box>
  )
}

interface CampoAsignacionProps {
  label: string
  value: string
  onChange: (event: SelectChangeEvent<string>) => void
  available: boolean
  selected: boolean
  disabled: boolean
  error?: boolean
  helperText?: string
  children: React.ReactNode
  renderValue: (value: unknown) => React.ReactNode
}

function CampoAsignacion({
  label,
  value,
  onChange,
  available,
  selected,
  disabled,
  error,
  helperText,
  children,
  renderValue,
}: CampoAsignacionProps) {
  const fieldId = useId()
  const statusText = selected ? (available ? 'Disponible' : 'No disponible') : 'Sin asignar'
  const statusColor = selected && available ? color.green : color.amberInk

  return (
    <FormControl fullWidth error={error}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
        <EtiquetaCampo text={label} htmlFor={fieldId} />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, color: statusColor }}>
          <Box sx={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', bgcolor: selected && available ? color.green : color.amber }} />
          <Typography noWrap sx={{ fontSize: typeScale.caption, fontWeight: 700 }}>
            {statusText}
          </Typography>
        </Stack>
      </Stack>
      <Select
        id={fieldId}
        size="small"
        fullWidth
        value={value}
        onChange={onChange}
        disabled={disabled}
        displayEmpty
        error={error}
        renderValue={renderValue}
        sx={{
          '& .MuiSelect-select': {
            height: 48,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            textOverflow: 'clip',
          },
        }}
      >
        {children}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  )
}

function RouteStopContent({
  place,
  title,
}: {
  place: { label: string; address: string; barrio: string; floor: string; elevator: boolean }
  title: string
}) {
  const { street, locality, full } = placeLines(place)

  return (
    <Box>
      <Typography
        sx={{ fontSize: 11, fontWeight: 800, color: color.muted, letterSpacing: '0.08em', lineHeight: 1.4, mb: 0.5 }}
      >
        {title}
      </Typography>
      <Tooltip title={full} placement="top" arrow>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: '18px', color: color.navy }}>
          {street}
        </Typography>
      </Tooltip>
      {locality && (
        <Tooltip title={full} placement="top" arrow>
          <Typography noWrap sx={{ fontSize: 12.5, color: color.ink, lineHeight: 1.5 }}>
            {locality}
          </Typography>
        </Tooltip>
      )}
      <Typography sx={{ fontSize: 12, color: color.muted, lineHeight: 1.5, mt: 0.3 }}>
        {[place.floor, place.elevator ? 'Con ascensor' : 'Sin ascensor'].filter(Boolean).join(' · ')}
      </Typography>
    </Box>
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
  const pageMapTrips = useMemo<ShiftRequest[]>(() => (request ? [request] : []), [request])
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
  const [editing, setEditing] = useState(false)
  const [confirmationAttempted, setConfirmationAttempted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const initializedRequestId = useRef<string | null>(null)

  // Inicializa los campos editables sólo para el viaje actual. Las recargas
  // posteriores actualizan `request`, pero no deben pisar cambios locales.
  useEffect(() => {
    if (!request || request.id !== id || initializedRequestId.current === id) return
    initializedRequestId.current = id
    setDriverId(request.driverId ?? '')
    setVehicleId(request.vehicleId ?? '')
    setStart(request.serviceRange[0] || '11:00')
    setEnd(request.serviceRange[1] || '13:00')
    setPrice(String(request.price ?? 0))
    setPriceTouched(Boolean(request.priceOverridden))
    setWaitMinutes(String(request.waitMinutes ?? 120))
  }, [id, request])

  // Al cambiar de viaje se sale del modo edición.
  useEffect(() => {
    setEditing(false)
  }, [id])

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
  }, [request?.id, request?.estimatedKm, driverId, waitMinutes])

  // En modo lectura el precio guardado no debe pisarse con el sugerido.
  useEffect(() => {
    if (!request) return
    const priceLocked =
      request.status === 'Finalizada' ||
      request.status === 'Cancelada' ||
      (request.status === 'Confirmada' && !editing)
    if (!priceLocked && quote && !priceTouched) setPrice(String(Math.round(quote.suggestedPrice)))
  }, [quote, priceTouched, request, editing])

  useEffect(() => {
    if (catalogState.loading) return
    // La asignación guardada en el viaje se respeta aunque el chofer esté
    // inactivo o el vehículo figure asignado a este mismo viaje. Solo se
    // descarta una elección manual que dejó de estar disponible.
    const savedDriverId = request?.driverId ?? ''
    const savedVehicleId = request?.vehicleId ?? ''
    if (driverId && driverId !== savedDriverId && !availableDrivers.some((driver) => driver.id === driverId)) {
      setDriverId('')
    }
    if (vehicleId && vehicleId !== savedVehicleId && !availableVehicles.some((vehicle) => vehicle.vehicleId === vehicleId)) {
      setVehicleId('')
      setToast({ message: 'El vehículo guardado ya no está disponible y fue descartado de la planificación.', tone: 'error' })
    }
  }, [catalogState.loading, request?.driverId, request?.vehicleId, driverId, vehicleId, availableDrivers, availableVehicles])

  const depositReceived = request?.depositReceived ?? 0
  // La seña es siempre el 50 % del precio acordado. El backend es la fuente de
  // verdad (pricing.sena); aca se replica solo para mostrarla mientras se edita.
  const depositRequired = Math.round(Number(price || 0) / 2)
  const depositOk = depositReceived >= depositRequired && depositRequired > 0
  const priceOverridden = Boolean(request?.priceOverridden)
  const suggestedPrice = quote?.suggestedPrice ?? request?.suggestedPrice ?? 0
  const hasDistance = request?.estimatedKm != null
  const planningPayload = {
    driver_id: driverId || null,
    vehicle_id: vehicleId || null,
    service_from: start,
    service_to: end,
    price: Number(price || 0),
    espera_min: Number(waitMinutes || 0),
  }
  const hasUnsavedChanges =
    !!request &&
    (driverId !== (request.driverId ?? '') ||
      vehicleId !== (request.vehicleId ?? '') ||
      start !== (request.serviceRange[0] || '11:00') ||
      end !== (request.serviceRange[1] || '13:00') ||
      Number(price || 0) !== Number(request.price ?? 0) ||
      Number(waitMinutes || 0) !== Number(request.waitMinutes ?? 120))

  const selectedDriver = drivers.find((d) => d.id === driverId)
  const selectedVehicle = vehicles.find((v) => v.vehicleId === vehicleId)
  // Las opciones incluyen la asignación guardada aunque hoy no esté libre
  // (vehículo asignado a este viaje, chofer inactivo) para que el select la
  // muestre en vez de aparecer vacío. La validación de disponibilidad sigue
  // usando las listas estrictas de arriba.
  const driverOptions = useMemo(() => {
    const current = drivers.find((driver) => driver.id === driverId)
    return current && !availableDrivers.some((driver) => driver.id === current.id)
      ? [...availableDrivers, current]
      : availableDrivers
  }, [availableDrivers, drivers, driverId])
  const vehicleOptions = useMemo(() => {
    const current = vehicles.find((vehicle) => vehicle.vehicleId === vehicleId)
    return current && !availableVehicles.some((vehicle) => vehicle.vehicleId === current.vehicleId)
      ? [current, ...availableVehicles]
      : availableVehicles
  }, [availableVehicles, vehicles, vehicleId])
  const driverIsAvailable = availableDrivers.some((driver) => driver.id === driverId)
  const vehicleIsAvailable = availableVehicles.some((vehicle) => vehicle.vehicleId === vehicleId)
  const motivosConfirmacion = useMemo(
    () =>
      motivosConfirmacionViaje({
        cancelled: request?.status === 'Cancelada',
        driverId,
        vehicleId,
        driverIsAvailable,
        vehicleIsAvailable,
        price: Number(price || 0),
        depositReceived,
        depositRequired,
      }),
    [request?.status, driverId, vehicleId, driverIsAvailable, vehicleIsAvailable, price, depositReceived, depositRequired],
  )
  const faltaChofer = motivosConfirmacion.some((motivo) => motivo.campo === 'chofer')
  const faltaVehiculo = motivosConfirmacion.some((motivo) => motivo.campo === 'vehiculo')
  const primerMotivoConfirmacion = motivosConfirmacion[0]?.texto
  const confirmacionLista = motivosConfirmacion.length === 0

  const driverOption = (d: Driver) => (
    <MenuItem value={d.id} key={d.id}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Person sx={{ fontSize: 16, color: color.muted }} />
        <span>{d.name}</span>
      </Stack>
    </MenuItem>
  )

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
      return true
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos completar la operación.', tone: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }

  if (requestState.loading || catalogState.loading) {
    return (
      <AppShell active="solicitudes" breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación">
        <Box sx={{ bgcolor: color.paper, border: '1px solid', borderColor: color.border, borderRadius: 3 }}>
          <LoadingState label="Cargando solicitud..." />
        </Box>
      </AppShell>
    )
  }

  if (requestState.error || !request) {
    return (
      <AppShell active="solicitudes" breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación">
        <Box sx={{ bgcolor: color.paper, border: '1px solid', borderColor: color.border, borderRadius: 3 }}>
          <ErrorState message={requestState.error ?? 'No encontramos la solicitud solicitada.'} onRetry={requestState.reload} />
        </Box>
      </AppShell>
    )
  }

  // Estado del viaje y modo de la planificación. Confirmada abre en lectura;
  // Finalizada y Cancelada quedan siempre en lectura.
  const isConfirmed = request.status === 'Confirmada'
  const isFinalized = request.status === 'Finalizada'
  const isCancelled = request.status === 'Cancelada'
  const plannedStatus = !isConfirmed && !isFinalized && !isCancelled
  const canEdit = !isFinalized && !isCancelled && (!isConfirmed || editing)

  const resetPlanningFields = () => {
    setDriverId(request.driverId ?? '')
    setVehicleId(request.vehicleId ?? '')
    setStart(request.serviceRange[0] || '11:00')
    setEnd(request.serviceRange[1] || '13:00')
    setPrice(String(request.price ?? 0))
    setPriceTouched(Boolean(request.priceOverridden))
    setWaitMinutes(String(request.waitMinutes ?? 120))
    setConfirmationAttempted(false)
  }

  const savePlanningChanges = async () => {
    const saved = await runAction(
      () => api.updateRequest(request.id, planningPayload),
      'Cambios de planificación guardados',
    )
    if (saved) setEditing(false)
  }

  const cancelPlanningEdit = () => {
    resetPlanningFields()
    setEditing(false)
  }

  const planning = (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          columnGap: 1.5,
          rowGap: 1.5,
          alignItems: 'start',
        }}
      >
        <CampoTexto
          size="small"
          type="time"
          label="Inicio"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={!canEdit}
          autoComplete="off"
          fullWidth
          sx={{ '& .MuiOutlinedInput-root': { height: 48 } }}
        />
        <CampoTexto
          size="small"
          type="time"
          label="Fin"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={!canEdit}
          autoComplete="off"
          fullWidth
          sx={{ '& .MuiOutlinedInput-root': { height: 48 } }}
        />
        <CampoTexto
          size="small"
          type="number"
          label="Espera (min)"
          value={waitMinutes}
          onChange={(e) => setWaitMinutes(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            const n = Math.min(Math.max(Number(waitMinutes || 0), 0), 1440)
            setWaitMinutes(String(n))
          }}
          disabled={!canEdit}
          inputProps={{ min: 0, max: 1440, step: 15 }}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': { whiteSpace: 'nowrap' },
            '& .MuiOutlinedInput-root': { height: 48 },
          }}
        />
      </Box>

      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        <CampoAsignacion
          label="Chofer"
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
          selected={Boolean(selectedDriver)}
          available={driverIsAvailable}
          disabled={!canEdit}
          error={confirmationAttempted && !driverId}
          helperText={confirmationAttempted && !driverId ? 'Elegí un chofer.' : undefined}
          renderValue={(value) =>
            value
              ? driverOptions.find((driver) => driver.id === value)?.name ?? String(value)
              : <Box component="span" sx={{ color: 'text.secondary' }}>Elegí un chofer</Box>
          }
        >
          <MenuItem value="" disabled>
            Elegí un chofer
          </MenuItem>
          {driverOptions.map((d) => driverOption(d))}
        </CampoAsignacion>
        <Tooltip title={selectedVehicle ? `${selectedVehicle.id} · ${selectedVehicle.type} · ${selectedVehicle.capacityKg} kg` : ''} arrow>
          <Box sx={{ minWidth: 0 }}>
            <CampoAsignacion
              label="Vehículo"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              selected={Boolean(selectedVehicle)}
              available={vehicleIsAvailable}
              disabled={!canEdit}
              error={confirmationAttempted && !vehicleId}
              helperText={confirmationAttempted && !vehicleId ? 'Elegí un vehículo.' : undefined}
              renderValue={(value) => {
                if (!value) return <Box component="span" sx={{ color: 'text.secondary' }}>Elegí un vehículo</Box>
                const vehicle = vehicleOptions.find((option) => option.vehicleId === value)
                return vehicle ? `${vehicle.id} · ${vehicle.type} · ${vehicle.capacityKg} kg` : String(value)
              }}
            >
              <MenuItem value="" disabled>
                Elegí un vehículo
              </MenuItem>
              {vehicleOptions.map((vehicle) => (
                <MenuItem value={vehicle.vehicleId} key={vehicle.vehicleId}>
                  {vehicle.id} · {vehicle.type} · {vehicle.capacityKg} kg
                </MenuItem>
              ))}
            </CampoAsignacion>
          </Box>
        </Tooltip>
      </Stack>

      <Box sx={{ mt: 2, p: 1.8, borderRadius: 2, bgcolor: color.sand, border: '1px solid', borderColor: color.borderSoft }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Paid sx={{ fontSize: 16, color: brand.navy }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Costos del viaje</Typography>
          <Box sx={{ flexGrow: 1 }} />
          {quoteLoading && <CircularProgress size={14} />}
        </Stack>

        {!driverId && (
          <Typography sx={{ fontSize: 12.5, color: color.muted }}>
            Elegí un chofer para ver su costo y el precio sugerido.
          </Typography>
        )}
        {driverId && !hasDistance && (
          <Typography sx={{ fontSize: 12.5, color: color.amberInk }}>
            Esta solicitud no tiene distancia calculada (se cargó sin geolocalización), así que el costo no se puede calcular.
          </Typography>
        )}
        {quoteError && <Typography sx={{ fontSize: 12.5, color: color.red }}>{quoteError}</Typography>}

        {quote && (
          <Stack spacing={0.7}>
            <Row label="Tarifa base" value={ars(quote.costBase)} />
            <Row label={`Kilometraje (${quote.kmTotal} km)`} value={ars(quote.costKm)} />
            <Row label={`Tiempo (${quote.totalHours.toString().replace('.', ',')} h)`} value={ars(quote.costTime)} />
            <Divider sx={{ borderColor: color.border, mt: 0.5 }} />
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
          <CampoTexto
            size="small"
            label="Precio final"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value.replace(/[^\d]/g, ''))
              setPriceTouched(true)
            }}
            disabled={!canEdit}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ width: { xs: '100%', sm: 200 } }}
            helperText={suggestedPrice > 0 ? `Sugerido: ${ars(suggestedPrice)}` : undefined}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ alignSelf: 'center' }}>
            <Typography sx={{ fontSize: 11.5, color: color.muted, fontWeight: 700 }}>SEÑA REQUERIDA (50 %)</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 800, color: brand.navy }}>{ars(depositRequired)}</Typography>
          </Box>
        </Stack>

        {priceOverridden && (
          <Box sx={{ mt: 1.4, p: 1.4, borderRadius: 2, bgcolor: color.amberSoft, border: '1px solid', borderColor: color.amber }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <WarningAmber sx={{ fontSize: 16, color: color.amberInk, mt: 0.2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: color.amberInk }}>
                  El precio se modificó a mano. El sugerido con las tarifas vigentes es {ars(suggestedPrice)}.
                </Typography>
              </Box>
              {canEdit && (
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
                    )
                  }}
                  sx={{ color: brand.navy }}
                >
                  Volver a calcular
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Box>
    </>
  )

  const summary = (
    <Box sx={{ bgcolor: color.sand, border: '1px solid', borderColor: color.borderSoft, borderRadius: 3, p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <ReceiptLong sx={{ fontSize: 17, color: brand.navy }} />
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Resumen de pago</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <StatusChip label={depositOk ? 'Seña registrada' : 'Pendiente de seña'} />
      </Stack>
      <Stack spacing={1}>
        <Row label="Total del viaje" value={ars(Number(price || 0))} strong />
        <Divider sx={{ borderColor: color.borderSoft }} />
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
        breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Detalle y planificación']}
        kicker="Solicitud"
        title={`${requestId} · Detalle y planificación`}
        description={
          request
            ? `${dayName(requestDate)}, ${fmtDate(requestDate)} · Llegada ${requestArrival.join('-')}`
            : undefined
        }
        action={
          <StatusChip
            label={isCancelled ? 'Cancelada' : isFinalized ? 'Finalizada' : isConfirmed ? 'Confirmada' : 'En planificación'}
          />
        }
        mapTrip={request}
        mapTrips={pageMapTrips}
        mapReason="seleccionado"
      >
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
          <IconButton size="small" href={R.solicitudes} aria-label="Volver a solicitudes">
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
          <Button href={R.solicitudes} size="small" sx={{ color: color.ink }}>
            Volver a solicitudes
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.95fr 1.05fr' }, gap: 2.5, alignItems: 'start' }}>
          <Stack spacing={2.5}>
            {request && (
              <SectionCard title="Cliente" icon={<Person sx={{ fontSize: 17 }} />} right={<Phone sx={{ fontSize: 16, color: color.muted }} />}>
                <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{request.client}</Typography>
                <Typography sx={{ fontSize: 13, color: color.ink }}>{request.phone}</Typography>
                <Button
                  component="a"
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  startIcon={<WhatsAppIcon />}
                  fullWidth
                  sx={{ mt: 1.4, color: color.green, borderColor: color.green, '&:hover': { borderColor: color.green, bgcolor: color.greenSoft } }}
                >
                  Contactar por WhatsApp
                </Button>
                <Divider sx={{ my: 1.5, borderColor: color.borderSoft }} />
                <Stack direction="row" spacing={3}>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: color.muted }}>SOLICITADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{fmtDate(request.date)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: color.muted }}>LLEGADA ACORDADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>{request.arrivalRange.join(' – ')}</Typography>
                  </Box>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Recorrido" icon={<LocationOn sx={{ fontSize: 17 }} />} right={<Typography sx={{ fontSize: 12, color: color.muted }}>Buenos Aires</Typography>}>
              {requestOrigin && requestDestination && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', columnGap: 1.25 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <RouteMarker kind="origin" />
                    <Box sx={{ width: 2, flex: 1, minHeight: 16, bgcolor: color.border }} />
                  </Box>
                  <RouteStopContent place={requestOrigin} title="ORIGEN" />
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <RouteMarker kind="destination" />
                  </Box>
                  <RouteStopContent place={requestDestination} title="DESTINO" />
                </Box>
              )}

              <Divider sx={{ my: 1.6, borderColor: color.borderSoft }} />
              {hasDistance ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <RouteMetric icon={<RouteOutlined />} label="DISTANCIA IDA" value={`${request?.estimatedKm} km`} />
                  <RouteMetric icon={<RouteOutlined />} label="TOTAL (IDA Y VUELTA)" value={`${request?.totalKm ?? 0} km`} />
                  <RouteMetric icon={<Schedule />} label="VIAJE (IDA)" value={`~${request?.etaMinutes ?? 0} min`} />
                  <RouteMetric icon={<Schedule />} label="ESPERA" value={`${request?.waitMinutes ?? 0} min`} />
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: color.amberInk }}>
                  Sin distancia calculada. La solicitud se cargó sin geolocalización, así que el recorrido no se puede cotizar automáticamente.
                </Typography>
              )}
            </SectionCard>

            {request && (
              <SectionCard title="Carga y observaciones" icon={<Notes sx={{ fontSize: 17 }} />} right={
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, bgcolor: color.blueSoft, color: color.blue, borderRadius: 999, px: 1.2, py: 0.3 }}>
                  ~{request.cargo.approxUnits} bultos
                </Typography>
              }>
                <Typography sx={{ fontSize: 13.5, color: color.inkStrong }}>{request.cargo.items.map((i) => i.name).join(', ')}</Typography>
                <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 1 }}>
                  <InfoOutlined sx={{ fontSize: 14, color: color.amber }} />
                  <Typography sx={{ fontSize: 12.5, color: color.amberInk, fontWeight: 600 }}>
                    Objetos frágiles: {request.cargo.fragile ? 'sí' : 'no'}
                  </Typography>
                </Stack>
                <Box sx={{ mt: 1.4, p: 1.4, borderRadius: 2, bgcolor: color.sand, border: '1px solid', borderColor: color.borderSoft }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: color.muted }}>NOTA DEL CLIENTE</Typography>
                  <Typography sx={{ fontSize: 13, mt: 0.4 }}>{request.cargo.notes}</Typography>
                </Box>
              </SectionCard>
            )}
          </Stack>

          <Stack spacing={2.5}>
            <SectionCard
              title="Planificación"
              icon={<Schedule sx={{ fontSize: 17 }} />}
              right={
                isConfirmed ? (
                  editing ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-end">
                      <Button
                        size="small"
                        onClick={cancelPlanningEdit}
                        disabled={busy}
                        sx={{ color: color.ink }}
                      >
                        Cancelar edición
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Save />}
                        onClick={() => void savePlanningChanges()}
                        disabled={busy}
                      >
                        Guardar cambios
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => setEditing(true)}
                      disabled={busy}
                      sx={{ color: brand.navy, borderColor: color.border }}
                    >
                      Editar planificación
                    </Button>
                  )
                ) : plannedStatus ? (
                  <StatusChip label={hasUnsavedChanges ? 'Sin guardar' : 'Guardada'} />
                ) : null
              }
            >
              <Typography sx={{ fontSize: 12.5, color: color.muted, mb: 1.5 }}>
                Acordá precio, horario y asignación.
              </Typography>
              {planning}
            </SectionCard>

            {summary}

            {isCancelled ? (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: color.sandDeep, border: '1px solid', borderColor: color.borderSoft, color: color.ink }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Block sx={{ fontSize: 16, mt: 0.2 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
                    Este viaje fue cancelado. La planificación quedó desactivada; podés reactivarlo si el cliente vuelve a confirmar.
                  </Typography>
                </Stack>
              </Box>
            ) : plannedStatus ? (
              confirmacionLista ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'success.light',
                  border: '1px solid',
                  borderColor: 'success.main',
                  color: 'success.main',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Lock sx={{ fontSize: 16, mt: 0.2 }} />
                  <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600 }}>
                    Confirmación habilitada: la seña está registrada y los recursos están disponibles.
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'warning.light',
                  border: '1px solid',
                  borderColor: 'warning.main',
                }}
              >
                <Typography sx={{ fontSize: typeScale.caption, fontWeight: 800, color: 'warning.dark', mb: 1 }}>
                  Para confirmar el viaje falta:
                </Typography>
                <Stack spacing={0.75}>
                  {motivosConfirmacion.map((motivo) => (
                    <Stack key={motivo.id} direction="row" spacing={1} alignItems="flex-start">
                      <ErrorOutline sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0, mt: 0.15 }} />
                      <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600, color: 'warning.dark' }}>
                        {motivo.texto}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              )
            ) : null}

            {!isFinalized && (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  {plannedStatus && (
                    <Button
                      variant="outlined"
                      startIcon={busy ? <CircularProgress size={16} /> : <Save />}
                      disabled={busy}
                      sx={{ color: brand.navy, borderColor: color.border, py: 1.1 }}
                      onClick={() =>
                        runAction(
                          () => api.updateRequest(request.id, planningPayload),
                          'Planificación tentativa guardada',
                        )
                      }
                    >
                      Guardar planificación tentativa
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button
                      variant="outlined"
                      startIcon={<Paid />}
                      disabled={busy}
                      sx={{ color: brand.navy, borderColor: color.border, py: 1.1 }}
                      onClick={() => setDialogOpen(true)}
                    >
                      Registrar seña
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={isCancelled ? <Undo /> : <Block />}
                    disabled={busy}
                    sx={
                      isCancelled
                        ? { color: brand.navy, borderColor: color.border, py: 1.1 }
                        : { color: color.red, borderColor: color.red, bgcolor: color.redSoft, py: 1.1, '&:hover': { borderColor: color.red, bgcolor: color.redSoft } }
                    }
                    onClick={() => {
                      if (isCancelled) {
                        runAction(
                          () => api.updateRequest(request.id, { status: 'Pendiente de seña', confirmed: false }),
                          'Viaje reactivado · ' + requestId,
                        )
                      } else {
                        setCancelOpen(true)
                      }
                    }}
                  >
                    {isCancelled ? 'Reactivar viaje' : 'Cancelar viaje'}
                  </Button>
                  {plannedStatus && (
                    <Tooltip title={!confirmacionLista && primerMotivoConfirmacion ? primerMotivoConfirmacion : ''} disableHoverListener={confirmacionLista}>
                      <span>
                        <Button
                          variant="contained"
                          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Check />}
                          disabled={busy || (isMobile ? !confirmacionLista : Boolean(driverId && vehicleId && !confirmacionLista))}
                          sx={{ py: 1.1 }}
                          onClick={() => {
                            if (!isMobile) setConfirmationAttempted(true)
                            if (!driverId || !vehicleId) return
                            void runAction(
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
                          }}
                        >
                          Confirmar viaje
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
                {plannedStatus && (
                  <Typography sx={{ fontSize: 12.5, color: color.muted, mt: 0.5 }}>
                    Guardar la planificación no confirma el viaje. La seña se registra por separado.
                  </Typography>
                )}
              </>
            )}
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
              if (hasUnsavedChanges) await api.updateRequest(request.id, planningPayload)
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
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ color: color.muted, '& svg': { fontSize: 16 } }}>
        <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', lineHeight: 1.4 }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: brand.navy, mt: 0.4 }}>{value}</Typography>
    </Box>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography sx={{ fontSize: 13.5, color: strong ? brand.navy : color.ink, fontWeight: strong ? 800 : 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: strong ? 800 : 700, color: strong ? brand.navy : color.inkStrong }}>
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
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: color.redSoft, color: color.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Block sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Cancelar viaje</Typography>
            <Typography sx={{ fontSize: 12.5, color: color.muted }}>{requestId}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: 13.5, color: color.inkStrong }}>
          ¿Estás seguro de cancelar el viaje {requestId}? El cliente dejará de verlo y se liberará la asignación de chofer y vehículo.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: color.ink }}>
          Volver
        </Button>
        <Button variant="contained" startIcon={<Block />} sx={{ bgcolor: color.red, '&:hover': { bgcolor: color.red } }} onClick={onConfirm}>
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
  const [date, setDate] = useState(getTodayISO)
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
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: color.blueSoft, color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paid sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: color.muted, fontWeight: 700 }}>{requestId} · {client}</Typography>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Registrar seña</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar"><Close fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, md: 3 }, pt: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color.amberSoft, border: '1px solid', borderColor: color.amber, mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.amberInk }}>Seña requerida</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.amberInk }}>{ars(depositRequired)}</Typography>
          </Stack>
        </Box>

        <Stack spacing={2}>
          <CampoTexto
            label="Importe recibido"
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
            <CampoSelect label="Concepto" size="small" value={concept} onChange={(e) => setConcept(e.target.value as 'Seña' | 'Saldo')}>
                <MenuItem value="Seña">Seña</MenuItem>
                <MenuItem value="Saldo">Saldo</MenuItem>
            </CampoSelect>
            <CampoSelect label="Medio" size="small" value={method} onChange={(e) => setMethod(e.target.value as 'Transferencia' | 'Efectivo')}>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
            </CampoSelect>
          </Stack>
          <CampoSelect label="Recibido por" size="small" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value as ReceivedBy)}>
              <MenuItem value="Administración">Administración</MenuItem>
              <MenuItem value="Chofer">Chofer</MenuItem>
          </CampoSelect>
          <CampoTexto label="Observaciones (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} size="small" autoComplete="off" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.5, md: 3 }, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: color.ink }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Check />} onClick={save}>Guardar seña</Button>
      </DialogActions>
    </Dialog>
  )
}