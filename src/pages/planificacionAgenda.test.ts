import { describe, expect, it } from 'vitest'

import { agendaTripsInSlot, driverDayAgenda, overlaps } from './planificacionAgenda'
import type { ShiftRequest } from '../types'

/**
 * Pruebas de caracterización de la agenda del frontend.
 *
 * Describen el comportamiento VIGENTE, no las reglas nuevas. No son la
 * especificación del motor de disponibilidad ni de la semántica blanda/firme:
 * esa especificación vive en `backend/tests/unit/test_disponibilidad.py`.
 *
 * Deliberadamente solo se afirman invariantes que sobreviven al cambio de
 * semántica: los horarios contiguos no se solapan, un viaje confirmado ocupa su
 * franja, un viaje no se cuenta a sí mismo y una franja inválida no inventa
 * solape. Cuando llegue la etapa de frontend se agregan los casos de reserva
 * blanda.
 */
describe('overlaps', () => {
  it('detecta dos franjas que se pisan', () => {
    expect(overlaps('09:00', '11:00', '10:00', '12:00')).toBe(true)
  })

  it('no considera solape a dos franjas contiguas', () => {
    expect(overlaps('09:00', '11:00', '11:00', '13:00')).toBe(false)
  })

  it('detecta una franja contenida en otra', () => {
    expect(overlaps('09:00', '15:00', '11:00', '12:00')).toBe(true)
  })

  it('no se solapa con una franja completamente anterior', () => {
    expect(overlaps('14:00', '16:00', '09:00', '11:00')).toBe(false)
  })
})

function trip(overrides: Partial<ShiftRequest> & { id: string }) {
  return {
    client: 'Cliente',
    phone: '11 0000-0000',
    status: 'Confirmada',
    date: '2026-09-24',
    arrivalRange: ['09:00', '11:00'],
    serviceRange: ['09:00', '11:00'],
    origin: { label: 'Origen', address: 'A', barrio: '', floor: '', elevator: false },
    destination: { label: 'Destino', address: 'B', barrio: '', floor: '', elevator: false },
    cargo: { items: [], approxUnits: 0, fragile: false, notes: '' },
    price: 0,
    depositRequired: 0,
    depositReceived: 0,
    ...overrides,
  } satisfies ShiftRequest
}

describe('agendaTripsInSlot', () => {
  it('no se cuenta a si mismo como conflicto', () => {
    const actual = trip({ id: 'FEX-1', driverId: '7' })

    expect(agendaTripsInSlot([actual], '09:00', '11:00', 'FEX-1')).toEqual([])
  })

  it('incluye un viaje confirmado que ocupa la franja', () => {
    const actual = trip({ id: 'FEX-2', driverId: '7' })

    expect(agendaTripsInSlot([actual], '10:00', '12:00')).toEqual([actual])
  })

  it('ignora una franja invalida en vez de asumir solape', () => {
    const actual = trip({ id: 'FEX-3', driverId: '7' })

    expect(agendaTripsInSlot([actual], '11:00', '09:00')).toEqual([])
  })
})

describe('driverDayAgenda', () => {
  it('ordena por horario y descarta los cancelados', () => {
    const tarde = trip({ id: 'FEX-B', driverId: '7', serviceRange: ['14:00', '16:00'] })
    const manana = trip({ id: 'FEX-A', driverId: '7', serviceRange: ['08:00', '10:00'] })
    const cancelado = trip({ id: 'FEX-C', driverId: '7', status: 'Cancelada' })
    const otroChofer = trip({ id: 'FEX-D', driverId: '9' })

    expect(driverDayAgenda([tarde, cancelado, manana, otroChofer], '7')).toEqual([manana, tarde])
  })

  it('devuelve vacio sin chofer seleccionado', () => {
    expect(driverDayAgenda([trip({ id: 'FEX-A', driverId: '7' })], '')).toEqual([])
  })
})
