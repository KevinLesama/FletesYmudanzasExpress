import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Badge, Box, Button, IconButton, Link, MenuItem, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Add, Tune } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EncabezadoPagina } from '../components/EncabezadoPagina'
import {
  AgendaToolbar,
  EMPTY_FILTERS,
  calendarMonthOf,
  countActiveFilters,
  driverFilterOptions,
  shiftMonth,
  statusFilterOptions,
  vehicleFilterOptions,
  type AgendaFilters,
  type AgendaView,
} from '../components/AgendaToolbar'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { CampoSelect } from '../components/FormFields'
import { MiniCalendar } from '../components/MiniCalendar'
import { StatusChip } from '../components/StatusChip'
import { MobileBottomSheet } from '../components/mobile/MobileBottomSheet'
import { MobileCard } from '../components/mobile/MobileCard'
import { MobileDayStrip } from '../components/mobile/MobileDayStrip'
import { MobileFilterSheet } from '../components/mobile/MobileFilterSheet'
import { MobileRouteSummary } from '../components/mobile/MobileRouteSummary'
import { wrapAnywhere } from '../components/mobile/mobileSx'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { R } from '../routes'
import { brand } from '../theme'
import { color } from '../design/tokens'
import { addDays, fmtDayMonth, getInitialAnchor, getInitialWeekStart, getTodayISO, workWeekDays } from '../agendaDates'
import { givenName, joinParts, formatShortPlace } from '../format'
import { countPendingReview, PENDING_DEPOSIT_STATUS, PENDING_REVIEW_STATUS } from '../requestMetrics'
import { loadSettings } from '../settingsStore'
import { currentUser } from '../supabase'
import type { ShiftRequest } from '../types'
import { isTripInProgress, useMapTrips } from '../useMapTrips'
import { agendaBlockRange } from './planificacionHorarios'

const summaryLinkSx = {
  color: color.navy,
  fontWeight: 700,
  fontSize: 'inherit',
  textDecoration: 'none',
  verticalAlign: 'baseline',
  cursor: 'pointer',
  '&:hover': { color: brand.orangeInk, textDecoration: 'underline' },
}

function getZonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)
  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '',
    month: parts.find((part) => part.type === 'month')?.value ?? '',
    day: parts.find((part) => part.type === 'day')?.value ?? '',
  }
}

function getTodayInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getZonedDateParts(date, timeZone)
  return `${year}-${month}-${day}`
}

function getMinutesInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

const AGENDA_STATE_KEY = 'fex_agenda_state'

interface AgendaNavigationState {
  anchor: string
  view: AgendaView
  filters: AgendaFilters
}

/**
 * Última fecha, vista y filtros usados. La agenda se va a `/planificacion` con
 * `window.location`, así que sin esto volver del detalle siempre recae en la
 * semana actual y pierde el filtro que estabas mirando.
 */
function readNavigationState(): AgendaNavigationState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(AGENDA_STATE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { anchor, view, filters } = parsed as Record<string, unknown>
    if (typeof anchor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return null
    if (view !== 'day' && view !== 'workWeek') return null
    if (!filters || typeof filters !== 'object') return null
    const { driver, vehicle, status } = filters as Record<string, unknown>
    if (typeof driver !== 'string' || typeof vehicle !== 'string' || typeof status !== 'string') return null
    return { anchor, view, filters: { driver, vehicle, status } }
  } catch (error) {
    console.error('No se pudo restaurar el estado de la agenda.', error)
    return null
  }
}

