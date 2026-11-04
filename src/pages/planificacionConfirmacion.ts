import { ars } from '../format'

export type CampoConfirmacion = 'chofer' | 'vehiculo'

export type MotivoConfirmacion = {
  id: 'cancelado' | 'chofer' | 'vehiculo' | 'carga' | 'descarga' | 'horario' | 'precio' | 'sena'
  texto: string
  campo?: CampoConfirmacion
}

export type CondicionesConfirmacionViaje = {
  cancelled: boolean
  driverId: string
  vehicleId: string
  loadMinutes: number | null
  downloadMinutes: number | null
  arrivalTime: string
  driverIsAvailable: boolean | null
  vehicleIsAvailable: boolean | null
  price: number
  depositReceived: number
  depositRequired: number
}

/**
 * La confirmación exige planificación completa, recursos disponibles y seña.
 */
export function motivosConfirmacionViaje(input: CondicionesConfirmacionViaje): MotivoConfirmacion[] {
  const motivos: MotivoConfirmacion[] = []

  if (input.cancelled) {
    motivos.push({ id: 'cancelado', texto: 'El viaje está cancelado.' })
  }

  if (!input.driverId) {
    motivos.push({ id: 'chofer', campo: 'chofer', texto: 'Asigná un chofer.' })
  } else if (input.driverIsAvailable === false) {
    motivos.push({ id: 'chofer', campo: 'chofer', texto: 'El chofer no está disponible.' })
  }

  if (!input.vehicleId) {
    motivos.push({ id: 'vehiculo', campo: 'vehiculo', texto: 'Asigná un vehículo.' })
  } else if (input.vehicleIsAvailable === false) {
    motivos.push({ id: 'vehiculo', campo: 'vehiculo', texto: 'El vehículo no está disponible.' })
  }

  if (input.loadMinutes == null) {
    motivos.push({ id: 'carga', texto: 'Definí el tiempo estimado de carga.' })
  }
  if (input.downloadMinutes == null) {
    motivos.push({ id: 'descarga', texto: 'Definí el tiempo estimado de descarga.' })
  }
  if (!/^\d{2}:\d{2}$/.test(input.arrivalTime)) {
    motivos.push({ id: 'horario', texto: 'Definí una hora estimada de llegada.' })
  }

  if (!(input.price > 0) || !(input.depositRequired > 0)) {
    motivos.push({ id: 'precio', texto: 'Indicá el precio final.' })
  } else if (input.depositReceived < input.depositRequired) {
    motivos.push({
      id: 'sena',
      texto: `Registrá la seña requerida (${ars(input.depositRequired)}).`,
    })
  }

  return motivos
}
