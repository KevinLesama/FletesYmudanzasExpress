import type { ShiftRequest } from './types'
import { occupancyEnd } from './pages/planificacionHorarios'

export type TripForMapReason = 'seleccionado' | 'en-curso' | 'proximo' | 'ultimo'

export interface TripForMap {
  trip: ShiftRequest
  reason: TripForMapReason
}

const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires'

function zonedDateTime(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function tripForMap(
  requests: ShiftRequest[],
  selectedId: string | null,
  timeZone: string,
  now: Date = new Date(),
  bufferMinutes: number | null = null,
): TripForMap | null {
  const eligible = requests.filter(
    (request) => request.status !== 'Cancelada' && request.status !== 'Finalizada',
  )
  const selected = eligible.find((request) => request.id === selectedId)
  if (selected) return { trip: selected, reason: 'seleccionado' }

  let currentTime: string
  try {
    currentTime = zonedDateTime(now, timeZone || DEFAULT_TIME_ZONE)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    currentTime = zonedDateTime(now, DEFAULT_TIME_ZONE)
  }

  const timestamp = (request: ShiftRequest, time: string) => `${request.date}T${time}`
  // El viaje sigue en curso mientras descarga: no termina al llegar al destino.
  const endOf = (request: ShiftRequest) =>
    timestamp(
      request,
      occupancyEnd(request.serviceRange, request.downloadMinutes ?? null, bufferMinutes) ||
        request.serviceRange[1],
    )
  const inProgress = eligible.find((request) => {
    const start = timestamp(request, request.serviceRange[0])
    return start <= currentTime && currentTime <= endOf(request)
  })
  if (inProgress) return { trip: inProgress, reason: 'en-curso' }

  const upcoming = eligible
    .filter((request) => timestamp(request, request.serviceRange[0]) > currentTime)
    .sort((a, b) => timestamp(a, a.serviceRange[0]).localeCompare(timestamp(b, b.serviceRange[0])))[0]
  if (upcoming) return { trip: upcoming, reason: 'proximo' }

  const previous = eligible
    .filter((request) => endOf(request) < currentTime)
    .sort((a, b) => endOf(b).localeCompare(endOf(a)))[0]
  return previous ? { trip: previous, reason: 'ultimo' } : null
}
