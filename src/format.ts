import type { RequestStatus, TripStatus, VehicleStatus, DriverStatus } from './types'
import { normalizeArgentinaPhoneForWhatsApp } from './utils/telefono.ts'

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
 * Une textos visibles descartando lo que no aporta: null, undefined, false,
 * strings vacíos o con sólo espacios. Evita separadores colgados del tipo
 * "Cliente · " cuando falta un dato.
 */
export function joinParts(parts: Array<string | null | undefined | false>, separator = ' · '): string {
  return parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(separator)
}

export interface ShortAddressParts {
  road?: string | null
  houseNumber?: string | null
  locality?: string | null
  neighbourhood?: string | null
}

const ADDRESS_COUNTRY = /^(argentina|republica argentina)$/i
const ADDRESS_POSTAL = /^[a-z]{1,2}\d{4}[a-z]{0,3}$/i
const ADDRESS_ADMIN =
  /^(?:comuna\s+\d+|ciudad aut[oó]noma de buenos aires|caba|capital federal|buenos aires|provincia de buenos aires|partido de .+|municipio de .+|departamento de .+)$/i
const ADDRESS_STREET_TYPE =
  /^(?:av\.?|avenida|calle|ruta|boulevard|blvd\.?|pasaje|pje\.?|diagonal|autopista|autov[ií]a|colectora|camino)\b/i
const ADDRESS_HOUSE_NUMBER = /^\d{1,6}[a-z]?$/i

function cleanAddressPart(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').replace(/^[\s,.;]+|[\s,.;]+$/g, '').trim()
}

