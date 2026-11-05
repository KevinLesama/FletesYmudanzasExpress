import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
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
  HelpOutline,
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
import { CancelDialog } from '../components/CancelDialog'
import { EtiquetaCampo, CampoSelect, CampoTexto } from '../components/FormFields'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { Toast, type ToastState } from '../components/Toast'
import { StatusChip } from '../components/StatusChip'
import { PlaceMarker } from '../components/PlaceMarker'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { R, useQuery } from '../routes'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars, fmtDate, fmtDateEs, dayName, formatShortAddress, joinParts, waLink } from '../format'
import { getTodayISO } from '../agendaDates'
import type { Availability, AvailabilityOptions, Driver, Quote, ReceivedBy, ShiftRequest, Vehicle } from '../types'
import { brand } from '../theme'
import { color, type as typeScale } from '../design/tokens'
import { motivosConfirmacionViaje } from './planificacionConfirmacion'
import { estimatedArrival, estimatedFinish, occupiedUntil } from './planificacionHorarios'
import {
  estadoCampoAsignacion,
  estiloOpcionPlanificacion,
  mensajeAgendaIncompleta,
  type EstadoAgenda,
  type EstadoCampoAsignacion,
} from './planificacionOpciones'
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

/**
 * Dos líneas del recorrido a partir de la dirección corta: la primera parte
 * (calle y número, o nombre del lugar) y el resto como localidad. El texto
 * completo queda en `full` para el tooltip.
 */
function placeLines(place: { address: string; barrio: string }): { street: string; locality: string; full: string } {
  const short = formatShortAddress(place.address, { locality: place.barrio })
  const full = place.address || place.barrio
  if (!short) return { street: '', locality: '', full }
  const [street, ...rest] = short.split(', ')
  return { street, locality: rest.join(', '), full }
}

/** Etiqueta visible de un vehículo: tipo, patente y capacidad, sin ids internos. */
function vehicleLabel(vehicle: Vehicle): string {
  return joinParts([
    vehicle.type,
    vehicle.id,
    vehicle.capacityKg ? `${vehicle.capacityKg} kg` : '',
  ])
}

function parseDownloadMinutes(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440 ? minutes : null
}

