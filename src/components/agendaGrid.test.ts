import { describe, expect, it } from 'vitest'
import { computeLanes } from './AgendaGrid'
import type { AgendaBlockRange } from '../pages/planificacionHorarios'
import type { ShiftRequest } from '../types'

function trip(overrides: Partial<ShiftRequest> & { id: string }): ShiftRequest {
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
  }
}

/** Franjas ya calculadas, para no depender de la planificación de cada viaje. */
function ranges(spec: Record<string, [string, string]>): Map<string, AgendaBlockRange> {
  return new Map(Object.entries(spec).map(([id, [start, end]]) => [id, { start, end, complete: true }]))
}

const layout = (placed: ReturnType<typeof computeLanes>) =>
  placed.map(({ trip, lane, cols }) => [trip.id, lane, cols])

describe('carriles de la agenda', () => {
  it('un solo viaje ocupa toda la columna', () => {
    const placed = computeLanes([trip({ id: 'A' })], ranges({ A: ['09:00', '11:00'] }))
    expect(layout(placed)).toEqual([['A', 0, 1]])
  })

  it('dos viajes superpuestos comparten la columna en dos carriles', () => {
    const placed = computeLanes(
      [trip({ id: 'A' }), trip({ id: 'B' })],
      ranges({ A: ['09:00', '11:00'], B: ['10:00', '12:00'] }),
    )
    expect(layout(placed)).toEqual([
      ['A', 0, 2],
      ['B', 1, 2],
    ])
  })

  it('dos viajes contiguos no se parten', () => {
    const placed = computeLanes(
      [trip({ id: 'A' }), trip({ id: 'B' })],
      ranges({ A: ['09:00', '11:00'], B: ['11:00', '13:00'] }),
    )
    expect(layout(placed)).toEqual([
      ['A', 0, 1],
      ['B', 0, 1],
    ])
  })

  it('un cancelado no reserva carril ni achica a los viajes reales', () => {
    const cancelado = trip({ id: 'C', status: 'Cancelada' })
    const placed = computeLanes(
      [trip({ id: 'A' }), cancelado, trip({ id: 'B' })],
      ranges({ A: ['09:00', '11:00'], B: ['10:00', '12:00'], C: ['09:00', '12:00'] }),
    )

    // El cancelado se dibuja primero y a ancho completo, detrás de los demás.
    expect(placed[0].trip.id).toBe('C')
    expect([placed[0].lane, placed[0].cols]).toEqual([0, 1])
    expect(layout(placed.slice(1))).toEqual([
      ['A', 0, 2],
      ['B', 1, 2],
    ])
  })

  it('dos cancelados superpuestos se reparten entre ellos, sin tocar a los reales', () => {
    const placed = computeLanes(
      [trip({ id: 'C1', status: 'Cancelada' }), trip({ id: 'C2', status: 'Cancelada' })],
      ranges({ C1: ['09:00', '11:00'], C2: ['10:00', '12:00'] }),
    )
    expect(layout(placed)).toEqual([
      ['C1', 0, 2],
      ['C2', 1, 2],
    ])
  })
})
