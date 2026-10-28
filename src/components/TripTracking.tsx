import { Box, Button, Stack, Typography } from '@mui/material'
import { Check, Inventory2, LocationOn, Schedule } from '@mui/icons-material'
import { color, motion, type } from '../design/tokens'
import { ars } from '../format'
import type { ShiftRequest } from '../types'

const HERO = "'Manrope', sans-serif"

/** Etapas del viaje. El índice activo se deriva de los datos que ya existen. */
export const STAGES = ['Solicitud', 'Seña', 'Confirmado', 'En viaje', 'Entregado'] as const

export function stageIndex(trip: ShiftRequest): number {
  if (trip.status === 'Cancelada') return 0
  // El estado es la fuente de verdad: hay datos de demo con marcas de llegada en
  // viajes que todavía no están confirmados, y no queremos que el stepper y el
  // estado se contradigan en la misma pantalla.
  if (trip.status !== 'Confirmada') return trip.status === 'Pendiente de seña' ? 1 : 0
  if (trip.finishedAt) return 4
  if (trip.arrivedAt) return 3
  return 2
}

const canceledTone = (cancelled: boolean) => (cancelled ? color.red : color.green)

const hhmm = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '')

/** Suma minutos a un 'HH:MM'. Placeholder hasta que exista un log real de eventos. */
function shiftTime(time: string, minutes: number) {
  const [hours, mins] = time.split(':').map(Number)
  const total = (hours * 60 + mins + minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export interface TripUpdate {
  id: string
  time: string
  title: string
  detail: string
  done: boolean
  alert?: boolean
  photo?: string
}

/**
 * Novedades del viaje. Las que tienen horario real (fin, llegada, incidentes,
 * pagos) usan ese horario; el resto se estima desde el inicio del servicio: es
 * una maqueta visual, no un log de eventos.
 */
export function buildUpdates(trip: ShiftRequest, driverName?: string, vehicleName?: string): TripUpdate[] {
  const serviceStart = trip.serviceRange[0]
  const updates: TripUpdate[] = []

  if (trip.status === 'Cancelada') {
    updates.push({
      id: 'cancelled',
      time: '—',
      title: 'Solicitud cancelada',
      detail: 'El viaje no se va a realizar.',
      done: true,
      alert: true,
    })
  }

  const confirmed = trip.status === 'Confirmada'

  if (confirmed && trip.finishedAt) {
    updates.push({
      id: 'finished',
      time: hhmm(trip.finishedAt),
      title: 'Entregado',
      detail: `Descarga terminada en ${trip.destination.address}, ${trip.destination.barrio}.`,
      done: true,
      photo: trip.remitoPhoto?.dataUrl,
    })
  }

  trip.incidents?.forEach((incident, index) => {
    updates.push({
      id: `incident-${index}`,
      time: hhmm(incident.time) || '—',
      title: incident.type,
      detail: incident.description,
      done: true,
      alert: true,
    })
  })

  if (confirmed && trip.arrivedAt) {
    updates.push({
      id: 'arrived',
      time: hhmm(trip.arrivedAt),
      title: 'Llegada al destino',
      detail: `El chofer llegó a ${trip.destination.barrio}.`,
      done: true,
    })
  }

  updates.push({
    id: 'departure',
    time: serviceStart,
    title: 'En viaje',
    detail: `Salida desde ${trip.origin.address}, ${trip.origin.barrio}.`,
    done: stageIndex(trip) >= 3,
  })

  updates.push({
    id: 'driver',
    time: shiftTime(serviceStart, -45),
    title: 'Chofer asignado',
    detail: driverName ? `${driverName} · ${vehicleName ?? 'sin vehículo asignado'}` : 'Todavía no hay chofer asignado.',
    done: Boolean(driverName),
  })

  updates.push({
    id: 'deposit',
    time: shiftTime(serviceStart, -90),
    title: trip.depositReceived > 0 ? 'Seña recibida' : 'Seña pendiente',
    detail: `${ars(trip.depositReceived)} de ${ars(trip.depositRequired)}.`,
    done: trip.depositReceived > 0,
  })

  updates.push({
    id: 'request',
    time: shiftTime(serviceStart, -150),
    title: 'Solicitud creada',
    detail: `${trip.client} pidió una mudanza desde ${trip.origin.barrio}.`,
    done: true,
  })

  return updates
}

export function updatedAt(trip: ShiftRequest) {
  const lastIncident = trip.incidents?.[trip.incidents.length - 1]?.time
  const confirmed = trip.status === 'Confirmada'
  const realTime = confirmed ? hhmm(trip.finishedAt) || hhmm(trip.arrivedAt) : ''
  return realTime || hhmm(lastIncident) || trip.serviceRange[1]
}

export function TrackingHero({ trip }: { trip: ShiftRequest }) {
  const cancelled = trip.status === 'Cancelada'
  const finished = Boolean(trip.finishedAt)
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
      spacing={{ xs: 1.5, sm: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id="trip-modal-title"
          sx={{
            fontFamily: HERO,
            fontWeight: 800,
            fontSize: { xs: 26, md: 32 },
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: color.navy,
          }}
        >
          {trip.status}
        </Typography>
        <Typography sx={{ fontSize: type.body, color: color.ink, mt: 0.5 }}>
          {trip.origin.barrio} → {trip.destination.barrio} · {trip.client}
        </Typography>
      </Box>

      <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, flexShrink: 0 }}>
        <Typography
          sx={{
            fontFamily: HERO,
            fontWeight: 800,
            fontSize: { xs: 30, md: 38 },
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: color.navy,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {trip.serviceRange[0]}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
          sx={{ mt: 0.5 }}
        >
          {finished ? (
            <Check sx={{ fontSize: 14, color: cancelled ? color.red : color.green }} />
          ) : (
            <Schedule sx={{ fontSize: 14, color: canceledTone(cancelled) }} />
          )}
          <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: canceledTone(cancelled) }}>
            Servicio {trip.serviceRange[0]}–{trip.serviceRange[1]}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

export function StatusStepper({ stage, cancelled }: { stage: number; cancelled?: boolean }) {
  const tone = cancelled ? color.red : color.green
  const progress = (stage / (STAGES.length - 1)) * 100

  return (
    <Box sx={{ mt: 2.5 }}>
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Typography sx={{ fontSize: type.caption, color: color.ink }}>
          Etapa {stage + 1} de {STAGES.length} ·{' '}
          <Box component="span" sx={{ fontWeight: 700, color: color.navy }}>
            {STAGES[stage]}
          </Box>
        </Typography>
      </Box>

      {/* Dots y etiquetas comparten los mismos centros: 10%, 30% … 90%. */}
      <Box sx={{ position: 'relative', mt: { xs: 1.5, sm: 0.5 }, mx: '10%' }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: '5px', height: '2px', bgcolor: color.border }} />
        <Box sx={{ position: 'absolute', left: 0, top: '5px', height: '2px', width: `${progress}%`, bgcolor: tone, transition: motion.base }} />
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
          {STAGES.map((stage_, index) => {
            const reached = index <= stage
            return (
              <Box
                key={stage_}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: reached ? tone : color.paper,
                  border: `1px solid ${reached ? tone : color.mutedSoft}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index < stage && <Check sx={{ fontSize: 9, color: color.paper }} />}
              </Box>
            )
          })}
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, mt: 1 }}>
        {STAGES.map((stage_, index) => (
          <Typography
            key={stage_}
            sx={{
              fontSize: type.micro,
              fontWeight: index <= stage ? 700 : 500,
              color: index <= stage ? color.navy : color.muted,
              textAlign: 'center',
            }}
          >
            {stage_}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export function UpdatesTimeline({
  updates,
  onRemoveRemito,
}: {
  updates: TripUpdate[]
  onRemoveRemito?: () => void
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: type.micro,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: color.muted,
          mb: 1.5,
        }}
      >
        Novedades
      </Typography>

      <Box>
        {updates.map((update, index) => (
          <Box key={update.id} sx={{ display: 'grid', gridTemplateColumns: '46px 12px minmax(0, 1fr)', columnGap: 1 }}>
            <Typography
              sx={{
                fontSize: type.micro,
                color: color.muted,
                pt: '1px',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
              }}
            >
              {update.time}
            </Typography>

            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              {index < updates.length - 1 && (
                <Box sx={{ position: 'absolute', top: 12, bottom: -4, width: '2px', bgcolor: color.border }} />
              )}
              <Box
                sx={{
                  position: 'relative',
                  width: 8,
                  height: 8,
                  mt: '5px',
                  borderRadius: '50%',
                  bgcolor: update.done ? (update.alert ? color.red : color.green) : color.paper,
                  border: `1.5px solid ${update.done ? (update.alert ? color.red : color.green) : color.mutedSoft}`,
                }}
              />
            </Box>

            <Box sx={{ pb: index < updates.length - 1 ? 1.75 : 0 }}>
              <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: update.alert ? color.red : color.navy }}>
                {update.title}
              </Typography>
              <Typography sx={{ fontSize: type.caption, color: color.ink, mt: 0.2 }}>{update.detail}</Typography>

              {update.photo && (
                <Box sx={{ mt: 1 }}>
                  <Box
                    component="img"
                    src={update.photo}
                    alt="Foto del remito"
                    sx={{
                      display: 'block',
                      width: '100%',
                      maxWidth: 200,
                      borderRadius: 2,
                      border: `1px solid ${color.borderSoft}`,
                      bgcolor: color.paper,
                    }}
                  />
                  {onRemoveRemito && (
                    <Button size="small" onClick={onRemoveRemito} sx={{ mt: 0.5, color: color.red, minWidth: 0, px: 0.5 }}>
                      Quitar foto
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function AsideCard({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: `1px solid ${color.border}`, borderRadius: 3, bgcolor: color.paper, p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
        <Typography sx={{ fontSize: type.caption, fontWeight: 800, color: color.navy }}>{title}</Typography>
        {meta && <Typography sx={{ fontSize: type.micro, color: color.muted }}>{meta}</Typography>}
      </Stack>
      {children}
    </Box>
  )
}

export function TrackingAside({
  trip,
  driverName,
  vehicleName,
  children,
}: {
  trip: ShiftRequest
  driverName?: string
  vehicleName?: string
  children?: React.ReactNode
}) {
  const initials = driverName
    ? driverName
        .split(' ')
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : ''

  return (
    <Stack spacing={1.5}>
      {children}

      <AsideCard title="Chofer">
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: driverName ? color.blueSoft : color.sandDeep,
              color: driverName ? color.navy : color.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: type.caption,
              fontWeight: 800,
            }}
          >
            {driverName ? initials : '—'}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.navy }}>
              {driverName ?? 'Sin chofer asignado'}
            </Typography>
            <Typography sx={{ fontSize: type.micro, color: color.muted }}>
              {vehicleName ?? 'Sin vehículo asignado'}
            </Typography>
          </Box>
        </Stack>
      </AsideCard>

      <AsideCard title="Carga" meta={`${trip.cargo.approxUnits} bultos`}>
        <Stack spacing={1}>
          {trip.cargo.items.map((item) => (
            <Stack key={item.name} direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  flexShrink: 0,
                  bgcolor: color.sand,
                  border: `1px solid ${color.borderSoft}`,
                  color: color.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Inventory2 sx={{ fontSize: 16 }} />
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontSize: type.caption, fontWeight: 600, color: color.navy }}>{item.name}</Typography>
                {item.note && <Typography sx={{ fontSize: type.micro, color: color.muted }}>{item.note}</Typography>}
              </Box>
              <Typography sx={{ fontSize: type.micro, fontWeight: 700, color: color.muted }}>×{item.units}</Typography>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={0.8} alignItems="flex-start" sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${color.borderSoft}` }}>
          <LocationOn sx={{ fontSize: 15, color: color.orangeInk, mt: '1px', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: type.caption, fontWeight: 600, color: color.navy }}>
              {trip.destination.address}
            </Typography>
            <Typography sx={{ fontSize: type.micro, color: color.muted }}>
              {trip.destination.barrio} · {trip.destination.floor}
              {trip.destination.elevator ? ' · con ascensor' : ' · sin ascensor'}
            </Typography>
          </Box>
        </Stack>
      </AsideCard>

      {trip.cargo.notes && (
        <AsideCard title="Nota del cliente">
          <Typography sx={{ fontSize: type.caption, color: color.ink }}>{trip.cargo.notes}</Typography>
        </AsideCard>
      )}
    </Stack>
  )
}
