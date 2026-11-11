import { useEffect, useRef, useState } from 'react'
import { alpha, Box, Tooltip, Typography } from '@mui/material'
import { color, type } from '../design/tokens'
import { dayNumber, weekdayShort } from '../agendaDates'
import { formatShortPlace, joinParts } from '../format'
import { loadSettings } from '../settingsStore'
import { agendaBlockRange, type AgendaBlockRange } from '../pages/planificacionHorarios'
import type { RequestStatus, ShiftRequest } from '../types'

const HOUR_START = 7
const HOUR_END = 21
const MIN_START = HOUR_START * 60
const MIN_END = HOUR_END * 60
const GUTTER = 62
const ROW_H = 88
const COL_GAP = 6
const EDGE_GAP = 6
const CONTENT_H = (HOUR_END - HOUR_START) * ROW_H
const NOW_LINE_COLOR = '#F97316'
const NOW_LINE_WIDTH = 2
const NOW_DOT_SIZE = 8

export const ESTADOS_AGENDA = [
  { key: 'Pendiente de revisión', label: 'Pendiente de revisión', bg: color.blueSoft, border: color.border, ink: color.blue },
  { key: 'Pendiente de seña', label: 'Pendiente de seña', bg: color.amberSoft, border: color.amber, ink: color.amberInk },
  { key: 'Confirmada', label: 'Confirmada', bg: color.greenSoft, border: color.green, ink: color.green },
  { key: 'Finalizada', label: 'Finalizada', bg: color.sandDeep, border: color.border, ink: color.muted },
  { key: 'Cancelada', label: 'Cancelada', bg: color.redSoft, border: color.red, ink: color.red },
] as const

const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

interface Placed {
  trip: ShiftRequest
  lane: number
  cols: number
}

type Range = AgendaBlockRange

/**
 * Greedy lane packing for the overlapping trips of a single day.
 *
 * Los cancelados se empaquetan aparte: no reservan capacidad, así que no le
 * quitan ancho a los viajes que sí se hacen, pero tampoco se pisan entre ellos.
 * Se devuelven primero y `TripBlock` les baja el `zIndex` para que queden detrás.
 */
export function computeLanes(trips: ShiftRequest[], ranges: Map<string, Range>): Placed[] {
  const rangeOf = (trip: ShiftRequest): Range =>
    ranges.get(trip.id) ?? { start: trip.serviceRange[0], end: trip.serviceRange[1], complete: false }
  const cancelled = trips.filter((trip) => trip.status === 'Cancelada')
  const active = trips.filter((trip) => trip.status !== 'Cancelada')
  return [...packLanes(cancelled, rangeOf), ...packLanes(active, rangeOf)]
}

/** Reparte los viajes recibidos en carriles por clúster de superposición. */
function packLanes(trips: ShiftRequest[], rangeOf: (trip: ShiftRequest) => Range): Placed[] {
  const sorted = [...trips].sort((a, b) => toMin(rangeOf(a).start) - toMin(rangeOf(b).start))
  const clusters: ShiftRequest[][] = []
  let current: ShiftRequest[] = []
  let barrier = -1
  for (const trip of sorted) {
    const start = toMin(rangeOf(trip).start)
    if (current.length > 0 && start >= barrier) {
      clusters.push(current)
      current = []
    }
    current.push(trip)
    barrier = Math.max(barrier, toMin(rangeOf(trip).end))
  }
  if (current.length) clusters.push(current)

  const placed: Placed[] = []
  for (const cluster of clusters) {
    const lanes: ShiftRequest[][] = []
    const assignments: { trip: ShiftRequest; lane: number }[] = []
    for (const trip of cluster) {
      const start = toMin(rangeOf(trip).start)
      let lane = lanes.findIndex((l) => l.length === 0 || toMin(rangeOf(l[l.length - 1]).end) <= start)
      if (lane === -1) {
        lane = lanes.length
        lanes.push([])
      }
      lanes[lane].push(trip)
      assignments.push({ trip, lane })
    }
    const cols = Math.max(1, lanes.length)
    for (const assignment of assignments) placed.push({ trip: assignment.trip, lane: assignment.lane, cols })
  }
  return placed
}

const STATUS_STYLE: Record<string, (typeof ESTADOS_AGENDA)[number]> = Object.fromEntries(
  ESTADOS_AGENDA.map((status) => [status.key, status]),
)

function styleFor(status: RequestStatus) {
  return STATUS_STYLE[status] ?? STATUS_STYLE['Pendiente de seña']
}

