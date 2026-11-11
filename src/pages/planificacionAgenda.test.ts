import { describe, expect, it } from 'vitest'

import { agendaMarkedDates, agendaTripsInSlot, driverDayAgenda, matchesAgendaFilters, overlaps } from './planificacionAgenda'
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

  it('ocupa tambien durante la descarga y el margen', () => {
    const actual = trip({ id: 'FEX-4', driverId: '7', downloadMinutes: 60 })

    // Llega a las 11:00 y sigue descargando hasta las 12:00.
    expect(agendaTripsInSlot([actual], '11:30', '12:30')).toEqual([actual])
  })

  it('suma el margen operativo configurado', () => {
    const actual = trip({ id: 'FEX-5', driverId: '7', downloadMinutes: 60 })

    expect(agendaTripsInSlot([actual], '12:15', '13:00', undefined, 30)).toEqual([actual])
    expect(agendaTripsInSlot([actual], '12:15', '13:00', undefined, null)).toEqual([])
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

describe('filtros de la agenda y puntitos del calendario', () => {
  const sinFiltros = { driver: 'all', vehicle: 'all', status: 'all' }

  // Dos choferes y dos vehiculos, con el 19 compartido por ambos.
  const agenda = [
    trip({ id: 'FEX-1', date: '2026-11-19', driverId: 'agus', vehicleId: 'v1' }),
    trip({ id: 'FEX-2', date: '2026-11-20', driverId: 'emanuel', vehicleId: 'v2' }),
    trip({
      id: 'FEX-3',
      date: '2026-11-19',
      driverId: 'emanuel',
      vehicleId: 'v2',
      status: 'Pendiente de seña',
    }),
  ]

  it('sin filtros la grilla y los puntitos muestran todo', () => {
    expect(agenda.filter((item) => matchesAgendaFilters(item, sinFiltros))).toHaveLength(3)
    expect([...agendaMarkedDates(agenda, sinFiltros)].sort()).toEqual(['2026-11-19', '2026-11-20'])
  })

  it('un filtro de chofer apaga los dias que solo tienen viajes de otro', () => {
    const filtros = { ...sinFiltros, driver: 'agus' }

    // El 20 es solo de Emanuel: sin puntito. El 19 sobrevive por FEX-1.
    expect([...agendaMarkedDates(agenda, filtros)]).toEqual(['2026-11-19'])
  })

  it('el filtro de vehiculo compara contra la PK, no contra la patente', () => {
    const porPk = { ...sinFiltros, vehicle: 'v2' }
    const porPatente = { ...sinFiltros, vehicle: 'AB123CD' }

    expect([...agendaMarkedDates(agenda, porPk)].sort()).toEqual(['2026-11-19', '2026-11-20'])
    expect([...agendaMarkedDates(agenda, porPatente)]).toEqual([])
  })

  it('dos filtros activos se aplican juntos sobre la misma fecha', () => {
    const filtros = { ...sinFiltros, driver: 'emanuel', status: 'Pendiente de seña' }

    expect([...agendaMarkedDates(agenda, filtros)]).toEqual(['2026-11-19'])
  })

  it('sin coincidencias no queda ningun dia marcado', () => {
    expect([...agendaMarkedDates(agenda, { ...sinFiltros, driver: 'nadie' })]).toEqual([])
  })

  it('un cancelado marca el dia cuando el filtro lo pide', () => {
    const cancelada = trip({ id: 'FEX-4', date: '2026-11-21', driverId: 'agus', status: 'Cancelada' })
    const filtros = { ...sinFiltros, status: 'Cancelada' }

    // El calendario y la grilla tienen que mostrar el mismo conjunto.
    expect([...agendaMarkedDates([...agenda, cancelada], filtros)]).toEqual(['2026-11-21'])
  })
})