interface CampoAsignacionProps {
  label: string
  value: string
  onChange: (event: SelectChangeEvent<string>) => void
  estado: EstadoCampoAsignacion
  warningLines?: string[]
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
  estado,
  warningLines = [],
  disabled,
  error,
  helperText,
  children,
  renderValue,
}: CampoAsignacionProps) {
  const fieldId = useId()
  const tono = estado.tono
  const statusText = estado.texto
  const statusColor =
    tono === 'error'
      ? color.red
      : tono === 'advertencia'
        ? color.amberInk
        : tono === 'ok'
          ? color.green
          : color.muted

  return (
    <FormControl fullWidth error={error}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
        <EtiquetaCampo text={label} htmlFor={fieldId} />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, color: statusColor }}>
          {warningLines.length > 0 ? (
            <Tooltip
              title={
                <Stack spacing={0.5}>
                  {warningLines.map((warning) => <span key={warning}>{warning}</span>)}
                </Stack>
              }
              arrow
            >
              <HelpOutline sx={{ fontSize: 16, flexShrink: 0, cursor: 'help' }} />
            </Tooltip>
          ) : (
            <Box sx={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', bgcolor: tono === 'ok' ? color.green : tono === 'error' ? color.red : color.amber }} />
          )}
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
  // El margen operativo es lo que la agenda bloquea despues del fin del trabajo.
  // Si falla, la pantalla sigue mostrando el fin estimado sin la parte de agenda.
  const settingsState = useAsync(() => api.getSystemSettings(), [])
  const request = requestState.data
  const drivers: Driver[] = catalogState.data?.drivers ?? []
  const vehicles: Vehicle[] = catalogState.data?.vehicles ?? []
  const pageMapTrips = useMemo<ShiftRequest[]>(() => (request ? [request] : []), [request])
  const availableDrivers = useMemo(() => drivers.filter((driver) => driver.status === 'Activo'), [drivers])
  const availableVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.status === 'Disponible'), [vehicles])

  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [start, setStart] = useState('11:00')
  const [end, setEnd] = useState('')
  const [loadMinutes, setLoadMinutes] = useState('')
  const [downloadMinutes, setDownloadMinutes] = useState('')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [routeEstimateLoading, setRouteEstimateLoading] = useState(false)
  const [routeEstimateError, setRouteEstimateError] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmationAttempted, setConfirmationAttempted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [availabilityWarnings, setAvailabilityWarnings] = useState<string[]>([])
  const [availabilityResult, setAvailabilityResult] = useState<{ key: string; value: Availability } | null>(null)
  const [availabilityFailure, setAvailabilityFailure] = useState<{ key: string; message: string } | null>(null)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [optionsResult, setOptionsResult] = useState<{ key: string; value: AvailabilityOptions } | null>(null)
  const [optionsFailure, setOptionsFailure] = useState<{ key: string; message: string } | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const initializedRequestId = useRef<string | null>(null)

  const selectedDownloadMinutes = parseDownloadMinutes(downloadMinutes)
  const selectedLoadMinutes = parseDownloadMinutes(loadMinutes)
  const bufferMinutes = settingsState.data?.operationalBufferMinutes ?? null
  const finishEstimate = estimatedFinish(end, selectedDownloadMinutes)
  // Si hay llegada y descarga pero el calculo no devuelve hora, es porque cruza
  // la medianoche: conviene decirlo en vez de mostrar una hora falsa.
  const finishOverflowsMidnight = Boolean(end) && selectedDownloadMinutes != null && !finishEstimate
  const occupiedUntilEstimate = finishEstimate ? occupiedUntil(finishEstimate, bufferMinutes) : ''
  const scheduleVerificationMessage = mensajeAgendaIncompleta({
    loadMinutes: selectedLoadMinutes,
    downloadMinutes: selectedDownloadMinutes,
    startTime: start,
    arrivalTime: end,
  })
  const scheduleInputsComplete = scheduleVerificationMessage == null

  // Inicializa los campos editables sólo para el viaje actual. Las recargas
  // posteriores actualizan `request`, pero no deben pisar cambios locales.
  useEffect(() => {
    if (!request || request.id !== id || initializedRequestId.current === id) return
    initializedRequestId.current = id
    setDriverId(request.driverId ?? '')
    setVehicleId(request.vehicleId ?? '')
    setStart(request.serviceRange[0] || '11:00')
    setEnd(request.arrivalTimeConfirmed ? (request.serviceRange[1] || '') : '')
    setLoadMinutes(request.loadMinutesConfirmed && request.loadMinutes != null ? String(request.loadMinutes) : '')
    setDownloadMinutes(request.downloadMinutesConfirmed && request.downloadMinutes != null ? String(request.downloadMinutes) : '')
    setPrice(String(request.price ?? 0))
    setPriceTouched(Boolean(request.priceOverridden))
  }, [id, request])

  // Al cambiar de viaje se sale del modo edición.
  useEffect(() => {
    setEditing(false)
  }, [id])

  useEffect(() => {
    if (
      !request ||
      request.etaMinutes != null ||
      request.origin.lat == null ||
      request.origin.lng == null ||
      request.destination.lat == null ||
      request.destination.lng == null
    ) {
      setRouteEstimateLoading(false)
      setRouteEstimateError('')
      return
    }

    let cancelledRequest = false
    setRouteEstimateLoading(true)
    setRouteEstimateError('')
    api
      .estimateRequestRoute(request.id)
      .then(() => (cancelledRequest ? undefined : requestState.reload()))
      .catch((error: unknown) => {
        if (!cancelledRequest) {
          setRouteEstimateError(
            error instanceof Error ? error.message : 'No se pudo calcular el tiempo del recorrido.',
          )
        }
      })
      .finally(() => {
        if (!cancelledRequest) setRouteEstimateLoading(false)
      })

    return () => {
      cancelledRequest = true
    }
  }, [
    request?.id,
    request?.etaMinutes,
    request?.origin.lat,
    request?.origin.lng,
    request?.destination.lat,
    request?.destination.lng,
  ])

  useEffect(() => {
    if (!request || request.arrivalTimeConfirmed || end) return
    const estimated = estimatedArrival(
      start,
      parseDownloadMinutes(loadMinutes),
      request.etaMinutes,
    )
    if (estimated) setEnd(estimated)
  }, [request?.id, request?.arrivalTimeConfirmed, request?.etaMinutes, start, loadMinutes, end])

  // Cotizacion del backend con las tarifas del chofer elegido. Se recalcula al
  // cambiar chofer, tiempos o datos de recorrido; es solo una vista previa
  // hasta guardar. Sin todos los datos no hay cotizacion ni spinner infinito.
  useEffect(() => {
    if (
      !request ||
      !driverId ||
      request.estimatedKm == null ||
      selectedLoadMinutes == null ||
      selectedDownloadMinutes == null
    ) {
      setQuote(null)
      setQuoteError('')
      setQuoteLoading(false)
      return
    }
    let cancelledRequest = false
    setQuoteLoading(true)
    const timer = window.setTimeout(() => {
      api
        .quote(request.id, { driverId, loadMinutes: Number(loadMinutes) })
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
  }, [request?.id, request?.estimatedKm, request?.etaMinutes, driverId, loadMinutes, downloadMinutes])

  const availabilityKey = JSON.stringify([
    request?.id,
    request?.date,
    driverId,
    vehicleId,
    start,
    loadMinutes,
    end,
    downloadMinutes,
  ])
  const validServiceRange = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end
  const availabilityEligible = Boolean(
    request &&
      driverId &&
      vehicleId &&
      scheduleInputsComplete &&
      validServiceRange &&
      request.status !== 'Cancelada' &&
      request.status !== 'Finalizada',
  )
  const optionsKey = JSON.stringify([
    request?.id,
    request?.date,
    start,
    end,
    loadMinutes,
    downloadMinutes,
  ])

  useEffect(() => {
    if (
      !request ||
      !scheduleInputsComplete ||
      !/^\d{2}:\d{2}$/.test(start) ||
      request.status === 'Cancelada' ||
      request.status === 'Finalizada'
    ) {
      setOptionsLoading(false)
      setOptionsResult(null)
      setOptionsFailure(null)
      return
    }

    let cancelledRequest = false
    setOptionsLoading(true)
    setOptionsResult(null)
    setOptionsFailure(null)
    const timer = window.setTimeout(() => {
      api
        .availabilityOptions({
          date: request.date,
          start,
          end: end || undefined,
          loadMinutes: selectedLoadMinutes ?? undefined,
          downloadMinutes: selectedDownloadMinutes ?? undefined,
          exclude: request.id,
        })
        .then((value) => {
          if (!cancelledRequest) setOptionsResult({ key: optionsKey, value })
        })
        .catch((err) => {
          if (!cancelledRequest) {
            setOptionsFailure({
              key: optionsKey,
              message: err instanceof Error ? err.message : 'No pudimos verificar la agenda de las opciones.',
            })
          }
        })
        .finally(() => {
          if (!cancelledRequest) setOptionsLoading(false)
        })
    }, 250)

    return () => {
      cancelledRequest = true
      window.clearTimeout(timer)
    }
  }, [
    request?.id,
    request?.date,
    request?.status,
    optionsKey,
    start,
    end,
    selectedLoadMinutes,
    selectedDownloadMinutes,
    scheduleInputsComplete,
  ])

  useEffect(() => {
    if (!request || !availabilityEligible || selectedDownloadMinutes == null) {
      setAvailabilityLoading(false)
      setAvailabilityResult(null)
      setAvailabilityFailure(null)
      return
    }

    let cancelledRequest = false
    setAvailabilityLoading(true)
    setAvailabilityResult(null)
    setAvailabilityFailure(null)
    const timer = window.setTimeout(() => {
      api
        .availability({
          date: request.date,
          start,
          end,
          downloadMinutes: selectedDownloadMinutes,
          driver_id: driverId,
          vehicle_id: vehicleId,
          exclude: request.id,
        })
        .then((value) => {
          if (!cancelledRequest) setAvailabilityResult({ key: availabilityKey, value })
        })
        .catch((err) => {
          if (!cancelledRequest) {
            setAvailabilityFailure({
              key: availabilityKey,
              message: err instanceof Error ? err.message : 'No pudimos verificar la disponibilidad operativa.',
            })
          }
        })
        .finally(() => {
          if (!cancelledRequest) setAvailabilityLoading(false)
        })
    }, 250)

    return () => {
      cancelledRequest = true
      window.clearTimeout(timer)
    }
  }, [
    request?.id,
    request?.date,
    request?.status,
    availabilityKey,
    availabilityEligible,
    selectedDownloadMinutes,
    driverId,
    vehicleId,
    start,
    end,
  ])

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
  const collectedTotal = (request?.payments ?? []).reduce((total, payment) => total + payment.amount, 0)
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
    ...(end ? { service_to: end } : request?.arrivalTimeConfirmed ? { service_to: null } : {}),
    ...(loadMinutes !== ''
      ? { carga_min: Number(loadMinutes) }
      : request?.loadMinutesConfirmed
        ? { carga_min: null }
        : {}),
    price: Number(price || 0),
    ...(downloadMinutes !== ''
      ? { descarga_min: Number(downloadMinutes) }
      : request?.downloadMinutesConfirmed
        ? { descarga_min: null }
        : {}),
  }
  const hasUnsavedChanges =
    !!request &&
    (driverId !== (request.driverId ?? '') ||
      vehicleId !== (request.vehicleId ?? '') ||
      start !== (request.serviceRange[0] || '11:00') ||
      end !== (request.arrivalTimeConfirmed ? request.serviceRange[1] : '') ||
      selectedLoadMinutes !== (request.loadMinutes ?? null) ||
      Number(price || 0) !== Number(request.price ?? 0) ||
      selectedDownloadMinutes !== (request.downloadMinutes ?? null))

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
  const currentOptions = optionsResult?.key === optionsKey ? optionsResult.value : null
  const currentOptionsError = optionsFailure?.key === optionsKey ? optionsFailure.message : ''
  const currentAvailability = availabilityResult?.key === availabilityKey ? availabilityResult.value : null
  const currentAvailabilityError =
    availabilityFailure?.key === availabilityKey ? availabilityFailure.message : ''
  const agendaTerminal =
    request != null && (request.status === 'Cancelada' || request.status === 'Finalizada')
  const agendaVerificationPending =
    !agendaTerminal &&
    scheduleInputsComplete &&
    (optionsLoading || (!currentOptions && !currentOptionsError))
  const estadoAgenda: EstadoAgenda =
    agendaTerminal
      ? 'no-aplica'
      : !scheduleInputsComplete
        ? 'incompleta'
        : agendaVerificationPending
          ? 'verificando'
          : currentOptions?.scheduleVerified
            ? 'verificada'
            : 'error'
  const agendaVerificada = estadoAgenda === 'verificada'
  const selectedDriverAvailability = currentAvailability
  const selectedVehicleAvailability = currentAvailability
  const selectedDriverOption =
    currentOptions?.drivers.find((option) => option.resourceId === Number(driverId))
  const selectedVehicleOption =
    currentOptions?.vehicles.find((option) => option.resourceId === Number(vehicleId))
  const driverWarningLines =
    currentOptions?.scheduleVerified ? selectedDriverOption?.warnings ?? [] : []
  const vehicleWarningLines =
    currentOptions?.scheduleVerified ? selectedVehicleOption?.warnings ?? [] : []
  const driverIsAvailable =
    !scheduleInputsComplete
      ? null
      : availableDrivers.some((driver) => driver.id === driverId) &&
        (selectedDriverOption != null
          ? !selectedDriverOption.blocked
          : selectedDriverAvailability?.driverAvailable === true)
  const vehicleIsAvailable =
    !scheduleInputsComplete
      ? null
      : availableVehicles.some((vehicle) => vehicle.vehicleId === vehicleId) &&
        (selectedVehicleOption != null
          ? !selectedVehicleOption.blocked
          : selectedVehicleAvailability?.vehicleAvailable === true)
  const estadoDeRecurso = (opcionConocida: boolean): EstadoAgenda =>
    estadoAgenda === 'verificada' && !opcionConocida ? 'no-aplica' : estadoAgenda
  const driverEstado = estadoCampoAsignacion({
    asignado: Boolean(driverId),
    estadoAgenda: estadoDeRecurso(selectedDriverOption != null),
    bloqueada: selectedDriverOption?.blocked ?? false,
    tieneAdvertencias: driverWarningLines.length > 0,
  })
  const vehicleEstado = estadoCampoAsignacion({
    asignado: Boolean(vehicleId),
    estadoAgenda: estadoDeRecurso(selectedVehicleOption != null),
    bloqueada: selectedVehicleOption?.blocked ?? false,
    tieneAdvertencias: vehicleWarningLines.length > 0,
  })
  const availabilityConflicts = currentAvailability?.conflicts ?? []
  const availabilityCheckPending =
    availabilityEligible &&
    (availabilityLoading || (!currentAvailability && !currentAvailabilityError))
  const availabilityInputInvalid = Boolean(
    request && driverId && vehicleId && scheduleInputsComplete && !availabilityEligible,
  )
  const motivosConfirmacion = useMemo(
    () =>
      motivosConfirmacionViaje({
        cancelled: request?.status === 'Cancelada',
        driverId,
        vehicleId,
        loadMinutes: selectedLoadMinutes,
        downloadMinutes: selectedDownloadMinutes,
        arrivalTime: end,
        driverIsAvailable,
        vehicleIsAvailable,
        price: Number(price || 0),
        depositReceived,
        depositRequired,
      }),
    [
      request?.status,
      driverId,
      vehicleId,
      selectedLoadMinutes,
      selectedDownloadMinutes,
      end,
      driverIsAvailable,
      vehicleIsAvailable,
      price,
      depositReceived,
      depositRequired,
    ],
  )
  const faltaChofer = motivosConfirmacion.some((motivo) => motivo.campo === 'chofer')
  const faltaVehiculo = motivosConfirmacion.some((motivo) => motivo.campo === 'vehiculo')
  const primerMotivoConfirmacion =
    motivosConfirmacion[0]?.texto ||
    availabilityConflicts[0] ||
    (availabilityInputInvalid && 'Revisá la fecha, el horario y los tiempos de carga y descarga.') ||
    (availabilityCheckPending && 'Verificando disponibilidad operativa.') ||
    currentAvailabilityError
  const confirmacionLista =
    motivosConfirmacion.length === 0 &&
    availabilityConflicts.length === 0 &&
    !availabilityCheckPending &&
    !availabilityInputInvalid

  const driverOption = (d: Driver) => {
    const option = currentOptions?.drivers.find((item) => item.resourceId === Number(d.id))
    const blocked = currentOptions?.scheduleVerified === true && option?.blocked === true
    const provisional = currentOptions?.scheduleVerified === true && (option?.warnings.length ?? 0) > 0
    const style = estiloOpcionPlanificacion({
      operativa: d.status === 'Activo',
      bloqueada: blocked,
      tieneAdvertencias: provisional,
    })
    return (
      <MenuItem value={d.id} key={d.id} disabled={style.disabled}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Person sx={{ fontSize: 16, color: color.muted }} />
          <Box component="span" sx={{ fontWeight: 700, color: style.color }}>
            {d.name}
          </Box>
        </Stack>
      </MenuItem>
    )
  }

  const vehicleOption = (vehicle: Vehicle) => {
    const option = currentOptions?.vehicles.find((item) => item.resourceId === Number(vehicle.vehicleId))
    const blocked = currentOptions?.scheduleVerified === true && option?.blocked === true
    const provisional = currentOptions?.scheduleVerified === true && (option?.warnings.length ?? 0) > 0
    const style = estiloOpcionPlanificacion({
      operativa: vehicle.status === 'Disponible',
      bloqueada: blocked,
      tieneAdvertencias: provisional,
    })
    return (
      <MenuItem value={vehicle.vehicleId} key={vehicle.vehicleId} disabled={style.disabled}>
        <Box component="span" sx={{ fontWeight: 700, color: style.color }}>
          {vehicleLabel(vehicle)}
        </Box>
      </MenuItem>
    )
  }

  const requestId = request?.id ?? id
  const requestClient = request?.client ?? ''
  const requestPhone = request?.phone ?? ''
  const requestDate = request?.date ?? ''
  const requestOrigin = request?.origin
  const requestDestination = request?.destination

  const wa = waLink(
    requestPhone,
    `Hola ${requestClient}, te escribimos por tu viaje ${requestId} del ${fmtDateEs(requestDate)} · servicio ${(request?.serviceRange ?? ['', '']).join(' a ')}.`,
  )

  const runAction = async (fn: () => Promise<ShiftRequest | unknown>, successMessage: string) => {
    setBusy(true)
    try {
      const result = await fn()
      await requestState.reload()
      const updated = (result ?? {}) as Partial<ShiftRequest>
      setAvailabilityWarnings(updated.availabilityWarnings ?? [])
      if (updated.autoConfirmError) {
        setToast({ message: updated.autoConfirmError, tone: 'error' })
      } else if (updated.status === 'Confirmada' && request?.status !== 'Confirmada') {
        setToast({ message: `Viaje confirmado automáticamente · ${requestId}`, tone: 'success' })
      } else {
        setToast({ message: successMessage, tone: 'success' })
      }
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
      <AppShell active="solicitudes" breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación" mobileBackTo={R.solicitudes}>
        <Box sx={{ bgcolor: color.paper, border: '1px solid', borderColor: color.border, borderRadius: 3 }}>
          <LoadingState label="Cargando solicitud..." />
        </Box>
      </AppShell>
    )
  }

  if (requestState.error || !request) {
    return (
      <AppShell active="solicitudes" breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Detalle y planificación']} title="Detalle y planificación" mobileBackTo={R.solicitudes}>
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
    setEnd(request.arrivalTimeConfirmed ? request.serviceRange[1] : '')
    setLoadMinutes(request.loadMinutesConfirmed && request.loadMinutes != null ? String(request.loadMinutes) : '')
    setDownloadMinutes(request.downloadMinutesConfirmed && request.downloadMinutes != null ? String(request.downloadMinutes) : '')
    setPrice(String(request.price ?? 0))
    setPriceTouched(Boolean(request.priceOverridden))
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
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
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
          onChange={(e) => {
            const value = e.target.value
            setStart(value)
            setEnd(estimatedArrival(
              value,
              parseDownloadMinutes(loadMinutes),
              request.etaMinutes,
            ))
          }}
          disabled={!canEdit}
          autoComplete="off"
          fullWidth
          sx={{ '& .MuiOutlinedInput-root': { height: 48 } }}
        />
        <CampoTexto
          size="small"
          type="number"
          label="Carga (min)"
          value={loadMinutes}
          onChange={(e) => {
            const value = e.target.value.replace(/[^\d]/g, '')
            setLoadMinutes(value)
            setEnd(estimatedArrival(
              start,
              parseDownloadMinutes(value),
              request.etaMinutes,
            ))
          }}
          onBlur={() => {
            if (loadMinutes !== '') {
              const n = Math.min(Math.max(Number(loadMinutes), 0), 1440)
              setLoadMinutes(String(n))
            }
          }}
          disabled={!canEdit}
          inputProps={{ min: 0, max: 1440, step: 15 }}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': { whiteSpace: 'nowrap' },
            '& .MuiOutlinedInput-root': { height: 48 },
          }}
        />
        <CampoTexto
          size="small"
          type="time"
          label="Llegada estimada"
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
          label="Descarga estimada"
          value={downloadMinutes}
          onChange={(e) => setDownloadMinutes(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => {
            if (downloadMinutes !== '') {
              const n = Math.min(Math.max(Number(downloadMinutes), 0), 1440)
              setDownloadMinutes(String(n))
            }
          }}
          inputProps={{ min: 0, max: 1440, step: 1 }}
          disabled={!canEdit}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': { whiteSpace: 'nowrap' },
            '& .MuiOutlinedInput-root': { height: 48 },
          }}
        />
      </Box>

      {finishEstimate ? (
        <Typography sx={{ mt: 1, fontSize: 12.5, color: color.muted }}>
          Fin estimado del trabajo{' '}
          <Box component="span" sx={{ fontWeight: 800, color: color.ink }}>{finishEstimate}</Box>
          {occupiedUntilEstimate && (
            <>
              {' · '}Ocupa hasta{' '}
              <Box component="span" sx={{ fontWeight: 800, color: color.ink }}>{occupiedUntilEstimate}</Box>
              {' en la agenda'}
            </>
          )}
        </Typography>
      ) : finishOverflowsMidnight ? (
        <Typography sx={{ mt: 1, fontSize: 12.5, color: color.amberInk }}>
          El fin del trabajo pasa de medianoche.
        </Typography>
      ) : null}

      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        <CampoAsignacion
          label="Chofer"
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
          estado={driverEstado}
          warningLines={driverWarningLines}
          disabled={!canEdit || !agendaVerificada}
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
        <Tooltip title={selectedVehicle ? vehicleLabel(selectedVehicle) : ''} arrow>
          <Box sx={{ minWidth: 0 }}>
            <CampoAsignacion
              label="Vehículo"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              estado={vehicleEstado}
              warningLines={vehicleWarningLines}
              disabled={!canEdit || !agendaVerificada}
              error={confirmationAttempted && !vehicleId}
              helperText={confirmationAttempted && !vehicleId ? 'Elegí un vehículo.' : undefined}
              renderValue={(value) => {
                if (!value) return <Box component="span" sx={{ color: 'text.secondary' }}>Elegí un vehículo</Box>
                const vehicle = vehicleOptions.find((option) => option.vehicleId === value)
                return vehicle ? vehicleLabel(vehicle) : String(value)
              }}
            >
              <MenuItem value="" disabled>
                Elegí un vehículo
              </MenuItem>
              {vehicleOptions.map((vehicle) => vehicleOption(vehicle))}
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
        {driverId && hasDistance && (selectedLoadMinutes == null || selectedDownloadMinutes == null) && (
          <Typography sx={{ fontSize: 12.5, color: color.muted }}>
            Completá los tiempos de carga y descarga para calcular los costos.
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
        mobileBackTo={R.solicitudes}
        kicker="Solicitud"
        title={joinParts([requestId, 'Detalle y planificación'])}
        description={
          request
            ? `${dayName(requestDate)}, ${fmtDate(requestDate)} · Inicio ${request.serviceRange[0]} · Llegada estimada ${end || 'pendiente'}`
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

        {request.bloqueoConfirmacion && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: color.amber,
              bgcolor: color.amberSoft,
            }}
          >
            <ErrorOutline sx={{ fontSize: 18, color: color.amberInk, mt: '1px' }} />
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: color.amberInk }}>
                Confirmación bloqueada
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: color.amberInk }}>
                {request.bloqueoConfirmacion}
              </Typography>
            </Box>
          </Box>
        )}

        {plannedStatus && scheduleVerificationMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Agenda sin verificar</AlertTitle>
            {scheduleVerificationMessage}. Hasta que la agenda esté verificada no se puede asignar chofer ni vehículo.
          </Alert>
        )}

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
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: color.muted }}>INICIO · LLEGADA ESTIMADA</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.3 }}>
                      {request.serviceRange[0]} → {request.loadMinutesConfirmed
                        ? estimatedArrival(
                            request.serviceRange[0],
                            request.loadMinutes ?? null,
                            request.etaMinutes,
                            request.arrivalTimeConfirmed ? request.serviceRange[1] : '',
                          ) || 'Pendiente de ruta'
                        : 'Pendiente de planificación'}
                    </Typography>
                  </Box>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Recorrido" icon={<LocationOn sx={{ fontSize: 17 }} />} right={<Typography sx={{ fontSize: 12, color: color.muted }}>Buenos Aires</Typography>}>
              {requestOrigin && requestDestination && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', columnGap: 1.25 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <PlaceMarker kind="origin" size={18} />
                    <Box sx={{ width: 2, flex: 1, minHeight: 16, bgcolor: color.border }} />
                  </Box>
                  <RouteStopContent place={requestOrigin} title="ORIGEN" />
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <PlaceMarker kind="destination" size={18} />
                  </Box>
                  <RouteStopContent place={requestDestination} title="DESTINO" />
                </Box>
              )}

              <Divider sx={{ my: 1.6, borderColor: color.borderSoft }} />
              {hasDistance ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <RouteMetric icon={<RouteOutlined />} label="DISTANCIA IDA" value={`${request?.estimatedKm} km`} />
                  <RouteMetric icon={<RouteOutlined />} label="TOTAL (IDA Y VUELTA)" value={`${request?.totalKm ?? 0} km`} />
                  <RouteMetric
                    icon={<Schedule />}
                    label="VIAJE (IDA)"
                    value={
                      request?.etaMinutes != null
                        ? `~${request.etaMinutes} min`
                        : routeEstimateLoading
                          ? 'Calculando…'
                          : 'Pendiente'
                    }
                  />
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: color.amberInk }}>
                  Sin distancia calculada. La solicitud se cargó sin geolocalización, así que el recorrido no se puede cotizar automáticamente.
                </Typography>
              )}
              {routeEstimateError && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  {routeEstimateError}
                </Alert>
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

            {availabilityEligible && availabilityLoading && (
              <Alert severity="info">
                Verificando la agenda del chofer y del vehículo…
              </Alert>
            )}

            {currentAvailability && availabilityConflicts.length > 0 && (
              <Alert severity="error">
                <Stack spacing={0.5}>
                  {availabilityConflicts.map((conflict) => (
                    <Typography key={conflict} sx={{ fontSize: typeScale.caption }}>
                      {conflict}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}

            {currentAvailability?.warnings.length ? (
              <Alert severity="warning">
                <Stack spacing={0.5}>
                  {currentAvailability.warnings.map((warning) => (
                    <Typography key={warning} sx={{ fontSize: typeScale.caption }}>
                      {warning}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            {currentAvailability && availabilityConflicts.length === 0 && currentAvailability.warnings.length === 0 && (
              <Alert severity="success">Chofer y vehículo disponibles para este horario.</Alert>
            )}

            {currentAvailabilityError && (
              <Alert severity="warning">
                {currentAvailabilityError} La confirmación volverá a validar la agenda en el servidor.
              </Alert>
            )}

            {optionsLoading && scheduleInputsComplete && !currentOptions && (
              <Alert severity="info">
                Verificando disponibilidad de choferes y vehículos para este horario…
              </Alert>
            )}

            {currentOptionsError && (
              <Alert severity="warning">
                {currentOptionsError} La confirmación volverá a validar la agenda en el servidor.
              </Alert>
            )}

            {scheduleInputsComplete && availabilityWarnings.length > 0 && (
              <Alert severity="warning">
                <Stack spacing={0.5}>
                  {availabilityWarnings.map((warning) => (
                    <Typography key={warning} sx={{ fontSize: typeScale.caption }}>
                      {warning}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}

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
              confirmacionLista && !currentAvailabilityError ? (
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
                  {availabilityConflicts.map((conflict) => (
                    <Stack key={conflict} direction="row" spacing={1} alignItems="flex-start">
                      <ErrorOutline sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0, mt: 0.15 }} />
                      <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600, color: 'warning.dark' }}>
                        {conflict}
                      </Typography>
                    </Stack>
                  ))}
                  {availabilityCheckPending && (
                    <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600, color: 'warning.dark' }}>
                      Verificando disponibilidad operativa.
                    </Typography>
                  )}
                  {availabilityInputInvalid && (
                    <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600, color: 'warning.dark' }}>
                      Revisá la fecha, el horario y el tiempo de descarga.
                    </Typography>
                  )}
                  {currentAvailabilityError && (
                    <Typography sx={{ fontSize: typeScale.caption, fontWeight: 600, color: 'warning.dark' }}>
                      No se pudo verificar la agenda. Podés intentar confirmar y el servidor la validará nuevamente.
                    </Typography>
                  )}
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
                  {!isCancelled && !isFinalized && (
                    <Button
                      variant="outlined"
                      startIcon={<Block />}
                      disabled={busy}
                      sx={{ color: color.red, borderColor: color.red, bgcolor: color.redSoft, py: 1.1, '&:hover': { borderColor: color.red, bgcolor: color.redSoft } }}
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancelar viaje
                    </Button>
                  )}
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
                              () => api.updateRequest(request.id, {
                                ...planningPayload,
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
        collected={collectedTotal}
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

function DepositDialog({
  open,
  onClose,
  requestId,
  client,
  depositRequired,
  price,
  received,
  collected,
  onSave,
}: {
  open: boolean
  onClose: () => void
  requestId: string
  client: string
  depositRequired: number
  price: number
  received: number
  collected: number
  onSave: (amount: number, date: string, concept: 'Seña' | 'Saldo', method: 'Transferencia' | 'Efectivo', receivedBy: ReceivedBy, notes?: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayISO)
  const [concept, setConcept] = useState<'Seña' | 'Saldo'>('Seña')
  const [method, setMethod] = useState<'Transferencia' | 'Efectivo'>('Transferencia')
  const [receivedBy, setReceivedBy] = useState<ReceivedBy>('Administración')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // Lo que falta cobrar según el concepto elegido. La seña se mide contra la
  // seña requerida; el saldo, contra el total del viaje menos todo lo cobrado.
  const faltaSena = Math.max(depositRequired - received, 0)
  const faltaSaldo = Math.max(price - collected, 0)
  const max = concept === 'Seña' ? faltaSena : faltaSaldo

  // Al abrir, el concepto arranca en lo que todavía se debe: seña si falta
  // seña, saldo si la seña ya está completa.
  useEffect(() => {
    if (!open) return
    setConcept(faltaSena > 0 ? 'Seña' : 'Saldo')
    setError(null)
  }, [open, faltaSena])

  // El importe arranca siempre en lo que falta del concepto elegido, nunca en
  // la seña completa: si ya se cobró una parte, no se vuelve a pedir entera.
  useEffect(() => {
    if (!open) return
    const cap = concept === 'Seña' ? faltaSena : faltaSaldo
    setAmount(cap > 0 ? String(cap) : '')
  }, [open, concept, faltaSena, faltaSaldo])

  const save = () => {
    const num = Number(amount || 0)
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
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.amberInk }}>Seña requerida</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.amberInk }}>{ars(depositRequired)}</Typography>
            </Stack>
            {received > 0 && (
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: color.amberInk }}>Ya registrado</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: color.amberInk }}>{ars(received)}</Typography>
              </Stack>
            )}
            <Divider sx={{ borderColor: color.amber, opacity: 0.5 }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.amberInk }}>
                {concept === 'Seña' ? 'Falta de seña' : 'Saldo pendiente'}
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.amberInk }}>{ars(max)}</Typography>
            </Stack>
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
            mensaje={error ?? (max <= 0 ? 'Ya está registrado el importe completo.' : undefined)}
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
        <Button variant="contained" startIcon={<Check />} onClick={save} disabled={max <= 0}>Guardar seña</Button>
      </DialogActions>
    </Dialog>
  )
}
