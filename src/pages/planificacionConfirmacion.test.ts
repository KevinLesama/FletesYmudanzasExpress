import { describe, expect, it } from 'vitest'
import { motivosConfirmacionViaje } from './planificacionConfirmacion'

const completo = {
  cancelled: false,
  driverId: '7',
  vehicleId: '9',
  loadMinutes: 60,
  downloadMinutes: 90,
  arrivalTime: '12:00',
  driverIsAvailable: true,
  vehicleIsAvailable: true,
  price: 100000,
  depositReceived: 0,
  depositRequired: 50000,
}

describe('condiciones de confirmación de planificación', () => {
  it('mantiene pendiente la confirmación mientras falte cualquier tiempo operativo', () => {
    const motivos = motivosConfirmacionViaje({
      ...completo,
      loadMinutes: null,
      downloadMinutes: null,
      arrivalTime: '',
    })

    expect(motivos.map((motivo) => motivo.id)).toEqual(['carga', 'descarga', 'horario', 'sena'])
  })

  it('solo deja la seña pendiente cuando planificación y recursos están completos', () => {
    expect(motivosConfirmacionViaje(completo).map((motivo) => motivo.id)).toEqual(['sena'])
    expect(motivosConfirmacionViaje({
      ...completo,
      depositReceived: 50000,
    })).toEqual([])
  })

  it('no declara los recursos disponibles ni no disponibles antes de verificar la agenda', () => {
    const motivos = motivosConfirmacionViaje({
      ...completo,
      loadMinutes: null,
      downloadMinutes: null,
      arrivalTime: '',
      driverIsAvailable: null,
      vehicleIsAvailable: null,
    })

    expect(motivos.map((motivo) => motivo.id)).toEqual(['carga', 'descarga', 'horario', 'sena'])
  })
})
