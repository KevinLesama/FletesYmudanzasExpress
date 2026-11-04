import assert from 'node:assert/strict'
import { test } from 'node:test'

import { motivosConfirmacionViaje } from '../src/pages/planificacionConfirmacion.ts'
import { estiloOpcionPlanificacion } from '../src/pages/planificacionOpciones.ts'
import { color } from '../src/design/tokens.ts'

const completo = {
  cancelled: false,
  driverId: '7',
  vehicleId: '9',
  loadMinutes: 60,
  downloadMinutes: 30,
  arrivalTime: '11:00',
  driverIsAvailable: true,
  vehicleIsAvailable: true,
  price: 100000,
  depositReceived: 0,
  depositRequired: 50000,
}

test('planning confirmation waits for explicit load, unload and arrival', () => {
  const motives = motivosConfirmacionViaje({
    ...completo,
    loadMinutes: null,
    downloadMinutes: null,
    arrivalTime: '',
  })

  assert.deepEqual(motives.map(({ id }) => id), ['carga', 'descarga', 'horario'])
})

test('deposit is the remaining confirmation requirement after a complete plan', () => {
  assert.deepEqual(motivosConfirmacionViaje(completo).map(({ id }) => id), ['sena'])
  assert.deepEqual(
    motivosConfirmacionViaje({ ...completo, depositReceived: 50000 }),
    [],
  )
})

test('provisional assignments stay selectable and brown; firm conflicts are blocked', () => {
  assert.deepEqual(
    estiloOpcionPlanificacion({
      operativa: true,
      bloqueada: false,
      tieneAdvertencias: true,
    }),
    { disabled: false, color: color.amberInk },
  )
  assert.deepEqual(
    estiloOpcionPlanificacion({
      operativa: true,
      bloqueada: true,
      tieneAdvertencias: true,
    }),
    { disabled: true, color: color.muted },
  )
})
