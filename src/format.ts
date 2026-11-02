import type { RequestStatus, TripStatus, VehicleStatus, DriverStatus } from './types'

export function ars(value: number): string {
  if (!value) return '$ 0'
  return '$ ' + value.toLocaleString('es-AR').replace(/\./g, '.')
}

export function fmtTime(h: string): string {
  return h
}

export function fmtDate(date: string | undefined | null, short = false): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-')
  const parts = short ? `${d}/${m}` : `${d}/${m}/${y}`
  return parts
}

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Dirección corta para tablas y bloques de la agenda: primera parte de la
 * dirección más la localidad, sin partido/provincia ni códigos postales.
 */
export function formatShortPlace(place: { address: string; barrio: string }): string {
  const address = place.address.trim()
  const locality = place.barrio.trim()
  const firstSegment = address.split(',')[0]?.trim() ?? ''
  const ignoredSegment = /^(partido|municipio|departamento)\s+de\s+/i
  const cleanSegment = (segment: string) => segment.replace(ignoredSegment, '').trim()
  const shortAddress = cleanSegment(firstSegment)
  const shortLocality = cleanSegment(locality)

  if (!shortLocality && address.length <= 32) return address
  if (shortLocality && shortAddress) return `${shortAddress} · ${shortLocality}`
  if (shortLocality) return shortLocality

  const city = address
    .split(',')
    .slice(1)
    .map((segment) => cleanSegment(segment))
    .find((segment) => segment && !/(\d{4,}|argentina|buenos aires|provincia)/i.test(segment))

  return city && shortAddress ? `${shortAddress} · ${city}` : shortAddress || address
}

export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function waPhone(phone: string): string {
  return '54' + (phone ?? '').replace(/\D/g, '')
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`
}

export function fmtLong(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${dayName(date)}, ${d} de ${MESES_LARGO[(m ?? 1) - 1]} de ${y}`
}

export function fmtDateEs(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MESES[(m ?? 1) - 1]} ${y}`
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function dayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return DIAS[dt.getDay()]
}

/**
 * Etiquetas que la base usa como "nombre" para las cuentas compartidas: no son
 * el nombre de una persona, así que no sirven para saludar.
 */
const ETIQUETAS_ROL = /^(administraci[oó]n|administrador|administradora|chofer|clientes?|operaci[oó]n|sistema)$/i

/** Nombre de pila de una persona; vacío si el valor es una etiqueta de rol. */
export function givenName(fullName?: string | null): string {
  const [first = ''] = (fullName ?? '').trim().split(/\s+/)
  return ETIQUETAS_ROL.test(first) ? '' : first
}

export function normalizeStatus(status: string): string {
  return status
}

export type AnyStatus = RequestStatus | TripStatus | VehicleStatus | DriverStatus | string

export function statusLabel(s: any): string {
  if (s === 'Confirmada') return 'Confirmada'
  return String(s)
}