function getAgendaTime(date: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type: part, value }) => [part, value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

/** Mapa vacío compartido para no crear uno nuevo en cada render. */
const NO_NAMES = new Map<string, string>()

/**
 * Resumen del viaje sin abrir el modal. Va en tres niveles: horario y estado,
 * a quién es, y con qué recursos se hace (con la ruta).
 */
function TripTooltip({
  trip,
  range,
  driverName,
  vehicleName,
}: {
  trip: ShiftRequest
  range: Range
  driverName?: string
  vehicleName?: string
}) {
  const status = styleFor(trip.status)
  const route = joinParts([formatShortPlace(trip.origin), formatShortPlace(trip.destination)], ' → ')
  const crew = joinParts([driverName, vehicleName])
  const arrival = trip.serviceRange[1]
  return (
    <Box sx={{ display: 'grid', gap: 0.4, minWidth: 180, maxWidth: 250 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.2,
            color: color.navy,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {range.complete ? `${range.start}–${range.end}` : range.start}
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: status.ink, whiteSpace: 'nowrap' }}>
          {trip.status}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: type.caption, fontWeight: 700, lineHeight: 1.3, color: color.navy }}>
        {trip.client}
      </Typography>
      <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: color.muted, fontVariantNumeric: 'tabular-nums' }}>
        {trip.id}
      </Typography>
      {crew && (
        <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: color.ink }}>{crew}</Typography>
      )}
      {route && (
        <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: color.ink }}>{route}</Typography>
      )}
      {arrival && (
        <Typography sx={{ fontSize: 11, lineHeight: 1.3, color: color.muted }}>
          Llegada estimada {arrival}
        </Typography>
      )}
    </Box>
  )
}

