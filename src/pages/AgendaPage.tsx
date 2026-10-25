import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Add, ChevronLeft, ChevronRight } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { MiniCalendar } from '../components/MiniCalendar'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { R } from '../routes'
import { brand } from '../theme'
import { DEMO_DATE, fmtLong } from '../format'

const STATUS_OPTIONS = ['Confirmada', 'Pendiente de seña', 'Pendiente de revisión', 'Cancelada']

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function AgendaPage() {
  const [date, setDate] = useState(DEMO_DATE)
  const [driver, setDriver] = useState('all')
  const [vehicle, setVehicle] = useState('all')
  const [status, setStatus] = useState('all')
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

  const trips = useMemo(
    () =>
      allRequests
        .filter(
          (t) =>
            t.date === date &&
            (driver === 'all' || t.driverId === driver) &&
            (vehicle === 'all' || t.vehicleId === vehicle) &&
            (status === 'all' || t.status === status),
        )
        .sort((a, b) => a.serviceRange[0].localeCompare(b.serviceRange[0])),
    [allRequests, date, driver, vehicle, status],
  )

  const marked = useMemo(() => {
    const s = new Set<string>()
    allRequests.filter((r) => r.status !== 'Cancelada').forEach((r) => s.add(r.date))
    return s
  }, [allRequests])

  const [year, month] = useMemo(() => {
    const [y, m] = date.split('-').map(Number)
    return [y, (m ?? 1) - 1]
  }, [date])

  const shiftMonth = (delta: number) => {
    const dt = new Date(year, month + delta, 1)
    setDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`)
  }

  const selected = allRequests.find((r) => r.id === selectedId) ?? null
  const selectedDriverName = selected?.driverId ? drivers.find((d) => d.id === selected.driverId)?.name : undefined
  const selectedVehicleName = selected?.vehicleId
    ? `${selected.vehicleId} · ${vehicles.find((v) => v.id === selected.vehicleId)?.type ?? ''}`
    : undefined

  const filterSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
    id: string,
  ) => (
    <FormControl size="small" fullWidth>
      <InputLabel id={id} sx={{ fontSize: 13 }}>
        {label}
      </InputLabel>
      <Select labelId={id} label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ bgcolor: '#fff' }}>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )

  return (
    <AppShell
      active="agenda"
      breadcrumb={['Operación', 'Agenda']}
      title="Agenda de viajes"
      description={fmtLong(date)}
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
      {/* Barra de controles y filtros */}
      <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
            <IconButton size="small" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">
              <ChevronLeft fontSize="small" />
            </IconButton>
            <Button size="small" onClick={() => setDate(DEMO_DATE)} sx={{ fontSize: 12.5 }}>
              Hoy
            </Button>
            <IconButton size="small" onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente">
              <ChevronRight fontSize="small" />
            </IconButton>
            <Chip label={fmtLong(date)} sx={{ fontWeight: 700, bgcolor: '#FBF9F6', border: '1px solid #E9E6DF', ml: 0.5 }} />
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, flexGrow: 1 }}>
            {filterSelect('Chofer', driver, setDriver, [
              { value: 'all', label: 'Todos los choferes' },
              ...drivers.map((d) => ({ value: d.id, label: d.name })),
            ], 'agenda-filter-driver')}
            {filterSelect('Vehículo', vehicle, setVehicle, [
              { value: 'all', label: 'Todos los vehículos' },
              ...vehicles.map((v) => ({ value: v.id, label: `${v.id} · ${v.type}` })),
            ], 'agenda-filter-vehicle')}
            {filterSelect('Estado', status, setStatus, [
              { value: 'all', label: 'Todos los estados' },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
            ], 'agenda-filter-status')}
          </Box>
        </Stack>
      </Box>

      {isMobile && (
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          sx={{ mb: 2.5, py: 1.2, bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          href={R.nuevaSolicitud}
        >
          Nueva solicitud
        </Button>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px 1fr' }, gap: 2.5, alignItems: 'start' }}>
        {/* Panel izquierdo: calendario de navegación */}
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2.5 }}>
          <MiniCalendar
            year={year}
            month={month}
            selected={date}
            marked={marked}
            onSelect={setDate}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
          />
        </Box>

        {/* Panel derecho: grilla de planificación */}
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: { xs: 1.5, md: 2.5 } }}>
          {requestsState.loading ? (
            <LoadingState label="Cargando agenda..." />
          ) : requestsState.error ? (
            <ErrorState message={requestsState.error} onRetry={requestsState.reload} />
          ) : trips.length === 0 ? (
            <EmptyState
              title="No hay viajes para estos filtros"
              subtext="Probá con otra selección o cambiá la fecha para ver los viajes cargados."
            />
          ) : (
            <>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
                <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16 }}>
                  Planificación del día
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography sx={{ fontSize: 12, color: '#64707C' }}>{trips.length} viajes</Typography>
              </Stack>
              <AgendaGrid trips={trips} onOpenTrip={(t) => setSelectedId(t.id)} />
            </>
          )}
        </Box>
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