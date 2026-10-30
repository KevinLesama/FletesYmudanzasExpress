// Tipos del dominio (los mismos que ya usaba la demo) y los DTO que devuelve
// la API. La API habla en snake_case; los DTO se mapean a estos tipos en api.ts.

export type RequestStatus = 'Pendiente de revisión' | 'Pendiente de seña' | 'Confirmada' | 'Finalizada' | 'Cancelada'
export type TripStatus = 'Confirmada' | 'Tentativa'
export type VehicleStatus = 'Disponible' | 'Asignado' | 'En taller' | 'Fuera de servicio' | 'Inactivo'
export type DriverStatus = 'Activo' | 'Inactivo'
export type PaymentConcept = 'Seña' | 'Saldo'
export type PaymentMethod = 'Transferencia' | 'Efectivo'
export type ReceivedBy = 'Administración' | 'Chofer'
export type PaymentState = 'Cobrado' | 'Parcial' | 'Sin pagos'

export interface Factor {
  label: string
  amount: number
}

export interface Driver {
  id: string
  initials: string
  name: string
  phone: string
  email: string
  status: DriverStatus
  baseRate: number // tarifa por viaje (sueldo base)
  ratePerKm: number
  ratePerHour: number
  factors: Factor[]
}

export interface TripIncident {
  id: string
  type: string
  description: string
  time: string
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
  confirmed?: boolean
  estimatedKm?: number
  estimatedHours?: number
  arrivedAt?: string
  finishedAt?: string
  incidents?: TripIncident[]
  remitoPhoto?: RemitoPhoto
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
}

export interface RequestFilter {
  search: string
  date: string
  status: string
}

export interface Client {
  id: number
  name: string
  phone: string
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
