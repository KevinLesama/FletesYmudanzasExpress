// Capa de servicios HTTP: centraliza la URL del backend y el mapeo entre el
// snake_case que devuelve la API y los tipos camelCase que usa la interfaz.
//
// La base de la API se define en VITE_API_URL (por defecto "/api"). En
// desarrollo, Vite hace proxy de /api hacia el backend; en Docker, nginx hace
// lo mismo. Asi el navegador siempre usa una ruta relativa.
//
// Cada request manda el token de Supabase en `Authorization: Bearer`, asi que
// la API puede saber quien es el usuario y que permisos tiene.

import { supabase } from './supabase'
import type {
  Availability,
  Payment,
  PaymentSummary,
  ReceivedBy,
  RemitoPhoto,
  Session,
  ShiftRequest,
  User,
  UserRole,
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
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  try {
    const {
      data: { session },
    } = await supabase().auth.getSession()
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`)
  } catch {
    throw new ApiError(0, 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env del frontend.')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Verificá que el backend esté en ejecución.')
  }
  if (response.status === 401) {
    // Token vencido o ausente: la sesion no sirve, se cierra y se vuelve al ingreso.
    try {
      await supabase().auth.signOut()
    } catch {
      /* sin sesion: seguimos al ingreso */
    }
    window.location.href = '/ingreso'
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

function mapUser(u: Json): User {
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    phone: u.phone,
    email: u.email ?? undefined,
    initials: u.initials ?? undefined,
    status: u.status,
    baseRate: Number(u.base_rate),
    ratePerKm: Number(u.rate_per_km),
    ratePerHour: Number(u.rate_per_hour),
    factors: (u.factors ?? []).map((f: Json) => ({ label: f.label, amount: Number(f.amount) })),
  }
}

function mapVehicle(v: Json): Vehicle {
  return {
    id: v.id,
    type: v.type,
    capacityKg: Number(v.capacity_kg),
    status: v.status,
    assignedNote: v.assigned_note ?? undefined,
  }
}

function mapPayment(p: Json): Payment {
  return {
    id: p.id,
    concept: p.concept,
    method: p.method,
    receivedBy: p.received_by,
    amount: Number(p.amount),
    date: p.date,
    notes: p.notes ?? undefined,
    remito: p.remito_data_url
      ? { name: p.remito_name ?? 'remito', dataUrl: p.remito_data_url }
      : undefined,
  }
}

function mapRequest(r: Json): ShiftRequest {
  return {
    id: r.id,
    clientId: r.client_id ?? undefined,
    client: r.client_name,
    phone: r.phone,
    status: r.status,
    date: r.date,
    arrivalRange: [hhmm(r.arrival_from), hhmm(r.arrival_to)],
    serviceRange: [hhmm(r.service_from), hhmm(r.service_to)],
    origin: {
      label: 'Origen',
      address: r.origin_address,
      barrio: r.origin_barrio,
      floor: r.origin_floor,
      elevator: r.origin_elevator,
    },
    destination: {
      label: 'Destino',
      address: r.destination_address,
      barrio: r.destination_barrio,
      floor: r.destination_floor,
      elevator: r.destination_elevator,
    },
    cargo: {
      items: (r.cargo_items ?? []).map((i: Json) => ({ name: i.name, units: i.units, note: i.note ?? undefined })),
      approxUnits: r.cargo_approx_units,
      fragile: r.cargo_fragile,
      notes: r.cargo_notes,
    },
    driverId: r.driver_id ?? undefined,
    vehicleId: r.vehicle_id ?? undefined,
    price: Number(r.price),
    depositRequired: Number(r.deposit_required),
    depositReceived: Number(r.deposit_received),
    estimatedKm: r.estimated_km ?? undefined,
    estimatedHours: r.estimated_hours ?? undefined,
    payments: (r.payments ?? []).map(mapPayment),
  }
}

function mapSummary(s: Json): PaymentSummary {
  return {
    id: s.request_id,
    client: s.client_name,
    date: s.date,
    price: Number(s.price),
    deposit: Number(s.deposit),
    collected: Number(s.collected),
    balance: Number(s.balance),
    state: s.state,
  }
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //
export const api = {
  base: API_BASE,

  // Sesion: quien es el usuario detrás del token (rol incluido)
  me: async (): Promise<Session> => {
    const s = await http<Json>('/auth/me')
    return {
      id: s.id,
      name: s.name,
      email: s.email ?? undefined,
      role: s.role,
      initials: s.initials ?? undefined,
      status: s.status,
    }
  },

  // Usuarios (admins, choferes y clientes comparten la misma tabla)
  listUsers: async (role?: UserRole): Promise<User[]> => {
    const suffix = role ? `?role=${encodeURIComponent(role)}` : ''
    return (await http<Json[]>(`/users${suffix}`)).map(mapUser)
  },
  getUser: async (id: string): Promise<User> => mapUser(await http<Json>(`/users/${encodeURIComponent(id)}`)),
  createUser: async (payload: {
    role: UserRole
    name: string
    phone: string
    email?: string | null
    status?: User['status']
  }): Promise<User> => mapUser(await http<Json>('/users', { method: 'POST', body: JSON.stringify(payload) })),
  updateUser: async (
    id: string,
    payload: { name?: string; phone?: string; email?: string | null; status?: User['status'] },
  ): Promise<User> => mapUser(await http<Json>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })),
  updateUserRates: async (
    id: string,
    payload: { base_rate: number; rate_per_km: number; rate_per_hour: number; factors: { label: string; amount: number }[] },
  ): Promise<User> => mapUser(await http<Json>(`/users/${encodeURIComponent(id)}/rates`, { method: 'PUT', body: JSON.stringify(payload) })),

  // Vehiculos
  listVehicles: async (): Promise<Vehicle[]> => (await http<Json[]>('/vehicles')).map(mapVehicle),
  createVehicle: async (payload: {
    id: string
    type: string
    capacity_kg: number
    status: Vehicle['status']
    assigned_note?: string | null
  }): Promise<Vehicle> => mapVehicle(await http<Json>('/vehicles', { method: 'POST', body: JSON.stringify(payload) })),
  updateVehicle: async (
    id: string,
    payload: { id: string; type: string; capacity_kg: number; status: Vehicle['status']; assigned_note?: string | null },
  ): Promise<Vehicle> => mapVehicle(await http<Json>(`/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })),

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
    mapRequest(await http<Json>('/requests', { method: 'POST', body: JSON.stringify(payload) })),
  updateRequest: async (id: string, payload: Json): Promise<ShiftRequest> =>
    mapRequest(await http<Json>(`/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })),
  addPayment: async (id: string, payment: Payment): Promise<ShiftRequest> =>
    mapRequest(
      await http<Json>(`/requests/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          concept: payment.concept,
          method: payment.method,
          received_by: payment.receivedBy,
          amount: payment.amount,
          date: payment.date,
          notes: payment.notes ?? null,
          remito_name: payment.remito?.name ?? null,
          remito_data_url: payment.remito?.dataUrl ?? null,
        }),
      }),
    ),

  // Remitos: viven en el pago (por lo general, en cobros en efectivo)
  setPaymentRemito: async (paymentId: number, remito: RemitoPhoto): Promise<void> => {
    await http<Json>(`/payments/${paymentId}/remito`, {
      method: 'PUT',
      body: JSON.stringify({ name: remito.name, data_url: remito.dataUrl }),
    })
  },
  deletePaymentRemito: async (paymentId: number): Promise<void> => {
    await http<Json>(`/payments/${paymentId}/remito`, { method: 'DELETE' })
  },

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
    const qs = new URLSearchParams({ date: params.date, start: params.start, end: params.end })
    if (params.driver_id) qs.set('driver_id', params.driver_id)
    if (params.vehicle_id) qs.set('vehicle_id', params.vehicle_id)
    if (params.exclude) qs.set('exclude', params.exclude)
    const raw = await http<Json>(`/availability?${qs}`)
    return { driverAvailable: raw.driver_available, vehicleAvailable: raw.vehicle_available, conflicts: raw.conflicts ?? [] }
  },
}

export type { ReceivedBy }
