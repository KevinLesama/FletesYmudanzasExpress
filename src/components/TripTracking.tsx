import { Box, Button, Stack, Typography } from '@mui/material'
import { Check, Inventory2, Schedule } from '@mui/icons-material'
import { color, motion, type } from '../design/tokens'
import { formatShortPlace, joinParts } from '../format'
import { PlaceMarker } from './PlaceMarker'
import { STAGES, groupUpdatesByDay, stageIndex } from '../tripUpdates'
import type { TripUpdate } from '../tripUpdates'
import type { ShiftRequest } from '../types'

export { STAGES, buildUpdates, stageIndex } from '../tripUpdates'
export type { TripUpdate } from '../tripUpdates'

const HERO = "'Manrope', sans-serif"

const canceledTone = (cancelled: boolean) => (cancelled ? color.red : color.green)

const hhmm = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '')

export function updatedAt(trip: ShiftRequest) {
  const lastIncident = trip.incidents?.[trip.incidents.length - 1]?.time
  const confirmed = trip.status === 'Confirmada' || trip.status === 'Finalizada'
  const realTime = confirmed ? hhmm(trip.finishedAt) || hhmm(trip.arrivedAt) : ''
  return realTime || hhmm(lastIncident) || trip.serviceRange[1]
}

export function TrackingHero({ trip }: { trip: ShiftRequest }) {
  const cancelled = trip.status === 'Cancelada'
  const finished = Boolean(trip.finishedAt)
  // La flecha sólo tiene sentido con origen y destino; si falta uno, queda el
  // nombre del cliente solo, sin flecha ni separador colgado.
  const route =
    trip.origin.barrio && trip.destination.barrio
      ? `${trip.origin.barrio} → ${trip.destination.barrio}`
      : ''
  const subtitle = joinParts([route, trip.client])
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
        {subtitle && (
          <Typography sx={{ fontSize: type.body, color: color.ink, mt: 0.5 }}>{subtitle}</Typography>
        )}
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
  // Separador por dia; el orden ya viene de buildUpdates (mas reciente primero).
  const rows = groupUpdatesByDay(updates)

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
        {rows.map((row, index) => {
          const last = index === rows.length - 1

          if (row.kind === 'day') {
            return (
              <Box
                key={row.key}
                sx={{ display: 'grid', gridTemplateColumns: '46px 12px minmax(0, 1fr)', columnGap: 1 }}
              >
                <Box />
                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  {/* La linea sigue de largo para no cortar el timeline. */}
                  {index > 0 && (
                    <Box
                      aria-hidden
                      sx={{ position: 'absolute', top: -4, bottom: -4, width: '2px', bgcolor: color.border }}
                    />
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: type.micro,
                    fontWeight: 800,
                    color: color.muted,
                    pt: index === 0 ? 0 : 0.75,
                    pb: 0.75,
                  }}
                >
                  {row.label}
                </Typography>
              </Box>
            )
          }

          const update = row.update
          return (
            <Box
              key={row.key}
              sx={{ display: 'grid', gridTemplateColumns: '46px 12px minmax(0, 1fr)', columnGap: 1 }}
            >
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
                {!last && (
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

              <Box sx={{ pb: last ? 0 : 1.75 }}>
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
          )
        })}
      </Box>
    </Box>
  )
}

/** Barrio visible sólo si la dirección corta no lo incluye ya. */
function barrioLine(place: ShiftRequest['origin'], short: string): string {
  const barrio = (place.barrio ?? '').trim()
  if (!barrio) return ''
  return short.toLowerCase().includes(barrio.toLowerCase()) ? '' : barrio
}

/**
 * Ritmo vertical de la tarjeta Recorrido. El punto se centra con la primera
 * línea de la dirección a partir del line-height del texto, no con un valor
 * fijo: si cambia el token tipográfico, sigue alineado.
 */
const ROUTE_DOT_SIZE = 8
const ROUTE_LINE_HEIGHT = 1.5
const ROUTE_LINE_PX = type.caption * ROUTE_LINE_HEIGHT
const ROUTE_DOT_TOP = (ROUTE_LINE_PX - ROUTE_DOT_SIZE) / 2
const ROUTE_GAP = 10

/**
 * Fila del recorrido: punto + texto. La columna del punto se estira con la
 * fila y dibuja el conector hasta el punto siguiente, así la línea acompaña
 * el alto real del texto (una o dos líneas).
 */
function RouteStop({
  kind,
  first,
  last,
  children,
}: {
  kind: 'origin' | 'destination'
  first?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  const lineSx = {
    position: 'absolute',
    left: (ROUTE_DOT_SIZE - 1) / 2,
    width: '1px',
    bgcolor: color.border,
  } as const

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', columnGap: 1.2 }}>
      <Box sx={{ position: 'relative', width: ROUTE_DOT_SIZE, alignSelf: 'stretch', flexShrink: 0 }}>
        {/* Tramo que llega desde el punto anterior (borde superior de la fila). */}
        {!first && <Box aria-hidden sx={{ ...lineSx, top: 0, height: ROUTE_DOT_TOP + ROUTE_DOT_SIZE / 2 }} />}
        <PlaceMarker
          kind={kind}
          size={ROUTE_DOT_SIZE}
          variant="dot"
          sx={{ position: 'absolute', top: ROUTE_DOT_TOP, left: 0 }}
        />
        {/* Tramo que baja hasta el borde inferior de la fila y sigue en la próxima. */}
        {!last && (
          <Box aria-hidden sx={{ ...lineSx, top: ROUTE_DOT_TOP + ROUTE_DOT_SIZE / 2, bottom: 0 }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1, pb: last ? 0 : `${ROUTE_GAP}px` }}>{children}</Box>
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
  const mapUrl = (place: typeof trip.origin) => {
    if (place.lat != null && place.lng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.address}, ${place.barrio}`)}`
  }
  const originMapUrl = mapUrl(trip.origin)
  const destinationMapUrl = mapUrl(trip.destination)
  const shortOrigin = formatShortPlace(trip.origin) || 'Origen sin dirección'
  const shortDestination = formatShortPlace(trip.destination) || 'Destino sin dirección'
  const originBarrio = barrioLine(trip.origin, shortOrigin)
  const destinationBarrio = barrioLine(trip.destination, shortDestination)
  const destinationDetail = joinParts([
    trip.destination.barrio,
    trip.destination.floor,
    trip.destination.elevator ? 'con ascensor' : 'sin ascensor',
  ])
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
            {vehicleName && (
              <Typography sx={{ fontSize: type.micro, color: color.muted }}>{vehicleName}</Typography>
            )}
          </Box>
        </Stack>
      </AsideCard>

      <AsideCard title="Recorrido" meta={trip.totalKm ? `${trip.totalKm} km total` : undefined}>
        <Stack spacing={1}>
          <Box>
            <RouteStop kind="origin" first>
              <Typography
                component="a"
                href={originMapUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'block',
                  fontSize: type.caption,
                  lineHeight: ROUTE_LINE_HEIGHT,
                  fontWeight: 700,
                  color: color.navy,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
                aria-label={`Abrir origen en Google Maps: ${trip.origin.address}`}
                title={trip.origin.address}
              >
                {shortOrigin}
              </Typography>
              {originBarrio && <Typography sx={{ fontSize: type.micro, color: color.muted }}>{originBarrio}</Typography>}
            </RouteStop>
            <RouteStop kind="destination" last>
              <Typography
                component="a"
                href={destinationMapUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'block',
                  fontSize: type.caption,
                  lineHeight: ROUTE_LINE_HEIGHT,
                  fontWeight: 700,
                  color: color.navy,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
                aria-label={`Abrir destino en Google Maps: ${trip.destination.address}`}
                title={trip.destination.address}
              >
                {shortDestination}
              </Typography>
              {destinationBarrio && <Typography sx={{ fontSize: type.micro, color: color.muted }}>{destinationBarrio}</Typography>}
            </RouteStop>
          </Box>

          {trip.estimatedKm != null && (
            <Stack
              direction="row"
              spacing={2}
              sx={{ pt: 1.2, borderTop: `1px solid ${color.borderSoft}`, flexWrap: 'wrap', rowGap: 1 }}
            >
              <Box>
                <Typography sx={{ fontSize: type.micro, fontWeight: 800, color: color.muted, letterSpacing: '0.06em' }}>IDA</Typography>
                <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.navy }}>{trip.estimatedKm} km</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: type.micro, fontWeight: 800, color: color.muted, letterSpacing: '0.06em' }}>TOTAL</Typography>
                <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.navy }}>{trip.totalKm ?? 0} km</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: type.micro, fontWeight: 800, color: color.muted, letterSpacing: '0.06em' }}>VIAJE</Typography>
                <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.navy }}>~{trip.etaMinutes ?? 0} min</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: type.micro, fontWeight: 800, color: color.muted, letterSpacing: '0.06em' }}>ESPERA</Typography>
                <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.navy }}>{trip.waitMinutes ?? 0} min</Typography>
              </Box>
            </Stack>
          )}
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
          <PlaceMarker kind="destination" size={16} lineHeight={type.caption * 1.5} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: type.caption, lineHeight: 1.5, fontWeight: 600, color: color.navy }} title={trip.destination.address}>
              {shortDestination}
            </Typography>
            {destinationDetail && (
              <Typography sx={{ fontSize: type.micro, color: color.muted }}>{destinationDetail}</Typography>
            )}
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
