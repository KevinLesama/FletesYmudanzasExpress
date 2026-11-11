const HHMM = /^\d{2}:\d{2}$/

/**
 * Suma minutos a una hora `HH:MM`. Devuelve `''` si la hora o los minutos no
 * son válidos, o si el resultado cruza la medianoche. Nunca envuelve a `00:xx`
 * porque mostraría una hora anterior a la de partida.
 */
export function shiftTime(time: string, minutes: number): string {
  if (!HHMM.test(time)) return ''
  const [hours, mins] = time.split(':').map(Number)
  if (hours > 23 || mins > 59) return ''
  if (!Number.isInteger(minutes) || minutes < 0) return ''
  const total = hours * 60 + mins + minutes
  if (total >= 24 * 60) return ''
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function estimatedArrival(
  start: string,
  loadMinutes: number | null,
  etaMinutes?: number | null,
  fallback = '',
): string {
  if (etaMinutes == null || loadMinutes == null) return fallback
  const eta = Number(etaMinutes)
  if (!Number.isFinite(eta) || eta < 0) return ''
  if (!Number.isInteger(loadMinutes) || loadMinutes < 0) return ''
  return shiftTime(start, loadMinutes + eta)
}

/** Fin del trabajo: llegada al destino más los minutos de descarga. */
export function estimatedFinish(arrival: string, downloadMinutes: number | null): string {
  if (downloadMinutes == null) return ''
  return shiftTime(arrival, downloadMinutes)
}

/** Fin de la ocupación en agenda: fin del trabajo más el margen operativo. */
export function occupiedUntil(finish: string, bufferMinutes: number | null): string {
  if (bufferMinutes == null) return ''
  return shiftTime(finish, bufferMinutes)
}

/**
 * Franja que el viaje ocupa realmente en la agenda.
 *
 * Arranca en el inicio del servicio y termina cuando el recurso vuelve a estar
 * libre: llegada al destino más descarga más margen operativo. Es el mismo
 * criterio que usan la base (`hora_hasta + descarga_min + margen`) y el motor de
 * disponibilidad (`Reserva.fin_efectivo`), así que la agenda deja de mostrar
 * libre un hueco que el sistema después bloquea.
 *
 * Si falta la llegada confirmada, la descarga o el margen, devuelve la franja
 * tal como viene: nunca inventa una duración.
 */
export function agendaRange(
  serviceRange: readonly string[],
  downloadMinutes: number | null,
  bufferMinutes: number | null,
): [string, string] {
  const [start, arrival] = serviceRange
  if (!start) return [start ?? '', arrival ?? '']
  if (!arrival) return [start, arrival ?? '']
  const finish = estimatedFinish(arrival, downloadMinutes)
  const end = finish ? occupiedUntil(finish, bufferMinutes) : ''
  return [start, end || arrival]
}

/** Datos de agenda que salen de la tabla `solicitudes`. */
export interface AgendaTimes {
  serviceRange: readonly string[]
  loadMinutes?: number | null
  downloadMinutes?: number | null
}

/**
 * La planificación está completa cuando llegada, carga y descarga tienen valor.
 *
 * En `src/api.ts` esos tres campos llegan vacíos hasta que administración los
 * confirma (`hora_hasta_confirmado`, `carga_min_confirmado`,
 * `descarga_min_confirmado`), así que alcanza con mirar si están presentes.
 */
export function planningTimesComplete(trip: AgendaTimes): boolean {
  const [start, arrival] = trip.serviceRange
  return Boolean(start && arrival) && trip.loadMinutes != null && trip.downloadMinutes != null
}

export interface AgendaBlockRange {
  start: string
  end: string
  /**
   * Solo se muestra el fin cuando llegada, carga y descarga están definidas.
   * Con datos incompletos la agenda muestra únicamente el inicio: nunca un fin
   * inventado.
   */
  complete: boolean
}

/** Franja que dibuja la agenda, con la planificación como condición. */
export function agendaBlockRange(
  trip: AgendaTimes,
  bufferMinutes: number | null,
): AgendaBlockRange {
  const [start, end] = agendaRange(trip.serviceRange, trip.downloadMinutes ?? null, bufferMinutes)
  return { start, end, complete: planningTimesComplete(trip) }
}
