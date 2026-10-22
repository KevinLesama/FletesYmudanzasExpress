// Tipos del dominio (los mismos que ya usaba la demo) y los DTO que devuelve
// la API. La API habla en snake_case; los DTO se mapean a estos tipos en api.ts.

export type RequestStatus = 'Pendiente de revisión' | 'Pendiente de seña' | 'Confirmada' | 'Cancelada'
export type TripStatus = 'Confirmada' | 'Tentativa'
export type VehicleStatus = 'Disponible' | 'Asignado' | 'En taller'
export type UserStatus = 'Activo' | 'Inactivo'
export type UserRole = 'admin' | 'chofer' | 'cliente'
export type PaymentConcept = 'Seña' | 'Saldo'
export type PaymentMethod = 'Transferencia' | 'Cuenta corriente' | 'Efectivo'
export type ReceivedBy = 'Administración' | 'Chofer'
export type PaymentState = 'Cobrado' | 'Parcial' | 'Sin pagos'

export interface Factor {
  label: string
  amount: number
}

/** Administradores, choferes y clientes viven en la misma tabla (usuarios). */
export interface User {
  id: string
  role: UserRole
  name: string
  phone: string
  email?: string
  initials?: string
  status: UserStatus
  baseRate: number // tarifa por viaje (sueldo base)
  ratePerKm: number
  ratePerHour: number
  factors: Factor[]
}

export interface RemitoPhoto {
  name: string
  dataUrl: string
}

export interface Vehicle {
  id: string
  type: string
  capacityKg: number
  status: VehicleStatus
  assignedNote?: string
}

export interface Place {
  label: string
  address: string
  barrio: string
  floor: string
  elevator: boolean
}

export interface CargoItem {
  name: string
  units: number
  note?: string
}

export interface RequestCargo {
  items: CargoItem[]
  approxUnits: number
  fragile: boolean
  notes: string
}

export interface ShiftRequest {
  id: string // FEX-1048
  clientId?: string
  client: string
  phone: string
  status: RequestStatus
  date: string // yyyy-mm-dd
  arrivalRange: [string, string]
  serviceRange: [string, string]
  origin: Place
  destination: Place
  cargo: RequestCargo
  driverId?: string
  vehicleId?: string
  price: number
  depositRequired: number
  depositReceived: number
  estimatedKm?: number
  estimatedHours?: number
  payments?: Payment[]
}

export interface Payment {
  id?: number
  concept: PaymentConcept
  method: PaymentMethod
  receivedBy: ReceivedBy
  amount: number
  date: string
  notes?: string
  /** El remito respalda un cobro en efectivo; vive en el pago, no en el viaje. */
  remito?: RemitoPhoto
}

export interface RequestFilter {
  search: string
  date: string
  status: string
}

export interface PaymentSummary {
  id: string
  client: string
  date: string
  price: number
  deposit: number
  collected: number
  balance: number
  state: PaymentState
}

export interface Availability {
  driverAvailable: boolean
  vehicleAvailable: boolean
  conflicts: string[]
}

/** Sesión del usuario detrás del token (GET /api/auth/me). */
export interface Session {
  id: string
  name: string
  email?: string
  role: UserRole
  initials?: string
  status: UserStatus
}
