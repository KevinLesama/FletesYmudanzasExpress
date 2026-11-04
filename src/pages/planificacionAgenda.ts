import type { RequestStatus, ShiftRequest } from '../types'

/**
 * CARACTERIZACIÓN de la agenda tal como funciona HOY, no una especificación de
 * las reglas que vienen.
 *
 * Regla actual: cualquier viaje pendiente o confirmado ocupa su franja. La
 * distinción blanda/firme (un pendiente avisa pero no bloquea) se define en la
 * etapa de disponibilidad operativa y se aplicará en esta capa cuando llegue el
 * trabajo de frontend. Hasta entonces este módulo y sus tests describen el
 * comportamiento vigente para detectar regresiones.
 *
 * El backend bloquea solo contra viajes `confirmada`
 * (`business.driver_conflicts` / `vehicle_conflicts`). Esa asimetría entre las
 * dos capas es deuda conocida: se resuelve en la etapa de frontend, no acá.
 */
const AGENDA_STATUSES: RequestStatus[] = [
  'Pendiente de revisión',
  'Pendiente de seña',
  'Confirmada',
]

const HHMM = /^\d{2}:\d{2}$/

/** Una franja solo sirve para comparar si son dos horas HH:MM ordenadas. */
function usableRange(range: readonly string[]): [string, string] | null {
  const [from, to] = range
  if (!from || !to || !HHMM.test(from) || !HHMM.test(to)) return null
  if (from >= to) return null
  return [from, to]
}

/** Dos franjas se solapan cuando cada una empieza antes de que la otra termine. */
export function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && bFrom < aTo
}

export function occupiesAgenda(request: ShiftRequest): boolean {
  return AGENDA_STATUSES.includes(request.status)
}

/**
 * Viajes del día que ocuparían la agenda en la franja pedida. Excluye el viaje
 * que se está editando para que no se bloquee a sí mismo.
 */
export function agendaTripsInSlot(
  requests: readonly ShiftRequest[],
  start: string,
  end: string,
  excludeId?: string,
): ShiftRequest[] {
  const range = usableRange([start, end])
  if (!range) return []
  return requests.filter((request) => {
    if (request.id === excludeId) return false
    if (!occupiesAgenda(request)) return false
    const other = usableRange(request.serviceRange)
    return other !== null && overlaps(range[0], range[1], other[0], other[1])
  })
}

/** Ids de los recursos ya reservados por los viajes recibidos. */
export function busyIds(
  trips: readonly ShiftRequest[],
  pick: (trip: ShiftRequest) => string | undefined,
): Set<string> {
  const ids = new Set<string>()
  for (const trip of trips) {
    const id = pick(trip)
    if (id) ids.add(id)
  }
  return ids
}

/** Agenda del chofer en el día, ordenada por horario y sin viajes cancelados. */
export function driverDayAgenda(
  requests: readonly ShiftRequest[],
  driverId: string,
): ShiftRequest[] {
  if (!driverId) return []
  return requests
    .filter((request) => request.driverId === driverId && request.status !== 'Cancelada')
    .sort((a, b) => a.serviceRange[0].localeCompare(b.serviceRange[0]))
}
