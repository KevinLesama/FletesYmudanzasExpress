import { Box, Typography } from '@mui/material'
import { color, type } from '../design/tokens'
import { dayNumber, weekdayShort } from '../agendaDates'
import type { RequestStatus, ShiftRequest } from '../types'

const HOUR_START = 7
const HOUR_END = 19
const MIN_START = HOUR_START * 60
const MIN_END = HOUR_END * 60
const GUTTER = 62
const ROW_H = 68
const COL_GAP = 6
const EDGE_GAP = 6
const CONTENT_H = (HOUR_END - HOUR_START) * ROW_H

const toMin = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

interface Placed {
  trip: ShiftRequest
  lane: number
  cols: number
}

/** Greedy lane packing for the overlapping trips of a single day. */
function computeLanes(trips: ShiftRequest[]): Placed[] {
  const sorted = [...trips].sort((a, b) => toMin(a.serviceRange[0]) - toMin(b.serviceRange[0]))
  const clusters: ShiftRequest[][] = []
  let current: ShiftRequest[] = []
  let barrier = -1
  for (const trip of sorted) {
    const start = toMin(trip.serviceRange[0])
    if (current.length > 0 && start >= barrier) {
      clusters.push(current)
      current = []
    }
    current.push(trip)
    barrier = Math.max(barrier, toMin(trip.serviceRange[1]))
  }
  if (current.length) clusters.push(current)

  const placed: Placed[] = []
  for (const cluster of clusters) {
    const lanes: ShiftRequest[][] = []
    const assignments: { trip: ShiftRequest; lane: number }[] = []
    for (const trip of cluster) {
      const start = toMin(trip.serviceRange[0])
      let lane = lanes.findIndex((l) => l.length === 0 || toMin(l[l.length - 1].serviceRange[1]) <= start)
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

const STATUS_STYLE: Record<string, { bg: string; border: string; ink: string }> = {
  Confirmada: { bg: color.greenSoft, border: '#C9E3D2', ink: color.green },
  'Pendiente de seña': { bg: color.amberSoft, border: '#E9C98D', ink: color.amberInk },
  'Pendiente de revisión': { bg: color.blueSoft, border: '#D6E0F0', ink: color.blue },
  Cancelada: { bg: color.redSoft, border: '#EFCFC7', ink: color.red },
}

function styleFor(status: RequestStatus) {
  return STATUS_STYLE[status] ?? STATUS_STYLE['Pendiente de seña']
}

function TripBlock({ trip, lane, cols, onOpen }: { trip: ShiftRequest; lane: number; cols: number; onOpen: () => void }) {
  const startMin = Math.max(MIN_START, Math.min(MIN_END, toMin(trip.serviceRange[0])))
  const endMin = Math.max(MIN_START, Math.min(MIN_END, toMin(trip.serviceRange[1])))
  const top = ((startMin - MIN_START) / 60) * ROW_H + 2
  const height = Math.max(30, ((endMin - startMin) / 60) * ROW_H - 4)
  const style = styleFor(trip.status)
  const compact = height < 54
  const roomy = height >= 96 && cols === 1
  const cancelled = trip.status === 'Cancelada'

  return (
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
      aria-label={`${trip.id} · ${trip.client} · ${trip.serviceRange.join(' a ')} · ${trip.status}`}
      sx={{
        position: 'absolute',
        left: `calc(${(lane * 100) / cols}% + ${lane === 0 ? EDGE_GAP : COL_GAP / 2}px)`,
        right: `calc(${((cols - 1 - lane) * 100) / cols}% + ${lane === cols - 1 ? EDGE_GAP : COL_GAP / 2}px)`,
        top,
        height,
        borderRadius: 1.5,
        border: `1px solid ${style.border}`,
        bgcolor: style.bg,
        px: 0.6,
        py: 0.6,
        overflow: 'hidden',
        cursor: 'pointer',
        outline: 0,
        opacity: cancelled ? 0.75 : 1,
        transition: 'box-shadow 120ms, transform 120ms',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 10px rgba(19,43,74,0.09)' },
        '&:focus-visible': { boxShadow: `0 0 0 2px ${color.orangeInk}` },
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.02em',
          color: style.ink,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {cols === 1 ? `${trip.serviceRange[0]}–${trip.serviceRange[1]}` : trip.serviceRange[0]}
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
      {!compact && (
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
          {trip.id}
          {roomy ? ` · ${trip.origin.barrio} → ${trip.destination.barrio}` : ''}
        </Typography>
      )}
    </Box>
  )
}

function DayColumn({
  trips,
  isToday,
  onOpenTrip,
}: {
  trips: ShiftRequest[]
  isToday: boolean
  onOpenTrip: (trip: ShiftRequest) => void
}) {
  const placed = computeLanes(trips)
  return (
    <Box
      sx={{
        position: 'relative',
        height: CONTENT_H,
        borderLeft: `1px solid ${color.borderSoft}`,
        bgcolor: isToday ? 'rgba(19,43,74,0.015)' : 'transparent',
      }}
    >
      {Array.from({ length: HOUR_END - HOUR_START - 1 }, (_, index) => (
        <Box
          key={`rule-${index}`}
          sx={{ position: 'absolute', left: 0, right: 0, top: (index + 1) * ROW_H, height: '1px', bgcolor: color.borderSoft }}
        />
      ))}
      {placed.map(({ trip, lane, cols }) => (
        <TripBlock key={trip.id} trip={trip} lane={lane} cols={cols} onOpen={() => onOpenTrip(trip)} />
      ))}
    </Box>
  )
}

export function AgendaGrid({
  days,
  trips,
  today,
  fill,
  onOpenTrip,
}: {
  days: string[]
  trips: ShiftRequest[]
  today: string
  /** El grid ocupa el alto disponible y hace scroll interno, con el encabezado fijo. */
  fill?: boolean
  onOpenTrip: (trip: ShiftRequest) => void
}) {
  const tripsByDay = new Map<string, ShiftRequest[]>()
  for (const trip of trips) {
    const bucket = tripsByDay.get(trip.date)
    if (bucket) bucket.push(trip)
    else tripsByDay.set(trip.date, [trip])
  }

  const columns = `repeat(${days.length}, minmax(0, 1fr))`

  return (
    <Box
      sx={{
        overflowX: 'auto',
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
          <Box sx={{ position: 'relative', height: CONTENT_H }}>
            {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => {
              const isFirst = index === 0
              const isLast = index === HOUR_END - HOUR_START
              return (
                <Typography
                  key={index}
                  sx={{
                    position: 'absolute',
                    top: index * ROW_H,
                    right: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: color.muted,
                    lineHeight: 1,
                    transform: isFirst ? 'none' : isLast ? 'translateY(-100%)' : 'translateY(-50%)',
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
              isToday={day === today}
              onOpenTrip={onOpenTrip}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
