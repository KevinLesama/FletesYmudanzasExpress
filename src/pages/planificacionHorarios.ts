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