function addressKey(value: string): string {
  return cleanAddressPart(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isAddressNoise(part: string, index: number, total: number): boolean {
  if (!part || ADDRESS_COUNTRY.test(part) || ADDRESS_ADMIN.test(part)) return true
  if (ADDRESS_POSTAL.test(part)) return true
  // Un número de cuatro dígitos sólo es código postal si está al final del
  // string; el mismo formato es un número de puerta válido en la calle.
  return /^\d{4}$/.test(part) && index >= Math.max(2, total - 2)
}

/**
 * Versión corta de una dirección para mostrar en la UI. Prioriza los
 * componentes estructurados si el llamador los tiene; si no, parsea el string
 * del geocodificador. La dirección completa se conserva en `Place.address`
 * para mapas, rutas y tooltips.
 */
export function formatShortAddress(
  address: string | null | undefined,
  parts: ShortAddressParts = {},
): string {
  const segments = cleanAddressPart(address)
    .split(',')
    .map(cleanAddressPart)
    .filter(Boolean)

  const filtered = segments
    .filter((part, index) => !isAddressNoise(part, index, segments.length))
    .filter((part, index, all) => all.findIndex((other) => addressKey(other) === addressKey(part)) === index)

  const structuredStreet = cleanAddressPart(parts.road)
  const structuredNumber = cleanAddressPart(parts.houseNumber)
  const structuredLocality =
    [parts.locality, parts.neighbourhood]
      .map(cleanAddressPart)
      .find((part) => part && !isAddressNoise(part, 0, 1)) ?? ''

  let street = structuredStreet
  let houseNumber = structuredNumber
  let consumed = 0

  if (!street) {
    street = filtered[0] ?? ''
    consumed = street ? 1 : 0
    const next = filtered[consumed]
    if (next && ADDRESS_HOUSE_NUMBER.test(next)) {
      houseNumber = houseNumber || next
      consumed += 1
    }
  } else if (!houseNumber) {
    const next = addressKey(filtered[0] ?? '') === addressKey(street) ? filtered[1] : filtered[0]
    if (next && ADDRESS_HOUSE_NUMBER.test(next)) {
      houseNumber = next
      consumed = addressKey(filtered[0] ?? '') === addressKey(street) ? 2 : 1
    }
  }

  const fullStreet =
    street && houseNumber && !addressKey(street).includes(addressKey(houseNumber))
      ? `${street} ${houseNumber}`
      : street

  let locality = structuredLocality
  if (!locality) {
    const rest = filtered.slice(consumed).filter((part) => !ADDRESS_HOUSE_NUMBER.test(part))
    locality = rest[rest.length - 1] ?? ''
  }

  if (locality && addressKey(locality) === addressKey(fullStreet)) locality = ''
  if (locality && isAddressNoise(locality, 0, 1)) locality = ''

  const displayStreet =
    fullStreet &&
    !houseNumber &&
    locality &&
    !ADDRESS_STREET_TYPE.test(fullStreet) &&
    !addressKey(fullStreet).includes(addressKey(locality))
      ? `${fullStreet} de ${locality}`
      : fullStreet

  return [displayStreet, locality]
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((other) => addressKey(other) === addressKey(part)) === index)
    .join(', ')
}

export function formatShortPlace(place: { address: string; barrio?: string | null }): string {
  return formatShortAddress(place.address, { locality: place.barrio })
}

export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function waPhone(phone: string): string {
  return normalizeArgentinaPhoneForWhatsApp(phone)
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
 * Zona horaria de la operacion. Las fechas de eventos llegan como timestamps
 * UTC (o con offset) y se muestran siempre en hora argentina.
 */
export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const ART_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const ART_STAMP_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const DATE_INPUT =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const pad2 = (value: number) => String(value).padStart(2, '0')

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

function artParts(date: Date): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null
  const parts = ART_DAY_FORMAT.formatToParts(date)
  const pick = (kind: string) => Number(parts.find((part) => part.type === kind)?.value)
  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

/** Dia calendario (en hora argentina) que representa `value`, o null. */
function calendarDay(value: string | Date | null | undefined): { year: number; month: number; day: number } | null {
  if (value == null) return null
  if (value instanceof Date) return artParts(value)

  const text = value.trim()
  const match = DATE_INPUT.exec(text)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isRealDate(year, month, day)) return null

  // Sin offset, el valor ya es hora de pared argentina: se toma literal. Con
  // offset es un instante y hay que pasarlo a la zona antes de leer el dia.
  const hasOffset = /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
  if (!hasOffset) return { year, month, day }

  const instant = Date.parse(text)
  return Number.isNaN(instant) ? null : artParts(new Date(instant))
}

function dayKey(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`
}

function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days))
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

/**
 * Etiqueta de dia para la linea de novedades: "Hoy", "Ayer", "2 nov" (mismo
 * ano) o "2 nov 2025" (otro ano). Devuelve "" si la fecha falta o es invalida.
 */
export function formatEventDate(
  date: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const event = calendarDay(date)
  const today = artParts(now)
  if (!event || !today) return ''

  const eventKey = dayKey(event)
  const todayKey = dayKey(today)
  if (eventKey === todayKey) return 'Hoy'
  if (eventKey === shiftDay(todayKey, -1)) return 'Ayer'

  const label = `${event.day} ${MESES[event.month - 1]}`
  return event.year === today.year ? label : `${label} ${event.year}`
}

/**
 * Normaliza un timestamp a "YYYY-MM-DDTHH:mm" en hora argentina. Acepta ISO
 * con offset/Z (se convierte) o un valor local sin zona (se toma literal).
 * Devuelve "" si no hay timestamp utilizable.
 */
export function toArgentinaStamp(value: string | null | undefined): string {
  if (!value) return ''
  const text = value.trim()
  if (!text) return ''

  const match = DATE_INPUT.exec(text)
  if (!match || match[4] == null || match[5] == null) return ''

  const hasOffset = /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
  if (!hasOffset) return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`

  const instant = Date.parse(text)
  if (Number.isNaN(instant)) return ''
  const parts = ART_STAMP_FORMAT.formatToParts(new Date(instant))
  const pick = (kind: string) => parts.find((part) => part.type === kind)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`
}

/** Une una fecha (yyyy-mm-dd) y una hora (HH:mm) en un stamp local. */
export function joinDateTime(date: string | null | undefined, time: string | null | undefined): string {
  const day = (date ?? '').trim()
  const clock = (time ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(clock)) return ''
  return `${day}T${clock}`
}

/** Suma minutos a un stamp local, ajustando el dia si cruza medianoche. */
export function shiftStamp(stamp: string, minutes: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(stamp)
  if (!match) return ''
  const base = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  )
  const shifted = new Date(base + minutes * 60_000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`
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