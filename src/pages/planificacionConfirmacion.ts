import { ars } from '../format'

export type CampoConfirmacion = 'chofer' | 'vehiculo'

export type MotivoConfirmacion = {
  id: 'cancelado' | 'chofer' | 'vehiculo' | 'precio' | 'sena'
  texto: string
  campo?: CampoConfirmacion
}

export type CondicionesConfirmacionViaje = {
  cancelled: boolean
  driverId: string
  vehicleId: string
  driverIsAvailable: boolean
  vehicleIsAvailable: boolean
  price: number
  depositReceived: number
  depositRequired: number
}

/**
 * Replica las condiciones que ya deshabilitan "Confirmar viaje" en la página.
 * No agrega reglas nuevas: el botón exige seña completa (50 % de un precio > 0),
 * chofer activo, vehículo disponible y que el viaje no esté cancelado.
 */
export function motivosConfirmacionViaje(input: CondicionesConfirmacionViaje): MotivoConfirmacion[] {
  const motivos: MotivoConfirmacion[] = []

  if (input.cancelled) {
    motivos.push({ id: 'cancelado', texto: 'El viaje está cancelado.' })
  }

  if (!input.driverId) {
    motivos.push({ id: 'chofer', campo: 'chofer', texto: 'Asigná un chofer.' })
  } else if (!input.driverIsAvailable) {
    motivos.push({ id: 'chofer', campo: 'chofer', texto: 'El chofer no está disponible.' })
  }

  if (!input.vehicleId) {
    motivos.push({ id: 'vehiculo', campo: 'vehiculo', texto: 'Asigná un vehículo.' })
  } else if (!input.vehicleIsAvailable) {
    motivos.push({ id: 'vehiculo', campo: 'vehiculo', texto: 'El vehículo no está disponible.' })
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
