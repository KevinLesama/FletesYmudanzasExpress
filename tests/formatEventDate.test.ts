import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatEventDate } from '../src/format.ts'

// 2 de noviembre de 2026, 15:00 en Argentina.
const NOW = new Date('2026-11-02T15:00:00-03:00')

test('formatEventDate', async (t) => {
  await t.test('hoy', () => {
    assert.equal(formatEventDate('2026-11-02', NOW), 'Hoy')
  })

  await t.test('ayer', () => {
    assert.equal(formatEventDate('2026-11-01', NOW), 'Ayer')
  })

  await t.test('otro dia del mismo ano', () => {
    assert.equal(formatEventDate('2026-10-02', NOW), '2 oct')
    assert.equal(formatEventDate('2026-11-19', NOW), '19 nov')
  })

  await t.test('otro ano', () => {
    assert.equal(formatEventDate('2025-11-02', NOW), '2 nov 2025')
  })

  await t.test('null e invalidas', () => {
    assert.equal(formatEventDate(null, NOW), '')
    assert.equal(formatEventDate(undefined, NOW), '')
    assert.equal(formatEventDate('', NOW), '')
    assert.equal(formatEventDate('no-es-fecha', NOW), '')
    assert.equal(formatEventDate('2026-02-31', NOW), '')
    assert.equal(formatEventDate(new Date('invalida'), NOW), '')
  })

  await t.test('usa la zona Argentina, no la del timestamp', () => {
    // 3 nov 01:00 UTC = 2 nov 22:00 en Argentina: sigue siendo "Hoy".
    assert.equal(formatEventDate('2026-11-03T01:00:00+00:00', NOW), 'Hoy')
    assert.equal(formatEventDate('2026-11-03T01:00:00Z', NOW), 'Hoy')
  })

  await t.test('ayer cruzando mes y ano', () => {
    assert.equal(formatEventDate('2025-12-31', new Date('2026-01-01T12:00:00-03:00')), 'Ayer')
    assert.equal(formatEventDate('2026-10-31', new Date('2026-11-01T23:30:00-03:00')), 'Ayer')
  })

  await t.test('hoy aunque now ya sea el dia siguiente en UTC', () => {
    assert.equal(formatEventDate('2026-11-02', new Date('2026-11-03T02:00:00Z')), 'Hoy')
  })
})
