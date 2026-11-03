import { useMemo, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { ChevronRight, LocalShipping, SearchOff } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { DriverTripFlow } from '../components/DriverTripFlow'
import { PlaceMarker } from '../components/PlaceMarker'
import { Toast, type ToastState } from '../components/Toast'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { fmtDateEs, fmtLong, formatShortPlace, joinParts } from '../format'
import { getTodayISO } from '../agendaDates'
import { currentUser } from '../supabase'
import { loadDriverProgress, DRIVER_PHASES } from '../driverTripProgress'
import { color, radius, type as typeScale } from '../design/tokens'
import type { Driver, ShiftRequest } from '../types'

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function dateLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  if (date === shiftDate(today, 1)) return 'Mañana'
  return fmtDateEs(date)
}

function RouteRow({ kind, text }: { kind: 'origin' | 'destination'; text: string }) {
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
      <PlaceMarker kind={kind} size={13} lineHeight={typeScale.body * 1.45} />
      <Typography
        component="span"
        sx={{
          fontSize: typeScale.body,
          lineHeight: 1.45,
          fontWeight: 600,
          color: color.navy,
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </Typography>
    </Box>
  )
}

function TripCard({ trip, onOpen }: { trip: ShiftRequest; onOpen: () => void }) {
  const progress = loadDriverProgress(trip.id)
  const started = progress.originArrived || progress.loadedItems.length > 0 || progress.phase > 1

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      sx={{
        display: 'grid',
        gridTemplateColumns: '62px minmax(0, 1fr) auto',
        alignItems: 'start',
        gap: 1.5,
        width: '100%',
        p: { xs: 1.75, sm: 2 },
        textAlign: 'left',
        font: 'inherit',
        bgcolor: color.paper,
        border: `1px solid ${color.border}`,
        borderRadius: `${radius.md}px`,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, background-color 120ms ease',
        '&:hover': { borderColor: color.navy, bgcolor: color.sand },
        '&:focus-visible': { outline: `2px solid ${color.navy}`, outlineOffset: 2 },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          pr: 1.5,
          borderRight: `1px solid ${color.borderSoft}`,
        }}
      >
        <Typography component="span" sx={{ fontSize: typeScale.lead, fontWeight: 800, color: color.navy, lineHeight: 1.2 }}>
          {trip.serviceRange[0]}
        </Typography>
        <Typography component="span" sx={{ fontSize: typeScale.micro, fontWeight: 600, color: color.muted }}>
          a {trip.serviceRange[1]}
        </Typography>
      </Box>

      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="span" sx={{ fontSize: typeScale.micro, fontWeight: 800, letterSpacing: '0.05em', color: color.inkStrong }}>
            {trip.id}
          </Typography>
          {started && (
            <Box
              component="span"
              sx={{
                px: 0.9,
                py: 0.25,
                borderRadius: 999,
                bgcolor: color.amberSoft,
                color: color.amberInk,
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1.4,
              }}
            >
              En curso · {DRIVER_PHASES[progress.phase - 1]}
            </Box>
          )}
        </Box>

        <RouteRow kind="origin" text={formatShortPlace(trip.origin) || 'Origen sin dirección'} />
        <RouteRow kind="destination" text={formatShortPlace(trip.destination) || 'Destino sin dirección'} />

        <Typography component="span" sx={{ fontSize: typeScale.caption, color: color.muted }}>
          {joinParts([
            trip.client,
            trip.cargo.approxUnits ? `${trip.cargo.approxUnits} bultos` : '',
            trip.cargo.fragile ? 'Frágil' : '',
          ])}
        </Typography>
      </Box>

      <ChevronRight sx={{ fontSize: 20, color: color.mutedSoft, alignSelf: 'center' }} />
    </Box>
  )
}

