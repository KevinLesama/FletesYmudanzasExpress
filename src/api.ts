// Capa de servicios HTTP: centraliza la URL del backend y el mapeo entre el
// snake_case que devuelve la API y los tipos camelCase que usa la interfaz.
//
// La base de la API se define en VITE_API_URL (por defecto "/api"). En
// desarrollo, Vite hace proxy de /api hacia el backend; en Docker, nginx hace
// lo mismo. Asi el navegador siempre usa una ruta relativa.

import { R } from './routes'
import { supabase } from './supabase'
import type { Role, SessionUser } from './supabase'
import type {
  Availability,
  Client,
  Driver,
  Payment,
  PaymentSummary,
  PlaceDetail,
  PlaceSuggestion,
  Quote,
  ReceivedBy,
  RemitoPhoto,
  RequestStatus,
  RouteEstimate,
  ShiftRequest,
  TripIncident,
  Vehicle,
} from './types'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Verificá que el backend esté en ejecución.')
  }
  if (response.status === 401) {
    await supabase.auth.signOut()
    window.location.href = R.ingreso
  }
  if (!response.ok) {
    let detail = `Error ${response.status}`
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: any) => d.msg).join(', ')
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// --------------------------------------------------------------------------- //
// Mapeo API (snake_case) -> dominio (camelCase)
// --------------------------------------------------------------------------- //
type Json = Record<string, any>

const hhmm = (t: string | null | undefined): string => (t ? t.slice(0, 5) : '')

function mapClient(c: Json): Client {
  return {
    id: Number(c.id),
    name: String(c.nombre ?? c.name ?? ''),
    phone: String(c.telefono ?? c.phone ?? ''),
  }
}

function mapDriver(d: Json): Driver {
  const name = d.nombre ?? d.name ?? ''
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('') || 'CH'
  return {
    id: String(d.id),
    initials,
    name,
    phone: d.telefono ?? d.phone ?? '',
    email: d.email ?? '',
    status: d.activo === false ? 'Inactivo' : 'Activo',
    baseRate: Number(d.tarifa_base ?? 0),
    ratePerKm: Number(d.tarifa_por_km ?? 0),
    ratePerHour: Number(d.tarifa_por_hora ?? 0),
    factors: (d.factors ?? []).map((f: Json) => ({ label: f.label, amount: Number(f.amount) })),
  }
}

function mapVehicle(v: Json): Vehicle {
  const estado = v.estado ?? v.status
  let status: Vehicle['status'] = 'Disponible'
  if (estado === 'en_taller') status = 'En taller'
  else if (estado === 'fuera_de_servicio') status = 'Fuera de servicio'
  else if (estado === 'asignado') status = 'Asignado'
  else if (v.activo === false) status = 'En taller'
  else status = 'Disponible'

  return {
    id: v.patente ?? String(v.id),
    type: v.tipo ?? v.type ?? '',
    capacityKg: Number(v.capacidad_kg ?? v.capacity_kg ?? 0),
    status,
    assignedNote: v.notas ?? v.assigned_note ?? undefined,
  }
}

