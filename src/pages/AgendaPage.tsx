import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Box, Button, IconButton, Link, useMediaQuery, useTheme } from '@mui/material'
import { Add } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EncabezadoPagina } from '../components/EncabezadoPagina'
import { AgendaToolbar, EMPTY_FILTERS, type AgendaFilters, type AgendaView } from '../components/AgendaToolbar'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { R } from '../routes'
import { brand } from '../theme'
import { color } from '../design/tokens'
import { addDays, getInitialAnchor, getInitialWeekStart, getTodayISO, workWeekDays } from '../agendaDates'
import { givenName, joinParts } from '../format'
import { countPendingReview, PENDING_REVIEW_STATUS } from '../requestMetrics'
import { loadSettings } from '../settingsStore'
import { currentUser } from '../supabase'
import type { ShiftRequest } from '../types'
import { isTripInProgress, useMapTrips } from '../useMapTrips'

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

export function AgendaPage() {
  const [anchor, setAnchor] = useState(() => getInitialAnchor(new Date()))
  const [view, setView] = useState<AgendaView>('workWeek')
  const [filters, setFilters] = useState<AgendaFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  const shift = (direction: -1 | 1) => {
    setAnchor(addDays(anchor, direction * (effectiveView === 'day' ? 1 : 7)))
  }

  const user = currentUser()
  const profile = useMemo(() => loadSettings().profile, [])
  const selected = allRequests.find((request) => request.id === selectedId) ?? null
  const today = useMemo(() => getTodayInTimeZone(now, profile.timezone), [now, profile.timezone])
  const { trips: upcomingMapTrips } = useMapTrips(
    allRequests,
    { driver: filters.driver, vehicle: filters.vehicle, status: filters.status },
    today,
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
  const depositHref = `${R.solicitudes}?estado=${encodeURIComponent('Pendiente de seña')}`
  const pendingDepositCount = useMemo(
    () => allRequests.filter((request) => request.status === 'Pendiente de seña').length,
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
          Durante el trayecto del día tenes{' '}
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

  const header = (
    <EncabezadoPagina
      kicker={agendaDateLabel}
      titulo={greeting}
      bajada={summary}
      accion={
        isMobile ? (
          <IconButton
            href={R.nuevaSolicitud}
            aria-label="Nueva solicitud"
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              bgcolor: brand.orangeStrong,
              color: 'common.white',
              '&:hover': { bgcolor: brand.orangeInk },
            }}
          >
            <Add />
          </IconButton>
        ) : (
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
        <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, borderBottom: `1px solid ${color.border}` }}>
          <AgendaToolbar
            view={effectiveView}
            onViewChange={setView}
            days={days}
            anchor={anchor}
            marked={marked}
            onSelectDate={setAnchor}
            onShift={shift}
            onToday={() => {
              if (effectiveView === 'day') {
                setAnchor(getTodayISO())
              } else {
                setAnchor(getInitialWeekStart(new Date()))
              }
            }}
            filters={filters}
            onFiltersChange={setFilters}
            drivers={drivers}
            vehicles={vehicles}
            showViewSwitch={!isMobile}
            showLegend={!isMobile}
          />
        </Box>

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
        ) : (
          <Box
            sx={!isMobile ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' } : { position: 'relative' }}
            onDoubleClickCapture={handleGridDoubleClickCapture}
            onKeyDownCapture={handleGridKeyDownCapture}
          >
            <AgendaGrid
              days={days}
              trips={trips}
              today={today}
              now={now}
              fill={!isMobile}
              onOpenTrip={(trip) => openTripDetail(trip.id)}
            />
          </Box>
        )}
      </Box>

      {selected && (
        <TripDetailModal
          trip={selected}
          role="admin"
          driverName={selectedDriverName}
          vehicleName={selectedVehicleName}
          onClose={() => setSelectedId(null)}
          onOpenPlan={() => {
            window.location.href = R.planificacion(selected.id)
          }}
        />
      )}
    </AppShell>
  )
}