export function ChoferPage() {
  const user = currentUser()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const driversState = useAsync(() => api.listDrivers(), [])
  const drivers: Driver[] = driversState.data ?? []
  const driver = drivers.find((d) => user?.email && d.email.toLowerCase() === user.email.toLowerCase())

  const tripsState = useAsync(
    () => (driver ? api.listRequests({ driver_id: driver.id }) : Promise.resolve([] as ShiftRequest[])),
    [driver?.id],
  )
  const vehiclesState = useAsync(() => api.listVehicles(), [])

  const confirmed = useMemo(
    () => (tripsState.data ?? []).filter((trip) => trip.status === 'Confirmada'),
    [tripsState.data],
  )

  const groups = useMemo(() => {
    const sorted = [...confirmed].sort(
      (a, b) => a.date.localeCompare(b.date) || a.serviceRange[0].localeCompare(b.serviceRange[0]),
    )
    const byDate = new Map<string, ShiftRequest[]>()
    sorted.forEach((trip) => {
      const list = byDate.get(trip.date) ?? []
      list.push(trip)
      byDate.set(trip.date, list)
    })
    return Array.from(byDate.entries())
  }, [confirmed])

  const selected = confirmed.find((trip) => trip.id === selectedId) ?? null
  const selectedVehicle = selected?.vehicleId
    ? (vehiclesState.data ?? []).find((vehicle) => vehicle.vehicleId === selected.vehicleId)
    : undefined
  const selectedVehicleName = selectedVehicle
    ? joinParts([selectedVehicle.type, selectedVehicle.id]) || undefined
    : undefined

  const today = getTodayISO()
  const subtitle = fmtLong(today)
  const loadingProfile = driversState.loading
  const profileMissing = !loadingProfile && !driversState.error && !driver

  return (
    <>
      <ChoferShell
        active="viajes"
        breadcrumb={selected ? ['Chofer', 'Viaje en curso'] : ['Chofer', 'Mis viajes']}
        title={selected ? 'Viaje en curso' : 'Mis viajes'}
        description={selected ? joinParts([selected.id, fmtLong(selected.date)]) : subtitle}
      >
        {selected ? (
          <DriverTripFlow
            trip={selected}
            vehicleName={selectedVehicleName}
            onClose={() => setSelectedId(null)}
            onFinished={async () => {
              await tripsState.reload()
              setSelectedId(null)
            }}
            onNotify={(message, tone) => setToast({ message, tone })}
          />
        ) : loadingProfile ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: `${radius.md}px` }}>
            <LoadingState label="Buscando tu legajo de chofer..." />
          </Box>
        ) : driversState.error ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: `${radius.md}px` }}>
            <ErrorState message={driversState.error} onRetry={driversState.reload} />
          </Box>
        ) : profileMissing ? (
          <Box
            sx={{
              bgcolor: color.paper,
              border: `1px solid ${color.border}`,
              borderRadius: `${radius.md}px`,
              textAlign: 'center',
              py: 5,
              px: 2.5,
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                mx: 'auto',
                mb: 1.5,
                borderRadius: '50%',
                bgcolor: color.sandDeep,
                color: color.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SearchOff />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: color.navy }}>
              No encontramos tu legajo de chofer
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 13.5, color: color.muted, maxWidth: 380, mx: 'auto' }}>
              Pedile a administración que revise que el email de tu legajo coincida con {user?.email ?? 'tu cuenta'}.
            </Typography>
            <Button variant="outlined" size="small" onClick={driversState.reload} sx={{ mt: 2, minHeight: 40, color: color.navy }}>
              Volver a intentar
            </Button>
          </Box>
        ) : tripsState.loading ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: `${radius.md}px` }}>
            <LoadingState label="Cargando viajes confirmados..." />
          </Box>
        ) : tripsState.error ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: `${radius.md}px` }}>
            <ErrorState message={tripsState.error} onRetry={tripsState.reload} />
          </Box>
        ) : confirmed.length === 0 ? (
          <Box sx={{ bgcolor: color.paper, border: `1px solid ${color.border}`, borderRadius: `${radius.md}px` }}>
            <EmptyState
              title="No tenés viajes confirmados"
              subtext="Cuando administración confirme un servicio y te lo asigne, va a aparecer acá con el recorrido y la carga."
            />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                p: 1.5,
                borderRadius: `${radius.md}px`,
                bgcolor: color.blueSoft,
                border: `1px solid ${color.border}`,
              }}
            >
              <LocalShipping sx={{ fontSize: 18, color: color.navy, mt: '1px' }} />
              <Box>
                <Typography sx={{ fontSize: typeScale.caption, fontWeight: 800, color: color.navy }}>
                  {confirmed.length === 1 ? '1 viaje confirmado' : `${confirmed.length} viajes confirmados`}
                </Typography>
                <Typography sx={{ fontSize: typeScale.caption, color: color.inkStrong }}>
                  Solo ves los servicios confirmados que tenés asignados. Abrí uno para iniciar el recorrido.
                </Typography>
              </Box>
            </Box>

            {groups.map(([date, dayTrips]) => (
              <Box component="section" key={date} aria-labelledby={`viajes-${date}`}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Typography
                    id={`viajes-${date}`}
                    component="h2"
                    sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: color.navy, textTransform: 'uppercase' }}
                  >
                    {dateLabel(date, today)}
                  </Typography>
                  <Typography sx={{ fontSize: typeScale.caption, color: color.muted }}>{fmtLong(date)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {dayTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} onOpen={() => setSelectedId(trip.id)} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </ChoferShell>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