function mapRequest(r: Json): ShiftRequest {
  const estado = String(r.estado ?? r.status ?? '')
  const ESTADOS: Record<string, RequestStatus> = {
    pendiente: 'Pendiente de revisión',
    confirmada: 'Confirmada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
    'Pendiente de revisión': 'Pendiente de revisión',
    'Pendiente de seña': 'Pendiente de seña',
    Confirmada: 'Confirmada',
    Finalizada: 'Finalizada',
    Cancelada: 'Cancelada',
  }
  const status: RequestStatus = ESTADOS[estado] ?? 'Pendiente de revisión'
  const date = String(r.date ?? r.fecha ?? '')

  return {
    id: String(r.codigo ?? r.id ?? ''),
    client: String(r.client_name ?? r.cliente_nombre ?? ''),
    phone: String(r.phone ?? r.cliente_telefono ?? ''),
    status,
    date,
    arrivalRange: [hhmm(r.arrival_from ?? r.hora_desde), hhmm(r.arrival_to ?? r.hora_hasta)],
    serviceRange: [hhmm(r.service_from ?? r.hora_desde), hhmm(r.service_to ?? r.hora_hasta)],
    origin: {
      label: 'Origen',
      address: String(r.origin_address ?? r.origen_direccion ?? ''),
      barrio: String(r.origin_barrio ?? r.origen_barrio ?? ''),
      floor: String(r.origin_floor ?? r.origen_piso ?? ''),
      elevator: Boolean(r.origin_elevator ?? r.origen_ascensor),
      placeId: r.origen_place_id ?? undefined,
      lat: r.origen_lat ?? undefined,
      lng: r.origen_lng ?? undefined,
    },
    destination: {
      label: 'Destino',
      address: String(r.destination_address ?? r.destino_direccion ?? ''),
      barrio: String(r.destination_barrio ?? r.destino_barrio ?? ''),
      floor: String(r.destination_floor ?? r.destino_piso ?? ''),
      elevator: Boolean(r.destination_elevator ?? r.destino_ascensor),
      placeId: r.destino_place_id ?? undefined,
      lat: r.destino_lat ?? undefined,
      lng: r.destino_lng ?? undefined,
    },
    cargo: {
      items: (r.cargo_items ?? []).map((i: Json) => ({
        name: i.name ?? i.descripcion ?? '',
        units: Number(i.units ?? i.cantidad ?? 0),
        note: i.note ?? i.nota ?? undefined,
      })),
      approxUnits: Number(r.cargo_approx_units ?? 0),
      fragile: Boolean(r.cargo_fragile),
      notes: String(r.cargo_notes ?? ''),
    },
    driverId: r.driver_id != null ? String(r.driver_id) : undefined,
    vehicleId: r.vehicle_id != null ? String(r.vehicle_id) : undefined,
    price: Number(r.price ?? r.precio_final ?? 0),
    depositRequired: Number(r.deposit_required ?? Math.round(Number(r.precio_final ?? 0) / 2)),
    depositReceived: Number(r.deposit_received ?? 0),
    confirmed: Boolean(r.confirmed),
    estimatedKm: r.estimated_km ?? undefined,
    estimatedHours: r.estimated_hours ?? undefined,
    returnKm: r.return_km ?? undefined,
    totalKm: r.total_km ?? undefined,
    etaMinutes: r.eta_minutes ?? undefined,
    waitMinutes: r.wait_minutes ?? undefined,
    driverCost: r.driver_cost ?? undefined,
    suggestedPrice: r.suggested_price ?? undefined,
    priceOverridden: Boolean(r.price_overridden),
    tariffs:
      r.tarifa_base_aplicada != null
        ? {
            base: Number(r.tarifa_base_aplicada),
            perKm: Number(r.tarifa_km_aplicada ?? 0),
            perHour: Number(r.tarifa_hora_aplicada ?? 0),
          }
        : undefined,
    arrivedAt: r.arrived_at ?? undefined,
    finishedAt: r.finished_at ?? undefined,
    incidents: (r.incidents ?? []).map((i: Json) => ({ id: i.id, type: i.type, description: i.description, time: i.time })),
    remitoPhoto: r.remito_data_url ? { name: r.remito_name ?? 'remito', dataUrl: r.remito_data_url } : undefined,
    payments: (r.payments ?? []).map((p: Json) => ({
      id: p.id,
      concept: p.concept,
      method: p.method,
      receivedBy: p.received_by,
      amount: Number(p.amount),
      date: p.date,
      notes: p.notes ?? undefined,
    })),
  }
}

