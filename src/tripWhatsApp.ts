import { fmtDateEs, waLink } from './format.ts'

type TripWhatsAppData = {
  phone?: string | null
  client?: string | null
  id?: string | null
  date?: string | null
  serviceRange?: readonly string[] | null
}

/**
 * Único constructor del link de WhatsApp del modal de detalle. Mantener acá el
 * href permite testear exactamente el valor que recibe el botón.
 *
 * Devuelve una cadena vacía cuando no hay teléfono: el modal usa ese valor para
 * no renderizar el botón. Los datos opcionales que falten se omiten del mensaje
 * en vez de romper la apertura del detalle.
 */
export function tripWhatsAppHref(trip: TripWhatsAppData): string {
  const phone = trip.phone?.trim()
  if (!phone) return ''

  const client = trip.client?.trim() || 'cliente'
  const id = trip.id?.trim() ? ` ${trip.id.trim()}` : ''
  const date = trip.date ? ` del ${fmtDateEs(trip.date)}` : ''
  const range = (trip.serviceRange ?? []).map((part) => part?.trim()).filter(Boolean)
  const service = range.length > 0 ? ` · servicio ${range.join(' a ')}` : ''

  return waLink(phone, `Hola ${client}, te escribimos por tu viaje${id}${date}${service}.`)
}
