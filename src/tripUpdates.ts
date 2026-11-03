import { ars, formatEventDate, formatShortPlace, joinDateTime, joinParts, shiftStamp, toArgentinaStamp } from './format.ts'
import type { ShiftRequest } from './types'

/** Etapas del viaje. El índice activo se deriva de los datos que ya existen. */
export const STAGES = ['Solicitud', 'Seña', 'Confirmado', 'En viaje', 'Entregado'] as const

export function stageIndex(trip: ShiftRequest): number {
  if (trip.status === 'Cancelada') return 0
  // El estado es la fuente de verdad: hay datos de demo con marcas de llegada en
  // viajes que todavía no están confirmados, y no queremos que el stepper y el
  // estado se contradigan en la misma pantalla.
  if (trip.status === 'Finalizada') return 4
  if (trip.status !== 'Confirmada') return trip.status === 'Pendiente de seña' ? 1 : 0
  if (trip.finishedAt) return 4
  if (trip.arrivedAt) return 3
  return 2
}

export interface TripUpdate {
  id: string
  // Timestamp completo del evento en hora argentina ("YYYY-MM-DDTHH:mm").
  // Si falta, el evento se muestra solo con la hora, sin separador de dia.
  at?: string
  time: string
  title: string
  detail: string
  done: boolean
  alert?: boolean
  photo?: string
}

export type TimelineRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'event'; key: string; update: TripUpdate }

const stampTime = (stamp: string) => (stamp.length >= 16 ? stamp.slice(11, 16) : '')

/** Par `{ at, time }`: usa el timestamp real y cae a la hora estimada. */
function event(stamp: string, fallback = '') {
  return { at: stamp || undefined, time: stampTime(stamp) || fallback }
}

/** Suma minutos a un 'HH:MM'. Solo para la hora visible de respaldo. */
function shiftTime(time: string, minutes: number) {
  const [hours, mins] = time.split(':').map(Number)
  const total = (hours * 60 + mins + minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const isDeposit = (concept: string) => concept === 'Seña' || concept === 'sena'

/**
 * Timestamp de la seña: el pago de seña más reciente. Si hay varios, el monto
 * mostrado sigue siendo la suma; solo se toma la ultima marca de tiempo real.
 */
export function depositTimestamp(trip: ShiftRequest): string {
  const stamps = (trip.payments ?? [])
    .filter((payment) => isDeposit(String(payment.concept)))
    .map((payment) => toArgentinaStamp(payment.createdAt))
    .filter(Boolean)
    .sort()
  return stamps[stamps.length - 1] ?? ''
}

/** Orden descendente por timestamp real; lo que no tiene fecha queda al final. */
function byMostRecent(a: TripUpdate, b: TripUpdate): number {
  if (!a.at && !b.at) return 0
  if (!a.at) return 1
  if (!b.at) return -1
  return b.at.localeCompare(a.at)
}

/**
 * Novedades del viaje. Los eventos con timestamp real (fin, llegada,
 * incidentes, seña pagada, solicitud creada) se ordenan por ese instante; los
 * calculados (en viaje, chofer asignado) usan la fecha y hora del servicio para
 * intercalarse sin contradecir a los reales.
 */
export function buildUpdates(trip: ShiftRequest, driverName?: string, vehicleName?: string): TripUpdate[] {
  const serviceStart = trip.serviceRange[0]
  const serviceAt = joinDateTime(trip.date, serviceStart)
  const shortOrigin = formatShortPlace(trip.origin) || 'el origen'
  const shortDestination = formatShortPlace(trip.destination) || 'el destino'
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

  const confirmed = trip.status === 'Confirmada' || trip.status === 'Finalizada'

  if (confirmed && trip.finishedAt) {
    updates.push({
      id: 'finished',
      ...event(toArgentinaStamp(trip.finishedAt)),
      title: 'Entregado',
      detail: joinParts([
        `Descarga terminada en ${shortDestination}.`,
        trip.closeoutPaymentMethod ? `Saldo: ${trip.closeoutPaymentMethod}.` : '',
        trip.remitoCapturedAt ? 'Remito fotografiado en el dispositivo.' : '',
      ]),
      done: true,
      photo: trip.remitoPhoto?.dataUrl,
    })
  }

  trip.incidents?.forEach((incident, index) => {
    updates.push({
      id: `incident-${index}`,
      ...event(toArgentinaStamp(incident.time), '—'),
      title: incident.type,
      detail: incident.description,
      done: true,
      alert: true,
    })
  })

  if (confirmed && trip.arrivedAt) {
    updates.push({
      id: 'arrived',
      ...event(toArgentinaStamp(trip.arrivedAt)),
      title: 'Llegada al destino',
      detail: `El chofer llegó a ${shortDestination}.`,
      done: true,
    })
  }

  updates.push({
    id: 'departure',
    ...event(serviceAt, serviceStart),
    title: 'En viaje',
    detail: `Salida desde ${shortOrigin}.`,
    done: stageIndex(trip) >= 3,
  })

  updates.push({
    id: 'driver',
    ...event(shiftStamp(serviceAt, -45), shiftTime(serviceStart, -45)),
    title: 'Chofer asignado',
    detail: joinParts([driverName, vehicleName]) || 'Todavía no hay chofer asignado.',
    done: Boolean(driverName),
  })

  const depositAt = depositTimestamp(trip)
  updates.push({
    id: 'deposit',
    ...event(depositAt || shiftStamp(serviceAt, -90), shiftTime(serviceStart, -90)),
    title: trip.depositReceived > 0 ? 'Seña recibida' : 'Seña pendiente',
    detail: `${ars(trip.depositReceived)} de ${ars(trip.depositRequired)}.`,
    done: trip.depositReceived > 0,
  })

  updates.push({
    id: 'request',
    ...event(
      toArgentinaStamp(trip.createdAt) || shiftStamp(serviceAt, -150),
      shiftTime(serviceStart, -150),
    ),
    title: 'Solicitud creada',
    detail: `${trip.client} pidió una mudanza desde ${shortOrigin}.`,
    done: true,
  })

  // Una cancelacion no tiene timestamp: se queda arriba como estado final.
  const cancelled = trip.status === 'Cancelada' ? updates.filter((u) => u.id === 'cancelled') : []
  const sorted = updates.filter((u) => u.id !== 'cancelled').sort(byMostRecent)
  return [...cancelled, ...sorted]
}

/**
 * Filas del timeline: un separador por dia en orden descendente. Un evento sin
 * fecha no genera separador ni corta el grupo.
 */
export function groupUpdatesByDay(updates: TripUpdate[], now: Date = new Date()): TimelineRow[] {
  const rows: TimelineRow[] = []
  let renderedDay = ''
  for (const update of updates) {
    const day = update.at ? update.at.slice(0, 10) : ''
    const label = day ? formatEventDate(day, now) : ''
    if (label && day !== renderedDay) {
      rows.push({ kind: 'day', key: `day-${day}`, label })
      renderedDay = day
    }
    rows.push({ kind: 'event', key: update.id, update })
  }
  return rows
}
