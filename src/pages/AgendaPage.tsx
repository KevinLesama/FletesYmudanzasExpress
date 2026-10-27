import { useMemo, useState } from 'react'
import { Box, Button, useMediaQuery, useTheme } from '@mui/material'
import { Add } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
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

export function AgendaPage() {
  const [anchor, setAnchor] = useState(DEMO_DATE)
  const [view, setView] = useState<AgendaView>('workWeek')
  const [filters, setFilters] = useState<AgendaFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const selectedDriverName = selected?.driverId ? drivers.find((driver) => driver.id === selected.driverId)?.name : undefined
  const selectedVehicleName = selected?.vehicleId
    ? `${selected.vehicleId} · ${vehicles.find((vehicle) => vehicle.id === selected.vehicleId)?.type ?? ''}`
    : undefined

  const tripCountLabel = `${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'}`

  return (
    <AppShell
      active="agenda"
      breadcrumb={['Operación', 'Agenda']}
      title="Agenda de viajes"
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

      <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: 3, overflow: 'hidden' }}>
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
          <AgendaGrid days={days} trips={trips} today={DEMO_DATE} onOpenTrip={(trip) => setSelectedId(trip.id)} />
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