function mapQuote(q: Json): Quote {
  return {
    kmIda: Number(q.km_ida ?? 0),
    kmVuelta: Number(q.km_vuelta ?? 0),
    kmTotal: Number(q.km_total ?? 0),
    etaMinutes: Number(q.duracion_ida_min ?? 0),
    returnMinutes: Number(q.duracion_vuelta_min ?? 0),
    waitMinutes: Number(q.espera_min ?? 0),
    totalHours: Number(q.horas_totales ?? 0),
    tariffBase: Number(q.tarifa_base ?? 0),
    tariffPerKm: Number(q.tarifa_por_km ?? 0),
    tariffPerHour: Number(q.tarifa_por_hora ?? 0),
    costBase: Number(q.costo_base ?? 0),
    costKm: Number(q.costo_km ?? 0),
    costTime: Number(q.costo_tiempo ?? 0),
    driverCost: Number(q.costo_chofer ?? 0),
    margin: Number(q.margen ?? 0),
    suggestedPrice: Number(q.precio_sugerido ?? 0),
    depositRequired: Number(q.sena_requerida ?? 0),
  }
}

function mapSummary(s: Json): PaymentSummary {
  return {
    id: String(s.request_id ?? s.codigo ?? s.id ?? ''),
    client: String(s.client_name ?? ''),
    date: String(s.date ?? ''),
    price: Number(s.price ?? 0),
    deposit: Number(s.deposit ?? 0),
    collected: Number(s.collected ?? 0),
    balance: Number(s.balance ?? 0),
    state: s.state,
  }
}

// Traduce el payload legacy del panel (status, driver_id, service_from, price...)
// al contrato del backend nuevo (estado, chofer_id, hora_desde, precio_final...).
const ESTADO_DESDE_LABEL: Record<string, string> = {
  Confirmada: 'confirmada',
  Confirmado: 'confirmada',
  Finalizada: 'finalizada',
  Finalizado: 'finalizada',
  Cancelada: 'cancelada',
  'Pendiente de seña': 'pendiente',
  'Pendiente de revisión': 'pendiente',
}