function TripBlock({
  trip,
  range,
  lane,
  cols,
  driverNameById,
  vehicleNameById,
  onOpen,
}: {
  trip: ShiftRequest
  range: Range
  lane: number
  cols: number
  driverNameById: Map<string, string>
  vehicleNameById: Map<string, string>
  onOpen: () => void
}) {
  const startMin = Math.max(MIN_START, Math.min(MIN_END, toMin(range.start)))
  const endMin = Math.max(MIN_START, Math.min(MIN_END, toMin(range.end)))
  const top = ((startMin - MIN_START) / 60) * ROW_H + 2
  const height = Math.max(30, ((endMin - startMin) / 60) * ROW_H)
  const style = styleFor(trip.status)
  const compact = height < 44
  const showDetails = height >= 110
  const showCrew = height >= 150
  const cancelled = trip.status === 'Cancelada'
  const origin = formatShortPlace(trip.origin)
  const destination = formatShortPlace(trip.destination)
  const driverName = trip.driverId ? driverNameById.get(trip.driverId) : undefined
  const vehicleName = trip.vehicleId ? vehicleNameById.get(trip.vehicleId) : undefined
  const crew = joinParts([driverName, vehicleName])
  // El fin solo se muestra con la planificación completa: si falta la llegada,
  // la carga o la descarga, queda únicamente el inicio.
  const timeLabel = range.complete ? `${range.start}–${range.end}` : range.start

  return (
    <Tooltip
      title={
        <TripTooltip trip={trip} range={range} driverName={driverName} vehicleName={vehicleName} />
      }
      enterDelay={400}
      disableTouchListener
      disableInteractive
      arrow
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: color.paper,
            color: color.navy,
            border: `1px solid ${color.border}`,
            p: 1.2,
            borderRadius: 1.5,
            boxShadow: '0 8px 24px rgba(19,43,74,0.12)',
            maxWidth: 280,
          },
        },
        arrow: { sx: { color: color.paper, '&::before': { border: `1px solid ${color.border}` } } },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        aria-label={`${trip.id} · ${trip.client} · ${timeLabel} · ${trip.status}`}
        sx={{
          position: 'absolute',
          left: `calc(${(lane * 100) / cols}% + ${lane === 0 ? EDGE_GAP : COL_GAP / 2}px)`,
          right: `calc(${((cols - 1 - lane) * 100) / cols}% + ${lane === cols - 1 ? EDGE_GAP : COL_GAP / 2}px)`,
          top,
          height,
          borderRadius: 1.5,
          border: `1px solid ${style.border}`,
          borderLeft: `3px solid ${style.border}`,
          bgcolor: style.bg,
          px: 0.6,
          py: compact ? '2px' : 0.6,
          display: compact ? 'flex' : undefined,
          flexDirection: compact ? 'column' : undefined,
          justifyContent: compact ? 'center' : 'flex-start',
          overflow: 'hidden',
          cursor: 'pointer',
          outline: 0,
          zIndex: cancelled ? 0 : 1,
          opacity: cancelled ? 0.75 : 1,
          transition: 'box-shadow 120ms, transform 120ms',
          '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 10px rgba(19,43,74,0.09)' },
          '&:focus-visible': { boxShadow: `0 0 0 2px ${color.orangeInk}` },
        }}
      >
        {compact ? (
          <Typography
            sx={{
              width: '100%',
              fontSize: 12,
              fontWeight: 700,
              color: color.navy,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              textDecoration: cancelled ? 'line-through' : 'none',
            }}
          >
            {`${range.start} · ${trip.client}`}
          </Typography>
        ) : (
          <>
            <Typography
              sx={{
                fontSize: cols > 1 ? 10 : 11,
                fontWeight: 800,
                letterSpacing: '0.02em',
                color: style.ink,
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {timeLabel}
            </Typography>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: color.navy,
                lineHeight: 1.35,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textDecoration: cancelled ? 'line-through' : 'none',
              }}
            >
              {trip.client}
            </Typography>
            {showDetails && (
              <>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: color.ink,
                    lineHeight: 1.4,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {trip.id}
                </Typography>
                {showCrew && crew && (
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: color.ink,
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {crew}
                  </Typography>
                )}
                <Box sx={{ overflow: 'hidden' }}>
                  {origin && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: color.ink,
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {origin}
                    </Typography>
                  )}
                  {destination && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: color.ink,
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {destination}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Tooltip>
  )
}

function DayColumn({
  trips,
  bufferMinutes,
  driverNameById,
  vehicleNameById,
  isToday,
  nowMinutes,
  onOpenTrip,
}: {
  trips: ShiftRequest[]
  bufferMinutes: number | null
  driverNameById: Map<string, string>
  vehicleNameById: Map<string, string>
  isToday: boolean
  nowMinutes?: number
  onOpenTrip: (trip: ShiftRequest) => void
}) {
  const ranges = new Map<string, Range>(
    trips.map((trip) => [trip.id, agendaBlockRange(trip, bufferMinutes)]),
  )
  const placed = computeLanes(trips, ranges)
  const nowPosition =
    nowMinutes !== undefined && nowMinutes >= MIN_START && nowMinutes <= MIN_END
      ? ((nowMinutes - MIN_START) / 60) * ROW_H
      : undefined
  return (
    <Box
      sx={{
        position: 'relative',
        height: CONTENT_H,
        overflow: 'hidden',
        borderLeft: `1px solid ${color.borderSoft}`,
        bgcolor: isToday ? alpha(color.navy, 0.015) : 'transparent',
      }}
    >
      {isToday && nowPosition !== undefined && (
        <>
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: nowPosition,
              bgcolor: (theme) => alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.04),
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: nowPosition,
              left: 0,
              right: 0,
              borderTop: `${NOW_LINE_WIDTH}px solid ${NOW_LINE_COLOR}`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: nowPosition,
              left: 0,
              width: NOW_DOT_SIZE,
              height: NOW_DOT_SIZE,
              borderRadius: '50%',
              bgcolor: NOW_LINE_COLOR,
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        </>
      )}
      {Array.from({ length: HOUR_END - HOUR_START - 1 }, (_, index) => (
        <Box
          key={`rule-${index}`}
          sx={{ position: 'absolute', left: 0, right: 0, top: (index + 1) * ROW_H, height: '1px', bgcolor: color.borderSoft }}
        />
      ))}
      {placed.map(({ trip, lane, cols }) => (
        <TripBlock
          key={trip.id}
          trip={trip}
          range={ranges.get(trip.id) ?? { start: trip.serviceRange[0], end: trip.serviceRange[1], complete: false }}
          lane={lane}
          cols={cols}
          driverNameById={driverNameById}
          vehicleNameById={vehicleNameById}
          onOpen={() => onOpenTrip(trip)}
        />
      ))}
    </Box>
  )
}

export function AgendaGrid({
  days,
  trips,
  today,
  now,
  fill,
  bufferMinutes = null,
  driverNameById = NO_NAMES,
  vehicleNameById = NO_NAMES,
  onOpenTrip,
}: {
  days: string[]
  trips: ShiftRequest[]
  today: string
  now?: Date
  /** El grid ocupa el alto disponible y hace scroll interno, con el encabezado fijo. */
  fill?: boolean
  /** Margen operativo configurado: extiende cada bloque hasta el fin real del trabajo. */
  bufferMinutes?: number | null
  /** Choferes por id, para mostrar quién hace cada viaje sin abrir el modal. */
  driverNameById?: Map<string, string>
  /** Vehículos por `vehicleId` (la PK que guarda la solicitud, no la patente). */
  vehicleNameById?: Map<string, string>
  onOpenTrip: (trip: ShiftRequest) => void
}) {
  const tripsByDay = new Map<string, ShiftRequest[]>()
  for (const trip of trips) {
    const bucket = tripsByDay.get(trip.date)
    if (bucket) bucket.push(trip)
    else tripsByDay.set(trip.date, [trip])
  }

  const columns = `repeat(${days.length}, minmax(0, 1fr))`

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [currentNow, setCurrentNow] = useState(() => now ?? new Date())
  const timezone = loadSettings().profile.timezone
  const agendaTime = getAgendaTime(currentNow, timezone)
  const nowMinutes = agendaTime.date === today ? agendaTime.minutes : undefined
  const scrollKey = `${days.join('|')}|${trips
    .map((trip) => `${trip.id}:${trip.serviceRange[0]}`)
    .join('|')}`
  const scrollReference = trips.length === 0 ? agendaTime.minutes : null

  useEffect(() => {
    setCurrentNow(now ?? new Date())
    const timer = window.setInterval(() => setCurrentNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [now])

  // Abre la grilla en el borde exacto de una hora: una hora antes del primer
  // viaje visible. El encabezado sticky
  // de los días vive dentro del contenedor que scrollea, así que su alto ya
  // está descontado: alinear la fila en `hourIndex * ROW_H` la deja justo
  // debajo del encabezado fijo, sin cortar ninguna fila de hora.
  useEffect(() => {
    const element = scrollRef.current
    if (!element || !fill) return
    const firstStart =
      trips.length > 0 ? Math.min(...trips.map((trip) => toMin(trip.serviceRange[0]))) : null
    const reference = firstStart ?? scrollReference ?? MIN_START
    const targetHour = Math.max(HOUR_START, Math.min(HOUR_END - 1, Math.floor(reference / 60) - 1))
    const top = (targetHour - HOUR_START) * ROW_H
    element.scrollTo({ top, behavior: 'smooth' })
  }, [fill, scrollKey, scrollReference])

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowX: 'auto',
        '& + [aria-hidden="true"]': { display: 'none' },
        ...(fill && { flex: 1, minHeight: 0, overflowY: 'auto' }),
      }}
    >
      <Box sx={{ minWidth: days.length === 1 ? 320 : 560 }}>
        {/* Encabezado: días */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER}px ${columns}`,
            bgcolor: color.sand,
            borderBottom: `1px solid ${color.border}`,
            ...(fill && { position: 'sticky', top: 0, zIndex: 2 }),
          }}
        >
          <Box />
          {days.map((day) => {
            const isToday = day === today
            return (
              <Box
                key={day}
                sx={{
                  py: 1,
                  px: 0.5,
                  borderLeft: `1px solid ${color.borderSoft}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.3,
                }}
              >
                <Typography sx={{ fontSize: type.micro - 1, fontWeight: 800, letterSpacing: '0.08em', color: color.muted, textTransform: 'uppercase' }}>
                  {weekdayShort(day)}
                </Typography>
                <Box
                  sx={{
                    minWidth: 26,
                    height: 26,
                    px: 0.6,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isToday ? color.navy : 'transparent',
                    color: isToday ? color.paper : color.navy,
                    fontSize: type.body,
                    fontWeight: 800,
                  }}
                >
                  {dayNumber(day)}
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* Cuerpo: eje horario + columnas. La tarjeta ya aporta el borde
            inferior, así que el grid no repite una segunda línea ahí. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER}px ${columns}`,
          }}
        >
          <Box sx={{ position: 'sticky', left: 0, zIndex: 1, height: CONTENT_H, bgcolor: color.paper }}>
            {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => {
              return (
                <Typography
                  key={index}
                  sx={{
                    position: 'absolute',
                    top: index * ROW_H,
                    left: 0,
                    width: GUTTER,
                    height: ROW_H,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: color.muted,
                    lineHeight: 1,
                    bgcolor: color.paper,
                    zIndex: 1,
                  }}
                >
                  {String(HOUR_START + index).padStart(2, '0')}:00
                </Typography>
              )
            })}
          </Box>
          {days.map((day) => (
            <DayColumn
              key={day}
              trips={tripsByDay.get(day) ?? []}
              bufferMinutes={bufferMinutes}
              driverNameById={driverNameById}
              vehicleNameById={vehicleNameById}
              isToday={day === today}
              nowMinutes={day === today ? nowMinutes : undefined}
              onOpenTrip={onOpenTrip}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
