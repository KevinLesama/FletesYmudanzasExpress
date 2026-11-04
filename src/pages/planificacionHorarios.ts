export function estimatedArrival(
  start: string,
  loadMinutes: number | null,
  etaMinutes?: number | null,
  fallback = '',
): string {
  if (etaMinutes == null || loadMinutes == null) return fallback
  if (!/^\d{2}:\d{2}$/.test(start)) return ''
  const [hours, minutes] = start.split(':').map(Number)
  const eta = Number(etaMinutes)
  if (
    hours > 23 ||
    minutes > 59 ||
    !Number.isInteger(loadMinutes) ||
    loadMinutes < 0 ||
    !Number.isFinite(eta) ||
    eta < 0
  ) return ''
  const total = hours * 60 + minutes + loadMinutes + eta
  if (total >= 24 * 60) return ''
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