export function AgendaPage() {
  // Se lee una sola vez, antes del primer render, para no mostrar la semana
  // actual y saltar después a la guardada.
  const [restored] = useState(readNavigationState)
  const [anchor, setAnchor] = useState(() => restored?.anchor ?? getInitialAnchor(new Date()))
  const [view, setView] = useState<AgendaView>(restored?.view ?? 'workWeek')
  const [filters, setFilters] = useState<AgendaFilters>(() => restored?.filters ?? EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Mobile only: the filters and the month picker live in bottom sheets.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => calendarMonthOf(anchor))
  const [mapTripId, setMapTripId] = useState<string | null>(() => {
    try {
      return typeof window === 'undefined' ? null : window.sessionStorage.getItem('fex_map_trip_id')
    } catch (error) {
      console.error('No se pudo leer el viaje seleccionado del mapa.', error)
      return null
    }
  })
  const [now, setNow] = useState(() => new Date())
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const requestsState = useAsync(() => api.listRequests(), [])
  // El margen operativo vive en la base (`configuracion_sistema`), no en el
  // perfil local: la agenda tiene que bloquear el mismo tiempo que el backend.
  const settingsState = useAsync(() => api.getSystemSettings(), [])
  const bufferMinutes = settingsState.data?.operationalBufferMinutes ?? null
  const catalogState = useAsync(async () => {
    const [drivers, vehicles] = await Promise.all([api.listDrivers(), api.listVehicles()])
    return { drivers, vehicles }
  }, [])
  const allRequests = requestsState.data ?? []
  const drivers = catalogState.data?.drivers ?? []
  const vehicles = catalogState.data?.vehicles ?? []

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // Mantiene el estado de navegación en sessionStorage. Se guarda `view` (no
  // `effectiveView`) para que el mobile no pise la vista elegida en desktop.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(AGENDA_STATE_KEY, JSON.stringify({ anchor, view, filters }))
    } catch (error) {
      console.error('No se pudo guardar el estado de la agenda.', error)
    }
  }, [anchor, view, filters])

  // Los bloques muestran chofer y vehículo: mapas armados una sola vez en vez de
  // un `find` por tarjeta en cada render.
  const driverNameById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver.name])), [drivers])
  const vehicleNameById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.vehicleId, joinParts([vehicle.id, vehicle.type]) || vehicle.id])),
    [vehicles],
  )

  // Un filtro restaurado puede apuntar a un chofer o vehículo que ya no existe:
  // sin esto la agenda queda vacía y el select, en blanco, sin explicación.
  useEffect(() => {
    if (!catalogState.data) return
    setFilters((current) => {
      const driverOk = current.driver === 'all' || drivers.some((driver) => driver.id === current.driver)
      const vehicleOk = current.vehicle === 'all' || vehicles.some((vehicle) => vehicle.vehicleId === current.vehicle)
      const statusOk = current.status === 'all' || statusFilterOptions().some((option) => option.value === current.status)
      if (driverOk && vehicleOk && statusOk) return current
      return {
        driver: driverOk ? current.driver : 'all',
        vehicle: vehicleOk ? current.vehicle : 'all',
        status: statusOk ? current.status : 'all',
      }
    })
  }, [catalogState.data, drivers, vehicles])

  const selectMapTrip = (id: string | null) => {
    setMapTripId(id)
    try {
      if (id) window.sessionStorage.setItem('fex_map_trip_id', id)
      else window.sessionStorage.removeItem('fex_map_trip_id')
    } catch (error) {
      console.error('No se pudo guardar el viaje seleccionado del mapa.', error)
    }
  }

  // Five columns do not fit a phone: the day is the only view there.
  const effectiveView: AgendaView = isMobile ? 'day' : view
  const days = useMemo(
    () => (effectiveView === 'day' ? [anchor] : workWeekDays(anchor)),
    [anchor, effectiveView],
  )

  const trips = useMemo(
    () =>
      allRequests
        .filter(
          (trip) =>
            days.includes(trip.date) &&
            (filters.driver === 'all' || trip.driverId === filters.driver) &&
            (filters.vehicle === 'all' || trip.vehicleId === filters.vehicle) &&
            (filters.status === 'all' || trip.status === filters.status),
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.serviceRange[0].localeCompare(b.serviceRange[0])),
    [allRequests, days, filters],
  )

  const marked = useMemo(() => {
    const dates = new Set<string>()
    allRequests.filter((request) => request.status !== 'Cancelada').forEach((request) => dates.add(request.date))
    return dates
  }, [allRequests])

  // Same filter options and same active count as the desktop toolbar.
  const activeFilters = countActiveFilters(filters)
  const driverOptions = useMemo(() => driverFilterOptions(drivers), [drivers])
  const vehicleOptions = useMemo(() => vehicleFilterOptions(vehicles), [vehicles])
  const statusOptions = useMemo(() => statusFilterOptions(), [])

  const shift = (direction: -1 | 1) => {
    setAnchor(addDays(anchor, direction * (effectiveView === 'day' ? 1 : 7)))
  }

  // Mobile week strip: always moves a full week, keeping the weekday.
  const shiftWeek = (direction: -1 | 1) => {
    setAnchor(addDays(anchor, direction * 7))
  }

  const handleToday = () => {
    if (effectiveView === 'day') {
      setAnchor(getTodayISO())
    } else {
      setAnchor(getInitialWeekStart(new Date()))
    }
  }

  const openMonthPicker = () => {
    setCalendarMonth(calendarMonthOf(anchor))
    setMonthOpen(true)
  }

  const pickMonthDate = (date: string) => {
    setAnchor(date)
    setMonthOpen(false)
  }

  const user = currentUser()
  const profile = useMemo(() => loadSettings().profile, [])
  const selected = allRequests.find((request) => request.id === selectedId) ?? null
  const today = useMemo(() => getTodayInTimeZone(now, profile.timezone), [now, profile.timezone])
  const { trips: upcomingMapTrips } = useMapTrips(
    allRequests,
    { driver: filters.driver, vehicle: filters.vehicle, status: filters.status },
    today,
    bufferMinutes,
  )
  const selectedMapTrip = mapTripId ? allRequests.find((request) => request.id === mapTripId) ?? null : null
  const mapTrips = selectedMapTrip ? [selectedMapTrip] : upcomingMapTrips
  const mapChoice = selectedMapTrip ?? upcomingMapTrips[0] ?? null
  const selectedDriverName = selected?.driverId ? drivers.find((driver) => driver.id === selected.driverId)?.name : undefined
  const selectedVehicle = selected?.vehicleId
    ? vehicles.find((vehicle) => vehicle.vehicleId === selected.vehicleId)
    : undefined
  const selectedVehicleName = selectedVehicle
    ? joinParts([selectedVehicle.type, selectedVehicle.id]) || undefined
    : undefined

  // Mobile cards reuse the same read-only lookups as the desktop modal.
  const driverNameFor = (trip: ShiftRequest) =>
    trip.driverId ? drivers.find((driver) => driver.id === trip.driverId)?.name : undefined
  const vehicleFor = (trip: ShiftRequest) => {
    if (!trip.vehicleId) return undefined
    return vehicles.find((item) => item.vehicleId === trip.vehicleId)
  }

  // El nombre de pila sale del perfil local (el mismo que alimenta la foto y el
  // menú superior). `usuarios.nombre` de una cuenta compartida trae el rol
  // ("Administración"), que no sirve para saludar.
  const firstName = givenName(profile.name || user?.nombre)
  const agendaDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: profile.timezone,
      }).format(now).toUpperCase(),
    [now, profile.timezone],
  )

  const salutation = useMemo(() => {
    const minutes = getMinutesInTimeZone(now, profile.timezone)
    if (minutes >= 7 * 60 && minutes < 12 * 60) return 'Buenos días'
    if (minutes >= 12 * 60 && minutes <= 19 * 60 + 30) return 'Buenas tardes'
    return 'Buenas noches'
  }, [now, profile.timezone])

  const greeting = firstName ? `${salutation}, ${firstName}` : salutation

  const todayTrips = useMemo(
    () =>
      allRequests.filter(
        (request) =>
          request.date === today &&
          (request.status === 'Confirmada' || request.status === 'Pendiente de seña'),
      ),
    [allRequests, today],
  )
  const pendingReviewCount = useMemo(() => countPendingReview(allRequests), [allRequests])
  const reviewHref = `${R.solicitudes}?estado=${encodeURIComponent(PENDING_REVIEW_STATUS)}`
  const depositHref = `${R.solicitudes}?estado=${encodeURIComponent(PENDING_DEPOSIT_STATUS)}`
  const pendingDepositCount = useMemo(
    () => allRequests.filter((request) => request.status === PENDING_DEPOSIT_STATUS).length,
    [allRequests],
  )

  const openToday = () => {
    setView('day')
    setAnchor(today)
  }

  const summary = (
    <Box component="span">
      {todayTrips.length > 0 ? (
        <>
          Durante el trayecto del día tenés{' '}
          <Link component="button" type="button" onClick={openToday} aria-label="Ver los viajes de hoy" sx={summaryLinkSx}>
            {todayTrips.length} {todayTrips.length === 1 ? 'viaje' : 'viajes'}
          </Link>
        </>
      ) : (
        'Hoy no tenés viajes agendados'
      )}
      {pendingReviewCount > 0 && todayTrips.length > 0 && (
        <>
          {' y '}
          <Link href={reviewHref} sx={summaryLinkSx}>
            {pendingReviewCount} {pendingReviewCount === 1 ? 'solicitud' : 'solicitudes'} por revisar
          </Link>
        </>
      )}
      .
      {pendingReviewCount > 0 && todayTrips.length === 0 && (
        <>
          {' '}
          <Link href={reviewHref} sx={summaryLinkSx}>
            {pendingReviewCount} {pendingReviewCount === 1 ? 'solicitud' : 'solicitudes'} por revisar.
          </Link>
        </>
      )}
      {pendingDepositCount > 0 && (
        <>
          {' '}
          <Link href={depositHref} sx={summaryLinkSx}>
            <Box component="span">
              {pendingDepositCount} {pendingDepositCount === 1 ? 'viaje espera' : 'viajes esperan'} la seña.
            </Box>
          </Link>
        </>
      )}
    </Box>
  )

  const showMobileCreateRequestAction = true
  const header = (
    <EncabezadoPagina
      kicker={agendaDateLabel}
      titulo={greeting}
      bajada={summary}
      tituloVisibleEnMobile
      compactoEnMobile
      accion={
        !isMobile && (
          <Button
            variant="contained"
            size="medium"
            startIcon={<Add />}
            href={R.nuevaSolicitud}
            sx={{ flexShrink: 0, bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          >
            Nueva solicitud
          </Button>
        )
      }
    />
  )

  const openTripDetail = (tripId: string) => {
    selectMapTrip(tripId)
    setSelectedId(tripId)
  }

  const tripIdFromTarget = (target: EventTarget): string | null => {
    if (!(target instanceof Element)) return null
    const label = target.closest('[role="button"][aria-label]')?.getAttribute('aria-label')
    return label?.split(' · ')[0] ?? null
  }

  const handleGridKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !event.shiftKey) return
    const tripId = tripIdFromTarget(event.target)
    if (!tripId || !allRequests.some((request) => request.id === tripId)) return
    event.preventDefault()
    event.stopPropagation()
    openTripDetail(tripId)
  }

  const handleGridDoubleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const tripId = tripIdFromTarget(event.target)
    if (!tripId || !allRequests.some((request) => request.id === tripId)) return
    event.preventDefault()
    openTripDetail(tripId)
  }

  return (
    <AppShell
      active="agenda"
      breadcrumb={[SECCION_BREADCRUMB, 'Agenda']}
      showMobileCreateRequestAction={showMobileCreateRequestAction}
      fill
      mapTrip={mapChoice}
      mapTrips={mapTrips}
      mapRequests={allRequests}
      mapRequestsLoading={requestsState.loading}
      mapReason={selectedMapTrip ? 'seleccionado' : mapChoice && isTripInProgress(mapChoice) ? 'en-curso' : mapChoice ? 'proximo' : null}
      onClearMapTrip={() => selectMapTrip(null)}
      onOpenMapTripDetail={(trip) => setSelectedId(trip.id)}
      header={header}
    >
      <Box
        sx={{
          bgcolor: color.paper,
          border: `1px solid ${color.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          minWidth: 0,
          ...(!isMobile && { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }),
        }}
      >
        {isMobile ? (
          <Box sx={{ px: 1.5, py: 1.5, borderBottom: `1px solid ${color.border}` }}>
            <MobileDayStrip
              value={anchor}
              marked={marked}
              todayISO={today}
              onSelect={setAnchor}
              onShift={shiftWeek}
              onToday={handleToday}
              onOpenMonth={openMonthPicker}
              trailing={
                <Badge badgeContent={activeFilters} color="secondary" overlap="circular">
                  <IconButton
                    aria-label={activeFilters > 0 ? `Filtros, ${activeFilters} activos` : 'Filtros'}
                    onClick={() => setFiltersOpen(true)}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      border: `1px solid ${activeFilters > 0 ? color.navy : color.border}`,
                      bgcolor: color.paper,
                      color: activeFilters > 0 ? color.navy : color.muted,
                    }}
                  >
                    <Tune />
                  </IconButton>
                </Badge>
              }
            />
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${color.border}` }}>
            <AgendaToolbar
              view={effectiveView}
              onViewChange={setView}
              days={days}
              anchor={anchor}
              marked={marked}
              onSelectDate={setAnchor}
              onShift={shift}
              onToday={handleToday}
              filters={filters}
              onFiltersChange={setFilters}
              drivers={drivers}
              vehicles={vehicles}
              showViewSwitch={!isMobile}
              showLegend={!isMobile}
            />
          </Box>
        )}

        {requestsState.loading ? (
          <Box sx={{ p: 3 }}>
            <LoadingState label="Cargando agenda..." />
          </Box>
        ) : requestsState.error ? (
          <Box sx={{ p: 3 }}>
            <ErrorState message={requestsState.error} onRetry={requestsState.reload} />
          </Box>
        ) : trips.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              title="No hay viajes para estos filtros"
              subtext="Probá con otra selección o movete a otra fecha para ver los viajes cargados."
            />
          </Box>
        ) : isMobile ? (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: color.inkStrong }}>
              {fmtDayMonth(anchor).replace(/^./, (letter) => letter.toLocaleUpperCase('es-AR'))} · {trips.length}{' '}
              {trips.length === 1 ? 'viaje' : 'viajes'}
            </Typography>
            {trips.map((trip) => {
              const vehicle = vehicleFor(trip)
              const crew = joinParts([driverNameFor(trip), vehicle?.type])
              const range = agendaBlockRange(trip, bufferMinutes)
              return (
                <MobileCard
                  key={trip.id}
                  onClick={() => openTripDetail(trip.id)}
                  header={
                    <>
                      <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2, color: color.navy }}>
                        {range.complete ? `${range.start}–${range.end}` : range.start}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <StatusChip label={trip.status} />
                    </>
                  }
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: color.navy, ...wrapAnywhere }}
                    >
                      {trip.client}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: color.muted }}>{trip.id}</Typography>
                    <MobileRouteSummary
                      origin={formatShortPlace(trip.origin)}
                      destination={formatShortPlace(trip.destination)}
                      crew={crew || undefined}
                      plate={vehicle?.id}
                    />
                  </Box>
                </MobileCard>
              )
            })}
          </Stack>
        ) : (
          <Box
            sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
            onDoubleClickCapture={handleGridDoubleClickCapture}
            onKeyDownCapture={handleGridKeyDownCapture}
          >
            <AgendaGrid
              days={days}
              trips={trips}
              today={today}
              now={now}
              fill
              bufferMinutes={bufferMinutes}
              driverNameById={driverNameById}
              vehicleNameById={vehicleNameById}
              onOpenTrip={(trip) => openTripDetail(trip.id)}
            />
          </Box>
        )}
      </Box>

      {isMobile && (
        <>
          <MobileFilterSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            onClear={() => setFilters(EMPTY_FILTERS)}
            activeCount={activeFilters}
            resultLabel={`Ver ${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'}`}
          >
            <CampoSelect
              label="Chofer"
              value={filters.driver}
              onChange={(e) => setFilters({ ...filters, driver: e.target.value })}
            >
              {driverOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </CampoSelect>
            <CampoSelect
              label="Vehículo"
              value={filters.vehicle}
              onChange={(e) => setFilters({ ...filters, vehicle: e.target.value })}
            >
              {vehicleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </CampoSelect>
            <CampoSelect
              label="Estado"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </CampoSelect>
          </MobileFilterSheet>

          <MobileBottomSheet open={monthOpen} onClose={() => setMonthOpen(false)} title="Elegir fecha">
            <MiniCalendar
              year={calendarMonth.year}
              month={calendarMonth.month}
              selected={anchor}
              marked={marked}
              onSelect={pickMonthDate}
              onPrevMonth={() => setCalendarMonth((current) => shiftMonth(current, -1))}
              onNextMonth={() => setCalendarMonth((current) => shiftMonth(current, 1))}
            />
          </MobileBottomSheet>
        </>
      )}

      {selected && (
        <TripDetailModal
          trip={selected}
          role="admin"
          driverName={selectedDriverName}
          vehicleName={selectedVehicleName}
          bufferMinutes={bufferMinutes}
          onClose={() => setSelectedId(null)}
          onOpenPlan={() => {
            window.location.href = R.planificacion(selected.id)
          }}
        />
      )}
    </AppShell>
  )
}
