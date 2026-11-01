import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Box, Button, useMediaQuery, useTheme } from '@mui/material'
import { Add } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { AgendaToolbar, EMPTY_FILTERS, type AgendaFilters, type AgendaView } from '../components/AgendaToolbar'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { R } from '../routes'
import { brand } from '../theme'
import { color } from '../design/tokens'
import { DEMO_DATE } from '../format'
import { addDays, workWeekDays } from '../agendaDates'
import { loadSettings } from '../settingsStore'
import { tripForMap } from '../tripForMap'

export function AgendaPage() {
  const [anchor, setAnchor] = useState(DEMO_DATE)
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
  const timeZone = loadSettings().profile.timezone

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

  const selected = allRequests.find((request) => request.id === selectedId) ?? null
  const mapChoice = useMemo(
    () => tripForMap(allRequests, mapTripId, timeZone, now),
    [allRequests, mapTripId, timeZone, now],
  )
  const selectedDriverName = selected?.driverId ? drivers.find((driver) => driver.id === selected.driverId)?.name : undefined
  const selectedVehicleName = selected?.vehicleId
    ? `${selected.vehicleId} · ${vehicles.find((vehicle) => vehicle.id === selected.vehicleId)?.type ?? ''}`
    : undefined

  const tripCountLabel = `${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'}`

  const handleGridSelection = (tripId: string) => {
    selectMapTrip(mapTripId === tripId ? null : tripId)
  }

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
      title="Agenda de viajes"
      fill
      mapTrip={mapChoice?.trip}
      mapReason={mapChoice?.reason}
      onClearMapTrip={() => selectMapTrip(null)}
      onOpenMapTripDetail={() => {
        if (mapChoice) setSelectedId(mapChoice.trip.id)
      }}
      description={trips.length === 0 ? 'Sin viajes en la vista' : `${tripCountLabel} en la vista`}
      action={
        !isMobile ? (
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
            href={R.nuevaSolicitud}
          >
            Nueva solicitud
          </Button>
        ) : undefined
      }
    >
      {isMobile && (
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          sx={{ mb: 2, py: 1.2, bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          href={R.nuevaSolicitud}
        >
          Nueva solicitud
        </Button>
      )}

      <Box
        sx={{
          bgcolor: color.paper,
          border: `1px solid ${color.border}`,
          borderRadius: 3,
          overflow: 'hidden',
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
            onToday={() => setAnchor(DEMO_DATE)}
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
            sx={!isMobile ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}
            onDoubleClickCapture={handleGridDoubleClickCapture}
            onKeyDownCapture={handleGridKeyDownCapture}
          >
            <AgendaGrid
              days={days}
              trips={trips}
              today={DEMO_DATE}
              fill={!isMobile}
              onOpenTrip={(trip) => handleGridSelection(trip.id)}
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
