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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const DEMO_DATE = '2026-09-24'

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

export function normalizeStatus(status: string): string {
  return status
}

export type AnyStatus = RequestStatus | TripStatus | VehicleStatus | DriverStatus | string

export function statusLabel(s: any): string {
  if (s === 'Confirmada') return 'Confirmada'
  return String(s)
}