import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUpdates, depositTimestamp, groupUpdatesByDay, stageIndex } from '../src/tripUpdates.ts'
import type { ShiftRequest } from '../src/types.ts'

const NOW = new Date('2026-11-02T15:00:00-03:00')

function trip(overrides: Partial<ShiftRequest> = {}): ShiftRequest {
  return {
    id: 'FEX-TEST',
    client: 'Dana',
    phone: '',
    status: 'Confirmada',
    date: '2026-11-02',
    arrivalRange: ['14:00', '16:00'],
    serviceRange: ['14:00', '16:00'],
    origin: { label: 'Origen', address: 'Av. Corrientes 1234', barrio: 'CABA', floor: '', elevator: false },
    destination: { label: 'Destino', address: 'Av. Santa Fe 4321', barrio: 'Palermo', floor: '', elevator: false },
    cargo: { items: [], approxUnits: 0, fragile: false, notes: '' },
    price: 0,
    depositRequired: 0,
    depositReceived: 0,
    ...overrides,
  }
}

test('buildUpdates ordena de mas reciente a mas antigua por timestamp real', () => {
  const updates = buildUpdates(
    trip({
      finishedAt: '2026-11-02T18:30:00+00:00', // 15:30 ART
      createdAt: '2026-11-01T20:00:00+00:00', // 1 nov 17:00 ART
      depositReceived: 1000,
      payments: [
        { id: 1, concept: 'Seña', method: 'Transferencia', receivedBy: 'Administración', amount: 1000, date: '2026-11-02', createdAt: '2026-11-02T05:17:00+00:00' },
      ],
    }),
  )

  assert.deepEqual(
    updates.map((update) => update.id),
    ['finished', 'departure', 'driver', 'deposit', 'request'],
  )
  assert.deepEqual(
    updates.map((update) => update.at),
    ['2026-11-02T15:30', '2026-11-02T14:00', '2026-11-02T13:15', '2026-11-02T02:17', '2026-11-01T17:00'],
  )
})

test('un viaje finalizado conserva el cierre y registra modalidad y remito', () => {
  const updates = buildUpdates(
    trip({
      status: 'Finalizada',
      finishedAt: '2026-11-02T18:30:00+00:00',
      closeoutPaymentMethod: 'Efectivo',
      remitoCapturedAt: '2026-11-02T18:29:00+00:00',
    }),
  )

  const finished = updates.find((update) => update.id === 'finished')
  assert.ok(finished)
  assert.match(finished.detail, /Saldo: Efectivo\./)
  assert.match(finished.detail, /Remito fotografiado en el dispositivo\./)
  assert.equal(stageIndex(trip({ status: 'Finalizada' })), 4)
})

test('un evento real se intercala entre los calculados sin contradecirlos', () => {
  const updates = buildUpdates(
    trip({
      incidents: [
        { id: 'i1', type: 'Demora', description: 'Tránsito', time: '2026-11-02T16:30:00+00:00' }, // 13:30 ART
      ],
    }),
  )

  assert.deepEqual(
    updates.map((update) => update.id),
    ['departure', 'incident-0', 'driver', 'deposit', 'request'],
  )
})

test('agrupa por dia y deja la solicitud del dia anterior bajo "Ayer"', () => {
  const updates = buildUpdates(
    trip({
      createdAt: '2026-11-01T20:00:00+00:00', // 1 nov 17:00 ART
      depositReceived: 1000,
      payments: [
        { id: 1, concept: 'Seña', method: 'Transferencia', receivedBy: 'Administración', amount: 1000, date: '2026-11-02', createdAt: '2026-11-02T05:17:00+00:00' },
      ],
    }),
  )

  const rows = groupUpdatesByDay(updates, NOW)
  const days = rows.filter((row) => row.kind === 'day').map((row) => row.label)
  assert.deepEqual(days, ['Hoy', 'Ayer'])

  const ayerIndex = rows.findIndex((row) => row.kind === 'day' && row.label === 'Ayer')
  const requestIndex = rows.findIndex((row) => row.kind === 'event' && row.update.id === 'request')
  assert.ok(requestIndex > ayerIndex)
  assert.equal(rows[requestIndex + 1], undefined, 'la solicitud queda ultima, bajo su dia')
})

test('sin timestamp de sena cae al calculo de -90 minutos', () => {
  const updates = buildUpdates(
    trip({
      depositReceived: 1000,
      payments: [
        { id: 1, concept: 'Seña', method: 'Efectivo', receivedBy: 'Administración', amount: 1000, date: '2026-11-02' },
      ],
    }),
  )
  const deposit = updates.find((update) => update.id === 'deposit')
  assert.equal(deposit?.at, '2026-11-02T12:30')
  assert.equal(deposit?.time, '12:30')
})

test('sin pagos tambien cae al calculo de -90 minutos', () => {
  const updates = buildUpdates(trip({ depositReceived: 0 }))
  const deposit = updates.find((update) => update.id === 'deposit')
  assert.equal(deposit?.at, '2026-11-02T12:30')
  assert.equal(deposit?.title, 'Seña pendiente')
})

test('con varios pagos de sena usa el ultimo timestamp real', () => {
  const payments: ShiftRequest['payments'] = [
    { id: 1, concept: 'Seña', method: 'Efectivo', receivedBy: 'Administración', amount: 500, date: '2026-11-02', createdAt: '2026-11-02T05:10:00+00:00' },
    { id: 2, concept: 'Seña', method: 'Transferencia', receivedBy: 'Administración', amount: 500, date: '2026-11-02', createdAt: '2026-11-02T05:40:00+00:00' },
    { id: 3, concept: 'Saldo', method: 'Transferencia', receivedBy: 'Administración', amount: 900, date: '2026-11-02', createdAt: '2026-11-02T06:00:00+00:00' },
  ]
  assert.equal(depositTimestamp(trip({ payments })), '2026-11-02T02:40')
})