function legacySolicitudPayload(payload: Json): Json {
  const out: Json = {}

  const clienteId = payload.cliente_id ?? payload.client_id
  if (clienteId != null && clienteId !== '') out.cliente_id = Number(clienteId)

  const fecha = payload.fecha ?? payload.date
  if (fecha) out.fecha = fecha

  const desde = payload.hora_desde ?? payload.service_from ?? payload.arrival_from
  const hasta = payload.hora_hasta ?? payload.service_to ?? payload.arrival_to
  if (desde) out.hora_desde = String(desde).length === 5 ? `${desde}:00` : desde
  if (hasta) out.hora_hasta = String(hasta).length === 5 ? `${hasta}:00` : hasta

  const origen = payload.origen ?? payload.origin
  const origenDireccion = origen?.direccion ?? origen?.address
  if (origen && origenDireccion) {
    out.origen = {
      direccion: origenDireccion,
      barrio: origen.barrio ?? null,
      piso: origen.piso ?? origen.floor ?? null,
      ascensor: Boolean(origen.ascensor ?? origen.elevator),
      notas: origen.notas ?? null,
      place_id: origen.place_id ?? origen.placeId ?? null,
      lat: origen.lat ?? null,
      lng: origen.lng ?? null,
    }
  }
  const destino = payload.destino ?? payload.destination
  const destinoDireccion = destino?.direccion ?? destino?.address
  if (destino && destinoDireccion) {
    out.destino = {
      direccion: destinoDireccion,
      barrio: destino.barrio ?? null,
      piso: destino.piso ?? destino.floor ?? null,
      ascensor: Boolean(destino.ascensor ?? destino.elevator),
      notas: destino.notas ?? null,
      place_id: destino.place_id ?? destino.placeId ?? null,
      lat: destino.lat ?? null,
      lng: destino.lng ?? null,
    }
  }

  // El alta legacy manda la carga como resumen (bultos + notas) y el esquema
  // nuevo la guarda como lineas. Se sintetiza una linea para no perder el dato.
  const cargo = payload.cargo
  if (cargo) {
    const items = Array.isArray(cargo.items) ? cargo.items : []
    if (items.length > 0) {
      out.items_carga = items.map((i: Json) => ({
        descripcion: String(i.name ?? i.descripcion ?? 'Carga'),
        cantidad: Number(i.units ?? i.cantidad ?? 1) || 1,
        fragil: Boolean(i.fragile ?? i.fragil),
        nota: i.note ?? i.nota ?? null,
      }))
    } else if (cargo.notes || cargo.approx_units) {
      out.items_carga = [
        {
          descripcion: String(cargo.notes || 'Carga general'),
          cantidad: Number(cargo.approx_units ?? 0) > 0 ? Number(cargo.approx_units) : 1,
          fragil: Boolean(cargo.fragile),
          nota: null,
        },
      ]
    }
  }
  if (payload.notas != null) out.notas = payload.notas

  const estado = payload.estado ?? payload.status
  if (estado) out.estado = ESTADO_DESDE_LABEL[String(estado)] ?? estado

  const chofer = payload.chofer_id ?? payload.driver_id
  if (chofer != null && chofer !== '') out.chofer_id = Number(chofer)
  const vehiculo = payload.vehiculo_id ?? payload.vehicle_id
  if (vehiculo != null && vehiculo !== '') out.vehiculo_id = Number(vehiculo)

  const precio = payload.precio_final ?? payload.price
  if (precio != null && precio !== '') out.precio_final = Number(precio)
  const km = payload.km_estimados ?? payload.estimated_km
  if (km != null && km !== '') out.km_estimados = Number(km)
  const horas = payload.horas_estimadas ?? payload.estimated_hours
  if (horas != null && horas !== '') out.horas_estimadas = Number(horas)
  const espera = payload.espera_min ?? payload.wait_minutes
  if (espera != null && espera !== '') out.espera_min = Number(espera)
  if (payload.recotizar != null) out.recotizar = Boolean(payload.recotizar)
  if (payload.motivo_cancelacion != null) out.motivo_cancelacion = payload.motivo_cancelacion

  return out
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //
export const api = {
  base: API_BASE,

  // Identidad. El rol lo resuelve el backend contra `usuarios`; el JWT no lo
  // lleva, asi un cambio de permisos aplica sin esperar a que venza el token.
  me: async (): Promise<SessionUser> => {
    const raw = await http<{ email: string; nombre: string; rol: Role }>('/me')
    return { email: raw.email, nombre: raw.nombre, role: raw.rol }
  },

  // Geolocalización (Google Maps, resuelto por el backend)
  searchPlaces: async (query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> => {
    const qs = new URLSearchParams({ q: query })
    const rows = await http<Json[]>(`/geo/places?${qs}`, { signal })
    return rows.map((p) => ({
      placeId: String(p.place_id),
      primary: String(p.primary ?? ''),
      secondary: p.secondary ?? undefined,
      lat: p.lat != null ? Number(p.lat) : undefined,
      lng: p.lng != null ? Number(p.lng) : undefined,
    }))
  },
  getPlace: async (placeId: string): Promise<PlaceDetail> => {
    const p = await http<Json>(`/geo/places/${encodeURIComponent(placeId)}`)
    return {
      placeId: String(p.place_id),
      address: String(p.direccion ?? ''),
      lat: Number(p.lat),
      lng: Number(p.lng),
      locality: p.localidad ?? undefined,
      partido: p.partido ?? undefined,
      province: p.provincia ?? undefined,
    }
  },
  route: async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<RouteEstimate> => {
    const r = await http<Json>('/geo/route', {
      method: 'POST',
      body: JSON.stringify({ origen: origin, destino: destination }),
    })
    return {
      kmIda: Number(r.km_ida),
      kmVuelta: Number(r.km_vuelta),
      kmTotal: Number(r.km_total),
      etaMinutes: Number(r.duracion_ida_min),
      returnMinutes: Number(r.duracion_vuelta_min),
    }
  },
  quote: async (id: string, params: { driverId: string; waitMinutes?: number }): Promise<Quote> => {
    const qs = new URLSearchParams({ driver_id: params.driverId })
    if (params.waitMinutes != null) qs.set('espera_min', String(params.waitMinutes))
    return mapQuote(await http<Json>(`/requests/${encodeURIComponent(id)}/quote?${qs}`))
  },
  previewQuote: async (payload: {
    kmIda: number
    etaMinutes?: number
    waitMinutes?: number
    tariffBase: number
    tariffPerKm: number
    tariffPerHour: number
  }): Promise<Quote> =>
    mapQuote(
      await http<Json>('/pricing/preview', {
        method: 'POST',
        body: JSON.stringify({
          km_ida: payload.kmIda,
          duracion_ida_min: payload.etaMinutes ?? null,
          espera_min: payload.waitMinutes ?? null,
          tarifa_base: payload.tariffBase,
          tarifa_por_km: payload.tariffPerKm,
          tarifa_por_hora: payload.tariffPerHour,
        }),
      }),
    ),

  // Choferes
  listDrivers: async (): Promise<Driver[]> => (await http<Json[]>('/drivers')).map(mapDriver),
  createDriver: async (payload: {
    name: string
    phone: string
    email: string
    status: Driver['status']
  }): Promise<Driver> =>
    mapDriver(
      await http<Json>('/drivers', {
        method: 'POST',
        body: JSON.stringify({
          nombre: payload.name,
          telefono: payload.phone,
          email: payload.email,
          activo: payload.status !== 'Inactivo',
        }),
      }),
    ),
  updateDriver: async (
    id: string,
    payload: { name: string; phone: string; email: string; status: Driver['status'] },
  ): Promise<Driver> =>
    mapDriver(
      await http<Json>(`/drivers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: payload.name,
          telefono: payload.phone,
          email: payload.email,
          activo: payload.status !== 'Inactivo',
        }),
      }),
    ),
  updateDriverRates: async (
    id: string,
    payload: { baseRate: number; ratePerKm: number; ratePerHour: number },
  ): Promise<Driver> =>
    mapDriver(
      await http<Json>(`/drivers/${encodeURIComponent(id)}/rates`, {
        method: 'PUT',
        body: JSON.stringify({
          tarifa_base: payload.baseRate,
          tarifa_por_km: payload.ratePerKm,
          tarifa_por_hora: payload.ratePerHour,
        }),
      }),
    ),

  // Vehiculos
  listVehicles: async (): Promise<Vehicle[]> => (await http<Json[]>('/vehicles')).map(mapVehicle),
  createVehicle: async (payload: {
    id: string
    type: string
    capacity_kg: number
    status: Vehicle['status']
    assigned_note?: string | null
  }): Promise<Vehicle> => {
    const estado =
      payload.status === 'En taller'
        ? 'en_taller'
        : payload.status === 'Fuera de servicio'
          ? 'fuera_de_servicio'
          : payload.status === 'Asignado'
            ? 'asignado'
            : 'disponible'
    return mapVehicle(
      await http<Json>('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          patente: payload.id,
          tipo: payload.type,
          capacidad_kg: payload.capacity_kg,
          estado,
          notas: payload.assigned_note ?? null,
          activo: true,
        }),
      }),
    )
  },
  updateVehicle: async (
    id: string,
    payload: { id: string; type: string; capacity_kg: number; status: Vehicle['status']; assigned_note?: string | null },
  ): Promise<Vehicle> => {
    const estado =
      payload.status === 'En taller'
        ? 'en_taller'
        : payload.status === 'Fuera de servicio'
          ? 'fuera_de_servicio'
          : payload.status === 'Asignado'
            ? 'asignado'
            : 'disponible'
    return mapVehicle(
      await http<Json>(`/vehicles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          patente: payload.id,
          tipo: payload.type,
          capacidad_kg: payload.capacity_kg,
          estado,
          notas: payload.assigned_note ?? null,
          activo: payload.status !== 'Inactivo',
        }),
      }),
    )
  },

  // Clientes
  listClients: async (): Promise<Client[]> => (await http<Json[]>('/clients')).map(mapClient),
  createClient: async (payload: { name: string; phone: string }): Promise<Client> =>
    mapClient(
      await http<Json>('/clients', {
        method: 'POST',
        body: JSON.stringify({ nombre: payload.name, telefono: payload.phone }),
      }),
    ),

  // Solicitudes
  listRequests: async (params?: { status?: string; date?: string; driver_id?: string; vehicle_id?: string; search?: string }): Promise<ShiftRequest[]> => {
    const qs = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v) qs.set(k, String(v))
    })
    const suffix = qs.toString() ? `?${qs}` : ''
    return (await http<Json[]>(`/requests${suffix}`)).map(mapRequest)
  },
  getRequest: async (id: string): Promise<ShiftRequest> => mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}`)),
  createRequest: async (payload: Json): Promise<ShiftRequest> =>
    mapRequest(await http<Json>('/requests', { method: 'POST', body: JSON.stringify(legacySolicitudPayload(payload)) })),
  updateRequest: async (id: string, payload: Json): Promise<ShiftRequest> =>
    mapRequest(
      await http<Json>(`/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(legacySolicitudPayload(payload)),
      }),
    ),
  markArrived: async (id: string, arrivedAt: string): Promise<ShiftRequest> =>
    mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}/arrived`, { method: 'POST', body: JSON.stringify({ arrived_at: arrivedAt }) })),
  markFinished: async (id: string, finishedAt: string): Promise<ShiftRequest> =>
    mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}/finished`, { method: 'POST', body: JSON.stringify({ finished_at: finishedAt }) })),
  addIncident: async (id: string, incident: { type: string; description: string; time: string }): Promise<TripIncident> =>
    http<TripIncident>(`/requests/${encodeURIComponent(id)}/incidents`, { method: 'POST', body: JSON.stringify(incident) }),
  setRemito: async (id: string, remito: RemitoPhoto): Promise<ShiftRequest> =>
    mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}/remito`, { method: 'PUT', body: JSON.stringify({ name: remito.name, data_url: remito.dataUrl }) })),
  deleteRemito: async (id: string): Promise<ShiftRequest> =>
    mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}/remito`, { method: 'DELETE' })),
  addPayment: async (id: string, payment: Payment): Promise<ShiftRequest> =>
    mapRequest(
      await http<Json>(`/payments/requests/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          concepto: payment.concept === 'Seña' ? 'sena' : 'saldo',
          metodo: payment.method === 'Efectivo' ? 'efectivo' : 'transferencia',
          monto: payment.amount,
          fecha: payment.date,
          notas: payment.notes ?? null,
        }),
      }),
    ),

  // Pagos (resumen)
  paymentsSummary: async (params?: { date?: string; status?: string; search?: string }): Promise<PaymentSummary[]> => {
    const qs = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v) qs.set(k, String(v))
    })
    const suffix = qs.toString() ? `?${qs}` : ''
    return (await http<Json[]>(`/payments/summary${suffix}`)).map(mapSummary)
  },

  // Disponibilidad
  availability: async (params: {
    date: string
    start: string
    end: string
    driver_id?: string
    vehicle_id?: string
    exclude?: string
  }): Promise<Availability> => {
    const qs = new URLSearchParams({
      fecha: params.date,
      hora_desde: params.start,
      hora_hasta: params.end,
    })
    if (params.driver_id) qs.set('chofer_id', params.driver_id)
    if (params.vehicle_id) qs.set('vehiculo_id', params.vehicle_id)
    if (params.exclude) qs.set('exclude', params.exclude)
    const raw = await http<Json>(`/availability?${qs}`)
    return { driverAvailable: raw.driver_available, vehicleAvailable: raw.vehicle_available, conflicts: raw.conflicts ?? [] }
  },
}

export type { ReceivedBy }
