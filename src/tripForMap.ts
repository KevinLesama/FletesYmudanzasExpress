import type { ShiftRequest } from './types'

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
  const inProgress = eligible.find((request) => {
    const start = timestamp(request, request.serviceRange[0])
    const end = timestamp(request, request.serviceRange[1])
    return start <= currentTime && currentTime <= end
  })
  if (inProgress) return { trip: inProgress, reason: 'en-curso' }

  const upcoming = eligible
    .filter((request) => timestamp(request, request.serviceRange[0]) > currentTime)
    .sort((a, b) => timestamp(a, a.serviceRange[0]).localeCompare(timestamp(b, b.serviceRange[0])))[0]
  if (upcoming) return { trip: upcoming, reason: 'proximo' }

  const previous = eligible
    .filter((request) => timestamp(request, request.serviceRange[1]) < currentTime)
    .sort((a, b) => timestamp(b, b.serviceRange[1]).localeCompare(timestamp(a, a.serviceRange[1])))[0]
  return previous ? { trip: previous, reason: 'ultimo' } : null
}
