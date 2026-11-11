import type { RequestStatus, ShiftRequest } from '../types'
import { occupancyEnd } from './planificacionHorarios'

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
 *
 * `start`/`end` es la franja que se quiere reservar: el llamador debe pasar la
 * franja ya extendida (llegada + descarga + margen) del viaje que está creando.
 * Los viajes existentes se extienden acá con sus propios datos, porque comparar
 * contra la llegada dejaría libre la descarga y el margen.
 */
export function agendaTripsInSlot(
  requests: readonly ShiftRequest[],
  start: string,
  end: string,
  excludeId?: string,
  bufferMinutes: number | null = null,
): ShiftRequest[] {
  const range = usableRange([start, end])
  if (!range) return []
  return requests.filter((request) => {
    if (request.id === excludeId) return false
    if (!occupiesAgenda(request)) return false
    const other = usableRange([
      request.serviceRange[0],
      occupancyEnd(request.serviceRange, request.downloadMinutes ?? null, bufferMinutes),
    ])
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

/**
 * Selección de filtros de la agenda. Es estructural a propósito: `AgendaFilters`
 * vive en el componente del toolbar y esta capa no tiene por qué depender de él.
 */
export interface AgendaFilterSelection {
  driver: string
  vehicle: string
  status: string
}

/** `'all'` (o un valor vacío) significa "sin filtrar" para ese campo. */
const isUnfiltered = (value: string) => !value || value === 'all'

/**
 * Un viaje entra en la agenda si cumple **todos** los filtros activos.
 *
 * Es la única regla de filtrado: la grilla, los puntitos del calendario y los
 * chips salen de acá. Si se duplica, vuelven a mostrar conjuntos distintos.
 */
export function matchesAgendaFilters(
  trip: ShiftRequest,
  filters: AgendaFilterSelection,
): boolean {
  return (
    (isUnfiltered(filters.driver) || trip.driverId === filters.driver) &&
    (isUnfiltered(filters.vehicle) || trip.vehicleId === filters.vehicle) &&
    (isUnfiltered(filters.status) || trip.status === filters.status)
  )
}

/**
 * Días con puntito en el calendario: los que tienen al menos un viaje que
 * sobrevive a los filtros. Se calcula sobre TODAS las fechas, no solo la semana
 * visible, porque el calendario mensual necesita marcar los días de afuera.
 */
export function agendaMarkedDates(
  requests: readonly ShiftRequest[],
  filters: AgendaFilterSelection,
): Set<string> {
  const dates = new Set<string>()
  for (const request of requests) {
    if (matchesAgendaFilters(request, filters)) dates.add(request.date)
  }
  return dates
}
